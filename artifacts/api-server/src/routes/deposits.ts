import { Router, type IRouter } from "express";
import * as V from "@workspace/api-zod";
import { prisma } from "../lib/prisma";
import { requireMember } from "../lib/auth";
import { HttpError, input } from "../lib/http";
import { FREE_PLAN_ID, FREE_PLAN_VERIFICATION_DEPOSIT_CENTS, lockMember, validAddress } from "../lib/platform";
import { depositView } from "../lib/finance";
import { freezeReceipt } from "../lib/receipts";
const router: IRouter = Router();
router.get("/deposits", requireMember, async (req, res) => {
  const rows = await prisma.deposit.findMany({where: {memberId: req.member!.id}, include: {member: true}, orderBy: {createdAt: "desc"}, take: 100});
  res.json(V.ListDepositsResponse.parse(rows.map(depositView)));
});
router.post("/deposits", requireMember, async (req, res) => {
  const data = input(V.CreateDepositBody, req.body);
  if (data.acceptedTerms !== true) throw new HttpError(400, "يجب الاطلاع على شروط الباقة والموافقة عليها.");
  const deposit = await prisma.$transaction(async tx => {
    await lockMember(tx, req.member!.id);
    const settings = await tx.setting.findUnique({where: {id: "main"}});
    const address = data.channel === "binance" ? settings?.binanceAddress : settings?.okxAddress;
    if (!settings?.depositsEnabled || !address || !validAddress(address) || !settings.terms.trim() || !settings.fundingDescription.trim()) {
      throw new HttpError(403, "الإيداعات غير متاحة حتى تُكمل الإدارة إعداد العناوين والشروط.");
    }
    const plan = await tx.plan.findUnique({where: {id: data.planId}});
    const isFreeVerification = plan?.id === FREE_PLAN_ID;
    if (!plan?.active || !plan.configured || (!isFreeVerification && plan.annualPriceCents <= 0) ||
      (isFreeVerification && plan.annualPriceCents !== 0)) throw new HttpError(400, "الباقة غير مهيأة للاشتراك.");
    if (await tx.subscription.findFirst({where: {memberId: req.member!.id, mode: "live", expiresAt: {gt: new Date()}}})) throw new HttpError(409, "لديك اشتراك نشط بالفعل.");
    if (await tx.deposit.findFirst({where: {memberId: req.member!.id, status: {in: ["awaiting_receipt", "pending"]}}})) throw new HttpError(409, "لديك طلب إيداع مفتوح، أكمله أولاً.");
    const amountCents = isFreeVerification ? FREE_PLAN_VERIFICATION_DEPOSIT_CENTS : plan.annualPriceCents;
    return tx.deposit.create({data: {memberId: req.member!.id, planId: plan.id, planName: plan.name, planDescription: plan.description,
      amountCents, dailyProfitCents: plan.dailyProfitCents, channel: data.channel, address,
      terms: settings.terms, fundingDescription: settings.fundingDescription}, include: {member: true}});
  });
  res.json(V.CreateDepositResponse.parse(depositView(deposit)));
});
router.post("/deposits/:id/proof", requireMember, async (req, res) => {
  const {id} = input(V.SubmitDepositProofParams, req.params);
  const data = input(V.SubmitDepositProofBody, req.body);
  const original = await prisma.deposit.findFirst({where: {id, memberId: req.member!.id, status: "awaiting_receipt"}});
  if (!original) throw new HttpError(409, "الطلب غير متاح لإرسال وصل.");
  const finalPath = await freezeReceipt(data.uploadId, req.member!.id);
  const deposit = await prisma.$transaction(async tx => {
    await lockMember(tx, req.member!.id);
    const current = await tx.deposit.findFirst({where: {id, memberId: req.member!.id}});
    if (current?.status !== "awaiting_receipt") throw new HttpError(409, "تم إرسال الوصل أو إغلاق الطلب بالفعل.");
    const upload = await tx.receiptUpload.findUnique({where: {id: data.uploadId}});
    if (!upload || upload.memberId !== req.member!.id || upload.used) throw new HttpError(409, "صورة الوصل مستخدمة بالفعل.");
    await tx.receiptUpload.update({where: {id: upload.id}, data: {used: true, finalPath}});
    const updated = await tx.deposit.update({where: {id}, data: {receiptUploadId: upload.id, status: "pending"}, include: {member: true}});
    await tx.activity.create({data: {memberId: req.member!.id, mode: "live", kind: "deposit", title: "تم إرسال صورة إيصال الإيداع، بانتظار التحقق اليدوي"}});
    return updated;
  });
  res.json(V.SubmitDepositProofResponse.parse(depositView(deposit)));
});
router.post("/deposits/:id/cancel", requireMember, async (req, res) => {
  const {id} = input(V.CancelDepositParams, req.params);
  const deposit = await prisma.$transaction(async tx => {
    await lockMember(tx, req.member!.id);
    const current = await tx.deposit.findFirst({where: {id, memberId: req.member!.id}});
    if (current?.status !== "awaiting_receipt") throw new HttpError(409, "لا يمكن إلغاء طلب تمت مراجعته أو إرسال وصله.");
    return tx.deposit.update({where: {id}, data: {status: "cancelled"}, include: {member: true}});
  });
  res.json(V.CancelDepositResponse.parse(depositView(deposit)));
});
export default router;