import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import * as V from "@workspace/api-zod";
import { prisma } from "../lib/prisma";
import { hashPassword, normalizePhone, requireAdmin, requireMember } from "../lib/auth";
import { input, HttpError } from "../lib/http";
import { cents, money, planView, settings, userView, validAddress } from "../lib/platform";

const router: IRouter = Router();
router.use("/admin", requireMember, requireAdmin);
router.get("/admin/stats", async (_req, res): Promise<void> => {
  const [users, activeSubscriptions, earned, sales, pendingDeposits, pendingWithdrawals, reserved] = await Promise.all([
    prisma.member.count(), prisma.subscription.count({where: {mode: "live", expiresAt: {gt: new Date()}}}),
    prisma.member.aggregate({_sum: {realEarnedCents: true}}),
    prisma.deposit.aggregate({where: {status: "approved"}, _sum: {amountCents: true}}),
    prisma.deposit.count({where: {status: "pending"}}),
    prisma.withdrawal.count({where: {mode: "live", status: {in: ["pending", "processing"]}}}),
    prisma.withdrawal.aggregate({where: {mode: "live", status: {in: ["pending", "processing"]}}, _sum: {amountCents: true}}),
  ]);
  res.json(V.GetAdminStatsResponse.parse({users, activeSubscriptions, totalEarned: money(earned._sum.realEarnedCents ?? 0),
    annualSales: money(sales._sum.amountCents ?? 0), pendingDeposits, pendingWithdrawals, reservedBalance: money(reserved._sum.amountCents ?? 0)}));
});
router.get("/admin/users", async (_req, res): Promise<void> => {
  res.json(V.ListUsersResponse.parse((await prisma.member.findMany({orderBy: {createdAt: "desc"}, take: 1000})).map(userView)));
});
router.patch("/admin/users/:id", async (req, res): Promise<void> => {
  const {id} = input(V.UpdateUserParams, req.params);
  const data = input(V.UpdateUserBody, req.body);
  const user = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Member" WHERE id = ${id} FOR UPDATE`;
    const existing = await tx.member.findUnique({where: {id}});
    if (!existing) throw new HttpError(404, "لم يتم العثور على العضو.");
    if (existing.phone.startsWith("deleted:")) throw new HttpError(409, "بيانات هذا العضو أُخفيت ولا يمكن تعديلها.");
    if (id === req.member!.id && data.active === false) throw new HttpError(400, "لا يمكنك إيقاف حسابك الإداري.");
    const update: {name?: string; phone?: string; active?: boolean; payoutAddress?: string | null} = {};
    if (data.name !== undefined) {
      const name = data.name.trim();
      if (name.length < 2) throw new HttpError(400, "الاسم يجب أن يتكون من حرفين على الأقل.");
      update.name = name;
    }
    if (data.phone !== undefined) {
      const phone = normalizePhone(data.phone);
      const conflict = await tx.member.findUnique({where: {phone}});
      if (conflict && conflict.id !== id) throw new HttpError(409, "رقم الهاتف مستخدم لحساب آخر.");
      update.phone = phone;
    }
    if (data.payoutAddress !== undefined) {
      if (data.payoutAddress === null && existing.payoutAddress) {
        throw new HttpError(400, "لا يمكن إزالة عنوان محفوظ؛ أدخل عنوان Polygon آخر لتغييره.");
      }
      const payoutAddress = data.payoutAddress?.trim().toLowerCase() || null;
      if (payoutAddress && !validAddress(payoutAddress)) throw new HttpError(400, "أدخل عنوان Polygon صحيحاً؛ لا يمكن حذف عنوان محفوظ.");
      if (payoutAddress) {
        const conflict = await tx.member.findUnique({where: {payoutAddress}, select: {id: true}});
        if (conflict && conflict.id !== id) throw new HttpError(409, "عنوان المحفظة مرتبط بحساب آخر.");
      }
      update.payoutAddress = payoutAddress;
    }
    if (data.active !== undefined) update.active = data.active;
    if (!Object.keys(update).length) throw new HttpError(400, "لم تُرسل أي بيانات لتعديلها.");
    const result = await tx.member.update({where: {id}, data: update});
    if (update.active === false) await tx.session.deleteMany({where: {memberId: id}});
    await tx.audit.create({data: {
      actorId: req.member!.id,
      action: update.active !== undefined && Object.keys(update).length === 1 ? "user_status" : "user_profile_update",
      targetId: id,
      detail: JSON.stringify(update),
    }});
    return result;
  });
  res.json(V.UpdateUserResponse.parse(userView(user)));
});
router.put("/admin/users/:id/password", async (req, res): Promise<void> => {
  const {id} = input(V.UpdateUserPasswordParams, req.params);
  const {password} = input(V.UpdateUserPasswordBody, req.body);
  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Member" WHERE id = ${id} FOR UPDATE`;
    const member = await tx.member.findUnique({where: {id}});
    if (!member) throw new HttpError(404, "لم يتم العثور على العضو.");
    if (member.phone.startsWith("deleted:")) throw new HttpError(409, "بيانات هذا العضو أُخفيت ولا يمكن تعديلها.");
    await tx.member.update({where: {id}, data: {passwordHash}});
    await tx.session.deleteMany({where: {memberId: id}});
    await tx.audit.create({data: {actorId: req.member!.id, action: "user_password_reset", targetId: id, detail: JSON.stringify({sessionsRevoked: true})}});
  });
  res.json(V.UpdateUserPasswordResponse.parse({message: "تم تغيير كلمة المرور وإنهاء الجلسات الحالية."}));
});
router.post("/admin/users/:id/balance", async (req, res): Promise<void> => {
  const {id} = input(V.AdjustUserBalanceParams, req.params);
  const data = input(V.AdjustUserBalanceBody, req.body);
  const amountCents = cents(data.amount);
  if (amountCents <= 0) throw new HttpError(400, "يجب أن يكون المبلغ أكبر من صفر.");
  const user = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Member" WHERE id = ${id} FOR UPDATE`;
    const member = await tx.member.findUnique({where: {id}});
    if (!member) throw new HttpError(404, "لم يتم العثور على العضو.");
    if (member.phone.startsWith("deleted:")) throw new HttpError(409, "لا يمكن تعديل رصيد عضو أُخفيت بياناته.");
    if (data.direction === "debit" && amountCents > member.realBalanceCents) {
      throw new HttpError(400, "لا يمكن سحب مبلغ أكبر من الرصيد المتاح.");
    }
    const after = member.realBalanceCents + (data.direction === "credit" ? amountCents : -amountCents);
    const updated = await tx.member.update({
      where: {id},
      data: {realBalanceCents: data.direction === "credit" ? {increment: amountCents} : {decrement: amountCents}},
    });
    const reason = data.reason.trim();
    const signedAmount = data.direction === "credit" ? amountCents : -amountCents;
    await tx.activity.create({data: {
      memberId: id,
      mode: "live",
      kind: "adjustment",
      title: `${data.direction === "credit" ? "إضافة رصيد إدارية" : "سحب رصيد إداري"}: ${reason}`,
      amountCents: signedAmount,
    }});
    await tx.audit.create({data: {
      actorId: req.member!.id,
      action: "balance_adjustment",
      targetId: id,
      detail: JSON.stringify({direction: data.direction, amountCents, beforeCents: member.realBalanceCents, afterCents: after, reason}),
    }});
    return updated;
  });
  res.json(V.AdjustUserBalanceResponse.parse(userView(user)));
});
router.delete("/admin/users/:id", async (req, res): Promise<void> => {
  const {id} = input(V.DeleteUserParams, req.params);
  const replacementPassword = await hashPassword(randomBytes(48).toString("base64url"));
  const user = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Member" WHERE id = ${id} FOR UPDATE`;
    const member = await tx.member.findUnique({where: {id}});
    if (!member) throw new HttpError(404, "لم يتم العثور على العضو.");
    if (member.role === "admin" || id === req.member!.id) throw new HttpError(403, "لا يمكن إزالة حساب إداري.");
    if (member.phone.startsWith("deleted:")) throw new HttpError(409, "تم إخفاء بيانات هذا العضو مسبقًا.");
    const anonymized = await tx.member.update({
      where: {id},
      data: {name: "عضو محذوف", phone: `deleted:${id}`, passwordHash: replacementPassword, payoutAddress: null, active: false},
    });
    await tx.session.deleteMany({where: {memberId: id}});
    await tx.audit.create({data: {
      actorId: req.member!.id,
      action: "user_anonymized",
      targetId: id,
      detail: JSON.stringify({personalData: "anonymized", financialHistory: "preserved"}),
    }});
    return anonymized;
  });
  res.json(V.DeleteUserResponse.parse(userView(user)));
});
router.patch("/admin/users/:id/honor", async (req, res): Promise<void> => {
  const {id} = input(V.UpdateHonorParams, req.params);
  const data = input(V.UpdateHonorBody, req.body);
  if (data.reason.trim().length < 3) throw new HttpError(400, "يرجى توضيح سبب تعديل النقاط.");
  const user = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Member" WHERE id = ${id} FOR UPDATE`;
    const previous = await tx.member.findUniqueOrThrow({where: {id}});
    const result = await tx.member.update({where: {id}, data: {honorPoints: data.points}});
    await tx.activity.create({data: {memberId: id, mode: "live", kind: "honor", title: `تعديل نقاط الشرف إلى ${data.points}: ${data.reason.trim()}`}});
    await tx.audit.create({data: {actorId: req.member!.id, action: "honor_adjustment", targetId: id, detail: JSON.stringify({before: previous.honorPoints, ...data})}});
    return result;
  });
  res.json(V.UpdateHonorResponse.parse(userView(user)));
});
router.get("/admin/plans", async (_req, res): Promise<void> => {
  res.json(V.ListAdminPlansResponse.parse((await prisma.plan.findMany({orderBy: {annualPriceCents: "asc"}})).map(planView)));
});
const planData = (data: ReturnType<typeof V.CreatePlanBody.parse>) => {
  if (data.name.trim().length < 2) throw new HttpError(400, "أدخل اسم الباقة.");
  return {name: data.name.trim(), description: data.description.trim(), annualPriceCents: cents(data.annualPrice),
    dailyTasks: 0, taskRewardCents: 0, dailyProfitCents: cents(data.dailyProfit), active: data.active, configured: true};
};
router.post("/admin/plans", async (req, res): Promise<void> => {
  const data = planData(input(V.CreatePlanBody, req.body));
  const plan = await prisma.$transaction(async tx => {
    const created = await tx.plan.create({data});
    await tx.audit.create({data: {actorId: req.member!.id, action: "plan_create", targetId: created.id, detail: JSON.stringify(data)}});
    return created;
  });
  res.json(V.CreatePlanResponse.parse(planView(plan)));
});
router.put("/admin/plans/:id", async (req, res): Promise<void> => {
  const {id} = input(V.UpdatePlanParams, req.params);
  const data = planData(input(V.UpdatePlanBody, req.body));
  const plan = await prisma.$transaction(async tx => {
    const updated = await tx.plan.update({where: {id}, data});
    await tx.audit.create({data: {actorId: req.member!.id, action: "plan_update", targetId: id, detail: JSON.stringify(data)}});
    return updated;
  });
  res.json(V.UpdatePlanResponse.parse(planView(plan)));
});
router.put("/admin/settings", async (req, res): Promise<void> => {
  const data = input(V.UpdateSettingsBody, req.body);
  data.telegramUrl = data.telegramUrl.trim();
  data.binanceAddress = data.binanceAddress.trim();
  data.okxAddress = data.okxAddress.trim();
  data.fundingDescription = data.fundingDescription.trim();
  data.terms = data.terms.trim();
  for (const address of [data.binanceAddress, data.okxAddress]) {
    if (address && !validAddress(address)) throw new HttpError(400, "أدخل عنوان Polygon صالحاً يبدأ بـ 0x أو اترك الحقل فارغاً.");
  }
  if (data.depositsEnabled && (!(data.binanceAddress || data.okxAddress) || data.fundingDescription.length < 20 || data.terms.length < 20)) {
    throw new HttpError(400, "لتفعيل الإيداعات: أضف عنوان استقبال واحداً على الأقل ومصدر تمويل وشروطاً واضحة (20 حرفاً على الأقل لكل منهما).");
  }
  if (data.telegramUrl && !/^https:\/\/t\.me\/[A-Za-z][A-Za-z0-9_]{3,31}$/.test(data.telegramUrl)) {
    throw new HttpError(400, "أدخل رابط دعم صحيحاً بصيغة https://t.me/username أو اتركه فارغاً.");
  }
  await prisma.$transaction(async tx => {
    await tx.setting.upsert({where: {id: "main"}, create: {id: "main", ...data}, update: data});
    await tx.audit.create({data: {actorId: req.member!.id, action: "settings_update", targetId: "main", detail: JSON.stringify(data)}});
  });
  res.json(V.UpdateSettingsResponse.parse(await settings()));
});
export default router;