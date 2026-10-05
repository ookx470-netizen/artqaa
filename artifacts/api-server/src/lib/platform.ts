import type { Member, Plan, Subscription, Activity, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { HttpError } from "./http";
import { logger } from "./logger";

export const DAY = 86400_000;
export const FREE_PLAN_ID = "starter";
export const FREE_PLAN_VERIFICATION_DEPOSIT_CENTS = 400;
export const FREE_PLAN_DURATION_DAYS = 180;
export const DEFAULT_PLAN_DURATION_DAYS = 365;
export const planDurationDays = (planId: string) => planId === FREE_PLAN_ID ? FREE_PLAN_DURATION_DAYS : DEFAULT_PLAN_DURATION_DAYS;
export const MIN_WITHDRAWAL_CENTS = 200;
export const money = (cents: number) => cents / 100;
export function cents(value: number): number {
  if (!Number.isFinite(value) || Math.abs(value * 100 - Math.round(value * 100)) > 0.000001) throw new HttpError(400, "يسمح بمنزلتين عشريتين فقط للمبالغ.");
  return Math.round(value * 100);
}
export const validAddress = (s: string) => /^0x[a-fA-F0-9]{40}$/.test(s) && !/^0x0{40}$/i.test(s);
export const validHash = (s: string) => /^0x[a-fA-F0-9]{64}$/.test(s) && !/^0x0{64}$/i.test(s);
export const userView = (u: Member) => ({
  id: u.id, name: u.name, phone: u.phone, payoutAddress: u.payoutAddress, memberId: u.memberId, role: u.role,
  honorPoints: u.honorPoints, balance: money(u.realBalanceCents), totalEarned: money(u.realEarnedCents),
  active: u.active, createdAt: u.createdAt.toISOString(),
});
export const planView = (p: Plan) => ({
  id: p.id, name: p.name, description: p.description, annualPrice: money(p.annualPriceCents),
  dailyProfit: money(p.dailyProfitCents), active: p.active, configured: p.configured,
});
export const subscriptionView = (s: Subscription) => ({
  id: s.id, startsAt: s.startsAt.toISOString(), expiresAt: s.expiresAt.toISOString(), active: s.expiresAt.getTime() > Date.now(),
  plan: {id: s.planId, name: s.planName, description: s.planDescription, annualPrice: money(s.annualPriceCents),
    dailyProfit: money(s.dailyProfitCents), active: true, configured: true},
});
export const activityView = (a: Activity) => ({id: a.id, title: a.title, kind: a.kind, amount: money(a.amountCents), createdAt: a.createdAt.toISOString()});
export async function settings() {
  const s = await prisma.setting.findUnique({where: {id: "main"}});
  const base = {telegramUrl: s?.telegramUrl ?? "",
    binanceAddress: s?.binanceAddress ?? "", okxAddress: s?.okxAddress ?? "", depositsEnabled: s?.depositsEnabled ?? false,
    fundingDescription: s?.fundingDescription ?? "", terms: s?.terms ?? ""};
  return {...base, minimumWithdrawal: money(MIN_WITHDRAWAL_CENTS), currency: "USDT", network: "Polygon",
    ready: base.depositsEnabled && (validAddress(base.binanceAddress) || validAddress(base.okxAddress)) && !!base.terms.trim() && !!base.fundingDescription.trim()};
}
export async function lockMember(tx: Prisma.TransactionClient, id: string): Promise<Member> {
  await tx.$queryRaw`SELECT id FROM "Member" WHERE id = ${id} FOR UPDATE`;
  const user = await tx.member.findUniqueOrThrow({where: {id}});
  if (!user.active) throw new HttpError(403, "هذا الحساب موقوف.");
  return user;
}

// Row lock + lastCreditedDay + unique(subscription,day) make concurrent sweeps/reloads exactly-once.
// A day-0 credit marks a new subscription: it gets that activation credit plus duration-1 24-hour credits.
// Older subscriptions without day 0 keep their original duration-count of 24-hour credits.
// Always settle even expired subscriptions so downtime cannot erase a member's earned days.
function accrualWhere(): Prisma.SubscriptionWhereInput {
  return {
    mode: "live",
    OR: [
      {planId: FREE_PLAN_ID, lastCreditedDay: {lt: FREE_PLAN_DURATION_DAYS}, credits: {none: {day: 0}}},
      {planId: FREE_PLAN_ID, lastCreditedDay: {lt: FREE_PLAN_DURATION_DAYS - 1}, credits: {some: {day: 0}}},
      {planId: {not: FREE_PLAN_ID}, lastCreditedDay: {lt: DEFAULT_PLAN_DURATION_DAYS}, credits: {none: {day: 0}}},
      {planId: {not: FREE_PLAN_ID}, lastCreditedDay: {lt: DEFAULT_PLAN_DURATION_DAYS - 1}, credits: {some: {day: 0}}},
    ],
  };
}

export async function accrue(tx: Prisma.TransactionClient, memberId: string, now = new Date()): Promise<Member> {
  await tx.$queryRaw`SELECT id FROM "Member" WHERE id = ${memberId} FOR UPDATE`;
  const subscriptions = await tx.subscription.findMany({
    where: {...accrualWhere(), memberId},
    include: {credits: {where: {day: 0}, select: {id: true}, take: 1}},
  });
  let amount = 0;
  for (const sub of subscriptions) {
    const durationDays = planDurationDays(sub.planId);
    const maxAccrualDay = sub.credits.length ? durationDays - 1 : durationDays;
    const elapsed = Math.max(0, Math.min(maxAccrualDay, Math.floor((Math.min(now.getTime(), sub.expiresAt.getTime()) - sub.startsAt.getTime()) / DAY)));
    if (elapsed <= sub.lastCreditedDay) continue;
    const credits = Array.from({length: elapsed - sub.lastCreditedDay}, (_, i) => ({
      subscriptionId: sub.id, day: sub.lastCreditedDay + i + 1, amountCents: sub.dailyProfitCents,
      dueAt: new Date(sub.startsAt.getTime() + (sub.lastCreditedDay + i + 1) * DAY),
    }));
    await tx.dailyCredit.createMany({data: credits});
    await tx.activity.createMany({data: credits.map(c => ({
      memberId, mode: "live", kind: "daily_profit", amountCents: c.amountCents, createdAt: c.dueAt,
      title: c.day === 0 ? `ربح تفعيل باقة ${sub.planName}` : `استحقاق اليوم ${c.day} — باقة ${sub.planName}`,
    }))});
    amount += credits.length * sub.dailyProfitCents;
    await tx.subscription.update({where: {id: sub.id}, data: {lastCreditedDay: elapsed}});
  }
  return tx.member.update({where: {id: memberId}, data: {realBalanceCents: {increment: amount}, realEarnedCents: {increment: amount}}});
}
export async function dashboard(id: string) {
  const user = await prisma.$transaction(async tx => { await lockMember(tx, id); return accrue(tx, id); });
  const now = new Date();
  const [sub, config, activities, reserved, today] = await Promise.all([
    prisma.subscription.findFirst({where: {memberId: id, mode: "live"}, orderBy: {startsAt: "desc"},
      include: {credits: {where: {day: 0}, select: {id: true}, take: 1}}}), settings(),
    prisma.activity.findMany({where: {memberId: id, mode: "live"}, orderBy: {createdAt: "desc"}, take: 8}),
    prisma.withdrawal.aggregate({where: {memberId: id, mode: "live", status: {in: ["pending", "processing"]}}, _sum: {amountCents: true}}),
    prisma.dailyCredit.aggregate({where: {subscription: {memberId: id}, dueAt: {gte: new Date(now.getTime() - DAY)}}, _sum: {amountCents: true}}),
  ]);
  const durationDays = sub ? planDurationDays(sub.planId) : 0;
  const maxAccrualDay = sub ? durationDays - (sub.credits.length ? 1 : 0) : 0;
  const elapsedDays = sub ? Math.max(0, Math.min(durationDays, Math.floor((Math.min(now.getTime(), sub.expiresAt.getTime()) - sub.startsAt.getTime()) / DAY))) : 0;
  const hasOpenWithdrawal = (reserved._sum.amountCents ?? 0) > 0;
  const canWithdraw = !!user.payoutAddress && !hasOpenWithdrawal && user.realBalanceCents >= MIN_WITHDRAWAL_CENTS;
  return {user: userView(user), subscription: sub ? subscriptionView(sub) : null,
    todayEarned: money(today._sum.amountCents ?? 0), dailyProfit: sub && sub.expiresAt.getTime() > Date.now() ? money(sub.dailyProfitCents) : 0,
    creditedDays: elapsedDays,
    nextAccrualAt: sub && sub.lastCreditedDay < maxAccrualDay ? new Date(sub.startsAt.getTime() + (sub.lastCreditedDay + 1) * DAY).toISOString() : null,
    reservedBalance: money(reserved._sum.amountCents ?? 0), canWithdraw,
    withdrawalReason: !user.payoutAddress ? "أضف عنوان محفظة Polygon قبل طلب السحب."
      : hasOpenWithdrawal ? "لديك طلب سحب مفتوح بالفعل."
      : user.realBalanceCents < MIN_WITHDRAWAL_CENTS ? `الحد الأدنى للسحب ${money(MIN_WITHDRAWAL_CENTS)} USDT.`
      : "السحب يُراجع ويُحوّل يدوياً بعملة USDT على Polygon؛ الرصيد المسجل ليس إثبات تحويل.",
    recentActivity: activities.map(activityView)};
}

export function startAccrualWorker(): void {
  let running = false;
  const sweep = async () => {
    if (running) return;
    running = true;
    try {
      const members = await prisma.subscription.findMany({
        where: accrualWhere(),
        select: {memberId: true},
        distinct: ["memberId"],
      });
      for (const {memberId} of members) await prisma.$transaction(tx => accrue(tx, memberId), {timeout: 15000});
    } catch (err) { logger.error({err}, "Daily accrual sweep failed; will retry"); }
    finally { running = false; }
  };
  void sweep();
  setInterval(() => { void sweep(); }, 60_000).unref();
}