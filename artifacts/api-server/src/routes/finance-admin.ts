import { Router, type IRouter } from "express";
import * as V from "@workspace/api-zod";
import { prisma } from "../lib/prisma";
import { requireAdmin, requireMember } from "../lib/auth";
import { HttpError, input } from "../lib/http";
import { DAY, FREE_PLAN_ID, accrue, planDurationDays, validHash } from "../lib/platform";
import { depositView, withdrawalView } from "../lib/finance";
const router: IRouter = Router();
router.use("/admin", requireMember, requireAdmin);
router.get("/admin/deposits", async (_req, res) => {
  const rows = await prisma.deposit.findMany({include: {member: true}, orderBy: {createdAt: "desc"}, take: 1000});
  res.json(V.ListAdminDepositsResponse.parse(rows.map(depositView)));
});
router.post("/admin/deposits/:id/review", async (req, res) => {
  const {id} = input(V.ReviewDepositParams, req.params);
  const data = input(V.ReviewDepositBody, req.body);
  if (data.decision === "approved" && !data.confirmed) throw new HttpError(400, "يجب التحقق فعلياً من وصول USDT على Polygon قبل الموافقة.");
  if (data.decision === "rejected" && data.note.trim().length < 3) throw new HttpError(400, "اذكر سبب رفض الإيداع.");
  const existing = await prisma.deposit.findUniqueOrThrow({where: {id}});
  const deposit = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Member" WHERE id = ${existing.memberId} FOR UPDATE`;
    const d = await tx.deposit.findUniqueOrThrow({where: {id}});
    if (d.status !== "pending") throw new HttpError(409, "هذا الطلب ليس قيد المراجعة أو تمت معالجته سابقاً.");
    if (data.decision === "approved") {
      const member = await tx.member.findUniqueOrThrow({where: {id: d.memberId}});
      if (!member.active) throw new HttpError(409, "أعد تفعيل الحساب قبل الموافقة على إيداعه.");
      if (!d.receiptUploadId) throw new HttpError(400, "صورة إيصال الإيداع غير موجودة.");
      if (await tx.subscription.findFirst({where: {memberId: d.memberId, mode: "live", expiresAt: {gt: new Date()}}})) throw new HttpError(409, "يوجد اشتراك نشط لهذا العضو.");
      const now = new Date();
      const durationDays = planDurationDays(d.planId);
      await tx.subscription.create({data: {memberId: d.memberId, planId: d.planId, planName: d.planName,
        planDescription: d.planDescription, annualPriceCents: d.planId === FREE_PLAN_ID ? 0 : d.amountCents, dailyTasks: 0, taskRewardCents: 0,
        dailyProfitCents: d.dailyProfitCents, startsAt: now, expiresAt: new Date(now.getTime() + DAY * durationDays), lastCreditedDay: -1, mode: "live"}});
      await tx.member.update({where: {id: d.memberId}, data: {honorPoints: 100}});
      await accrue(tx, d.memberId, now);
      await tx.activity.create({data: {memberId: d.memberId, mode: "live", kind: "subscription", title: `تم التحقق اليدوي من الإيداع وتفعيل باقة ${d.planName} لمدة ${durationDays} يوماً`}});
    } else {
      await tx.activity.create({data: {memberId: d.memberId, mode: "live", kind: "deposit", title: `رُفض الإيداع: ${data.note.trim()}`}});
    }
    await tx.audit.create({data: {actorId: req.member!.id, action: "deposit_review", targetId: id, detail: JSON.stringify(data)}});
    return tx.deposit.update({where: {id}, data: {status: data.decision, reviewNote: data.note.trim(), reviewedAt: new Date(), reviewerId: req.member!.id}, include: {member: true}});
  });
  res.json(V.ReviewDepositResponse.parse(depositView(deposit)));
});
router.get("/admin/withdrawals", async (_req, res) => {
  const rows = await prisma.withdrawal.findMany({where: {mode: "live"}, include: {member: true}, orderBy: {createdAt: "desc"}, take: 1000});
  res.json(V.ListAdminWithdrawalsResponse.parse(rows.map(withdrawalView)));
});
router.post("/admin/withdrawals/:id/review", async (req, res) => {
  const {id} = input(V.ReviewWithdrawalParams, req.params);
  const data = input(V.ReviewWithdrawalBody, req.body);
  const hash = data.txHash.trim().toLowerCase();
  if (data.decision === "paid" && (!data.confirmed || !validHash(hash))) throw new HttpError(400, "حوّل المبلغ فعلياً ثم أكد العملية وأدخل معرّف التحويل على Polygon.");
  if (data.decision === "rejected" && data.note.trim().length < 3) throw new HttpError(400, "اذكر سبب رفض السحب.");
  const existing = await prisma.withdrawal.findUniqueOrThrow({where: {id}});
  const withdrawal = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Member" WHERE id = ${existing.memberId} FOR UPDATE`;
    const w = await tx.withdrawal.findUniqueOrThrow({where: {id}});
    if (w.mode !== "live" || !["pending", "processing"].includes(w.status)) throw new HttpError(409, "طلب السحب مغلق أو غير صالح.");
    if (data.decision === "processing" && w.status !== "pending") throw new HttpError(409, "طلب السحب قيد التنفيذ بالفعل.");
    if (data.decision !== "processing" && w.status === "processing" && w.reviewerId !== req.member!.id) {
      throw new HttpError(409, "هذا السحب محجوز لمسؤول آخر؛ يجب أن يكمل المسؤول نفسه إجراءه لتجنب تحويله مرتين.");
    }
    if (data.decision === "paid" && w.status !== "processing") throw new HttpError(409, "ابدأ معالجة الطلب قبل تسجيل التحويل الفعلي.");
    if (data.decision === "paid" && await tx.withdrawal.findUnique({where: {txHash: hash}})) throw new HttpError(409, "معرّف التحويل مستخدم لطلب آخر.");
    if (data.decision === "rejected") {
      await tx.member.update({where: {id: w.memberId}, data: {realBalanceCents: {increment: w.amountCents}}});
      await tx.activity.create({data: {memberId: w.memberId, mode: "live", kind: "refund", title: `إعادة الرصيد بعد رفض السحب: ${data.note.trim()}`, amountCents: w.amountCents}});
    }
    if (data.decision === "paid") await tx.activity.create({data: {memberId: w.memberId, mode: "live", kind: "payout", title: "سُجّل تحويل السحب من الإدارة — تحقق من معرّف المعاملة"}});
    await tx.audit.create({data: {actorId: req.member!.id, action: "withdrawal_review", targetId: id, detail: JSON.stringify(data)}});
    return tx.withdrawal.update({where: {id}, data: {status: data.decision, reviewerId: req.member!.id,
      reviewedAt: new Date(), reviewNote: data.note.trim(), ...(data.decision === "paid" ? {txHash: hash} : {})}, include: {member: true}});
  });
  res.json(V.ReviewWithdrawalResponse.parse(withdrawalView(withdrawal)));
});
export default router;