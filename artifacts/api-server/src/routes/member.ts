import { Router, type IRouter } from "express";
import * as V from "@workspace/api-zod";
import { prisma } from "../lib/prisma";
import { requireMember } from "../lib/auth";
import { HttpError, input } from "../lib/http";
import { accrue, activityView, cents, dashboard, lockMember, MIN_WITHDRAWAL_CENTS, planView, settings, validAddress } from "../lib/platform";
import { withdrawalView } from "../lib/finance";
const router: IRouter = Router();
router.get("/team", requireMember, async (req, res) => {
  const user = await prisma.member.findUniqueOrThrow({where: {id: req.member!.id}});
  const members = await prisma.member.findMany({where: {inviterId: user.id}, orderBy: {createdAt: "desc"},
    select: {memberId: true, name: true, createdAt: true}});
  res.json(V.GetTeamResponse.parse({referralCode: user.referralCode,
    members: members.map(m => ({...m, createdAt: m.createdAt.toISOString()}))}));
});
router.get("/plans", async (_req, res) => {
  res.json(V.ListPlansResponse.parse((await prisma.plan.findMany({where: {active: true, configured: true}, orderBy: {annualPriceCents: "asc"}})).map(planView)));
});
router.get("/settings", async (_req, res) => { res.json(V.GetSettingsResponse.parse(await settings())); });
router.get("/dashboard", requireMember, async (req, res) => { res.json(V.GetDashboardResponse.parse(await dashboard(req.member!.id))); });
router.put("/payout-address", requireMember, async (req, res): Promise<void> => {
  const data = input(V.SavePayoutAddressBody, req.body);
  const address = data.address.trim().toLowerCase();
  if (!validAddress(address)) throw new HttpError(400, "أدخل عنوان Polygon صحيحاً.");
  const member = await prisma.$transaction(async tx => {
    const user = await lockMember(tx, req.member!.id);
    if (user.payoutAddress) throw new HttpError(409, "عنوان المحفظة محفوظ بالفعل؛ اطلب من الإدارة تغييره.");
    if (await tx.member.findUnique({where: {payoutAddress: address}, select: {id: true}})) {
      throw new HttpError(409, "عنوان المحفظة مرتبط بحساب آخر.");
    }
    const updated = await tx.member.update({where: {id: user.id}, data: {payoutAddress: address}});
    await tx.audit.create({data: {actorId: user.id, action: "payout_address_set", targetId: user.id, detail: JSON.stringify({source: "member"})}});
    return updated;
  });
  res.json(V.SavePayoutAddressResponse.parse({address: member.payoutAddress!}));
});
router.get("/activity", requireMember, async (req, res) => {
  await prisma.$transaction(tx => accrue(tx, req.member!.id));
  const rows = await prisma.activity.findMany({where: {memberId: req.member!.id, mode: "live"}, orderBy: {createdAt: "desc"}, take: 100});
  res.json(V.ListActivityResponse.parse(rows.map(activityView)));
});
router.get("/withdrawals", requireMember, async (req, res) => {
  const rows = await prisma.withdrawal.findMany({where: {memberId: req.member!.id, mode: "live"}, include: {member: true}, orderBy: {createdAt: "desc"}, take: 100});
  res.json(V.ListWithdrawalsResponse.parse(rows.map(withdrawalView)));
});
router.post("/withdrawals", requireMember, async (req, res) => {
  const data = input(V.RequestWithdrawalBody, req.body);
  const amountCents = cents(data.amount);
  if (amountCents < MIN_WITHDRAWAL_CENTS) throw new HttpError(400, `الحد الأدنى للسحب ${MIN_WITHDRAWAL_CENTS / 100} USDT.`);
  const withdrawal = await prisma.$transaction(async tx => {
    await lockMember(tx, req.member!.id);
    const user = await accrue(tx, req.member!.id);
    if (!user.payoutAddress || !validAddress(user.payoutAddress)) throw new HttpError(403, "أضف عنوان محفظة Polygon أولاً.");
    if (await tx.withdrawal.findFirst({where: {memberId: user.id, mode: "live", status: {in: ["pending", "processing"]}}})) {
      throw new HttpError(409, "لديك طلب سحب قيد المعالجة بالفعل.");
    }
    if (amountCents > user.realBalanceCents) throw new HttpError(400, "الرصيد المتاح غير كافٍ.");
    await tx.member.update({where: {id: user.id}, data: {realBalanceCents: {decrement: amountCents}}});
    const created = await tx.withdrawal.create({data: {memberId: user.id, amountCents, address: user.payoutAddress, status: "pending", mode: "live"}, include: {member: true}});
    await tx.activity.create({data: {memberId: user.id, mode: "live", kind: "withdrawal", title: "حجز رصيد لطلب سحب قيد المراجعة", amountCents: -amountCents}});
    return created;
  });
  res.json(V.RequestWithdrawalResponse.parse(withdrawalView(withdrawal)));
});
// Retired simulation endpoints must not mint real balances.
router.post(["/subscriptions", "/tasks/:id/complete"], requireMember, () => { throw new HttpError(410, "يُفعّل الاشتراك بعد تأكيد الإيداع من الإدارة؛ لا توجد مكافآت مهام."); });
export default router;