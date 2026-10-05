import express, { Router, type IRouter } from "express";
import * as V from "@workspace/api-zod";
import { prisma } from "../lib/prisma";
import { requireMember } from "../lib/auth";
import { HttpError, input } from "../lib/http";
import { lockMember } from "../lib/platform";
import { MAX_RECEIPT_SIZE, storage } from "../lib/receipts";
const router: IRouter = Router();
const receiptContentTypes = ["image/png", "image/jpeg", "image/webp"] as const;
const parseReceiptContent = express.raw({type: [...receiptContentTypes], limit: MAX_RECEIPT_SIZE});

router.post("/receipts/upload", requireMember, async (req, res) => {
  const data = input(V.RequestReceiptUploadBody, req.body);
  // Enforce quotas before signing an upload URL.
  const ticket = await prisma.$transaction(async tx => {
    await lockMember(tx, req.member!.id);
    const count = await tx.receiptUpload.count({where: {memberId: req.member!.id, createdAt: {gte: new Date(Date.now() - 86400_000)}}});
    if (count >= 20) throw new HttpError(429, "بلغت حد رفع الصور اليومي.");
    if (!await tx.deposit.findFirst({where: {memberId: req.member!.id, status: "awaiting_receipt"}})) throw new HttpError(400, "أنشئ طلب إيداع أولاً.");
    const uploadUrl = await storage.getObjectEntityUploadURL();
    const upload = await tx.receiptUpload.create({data: {memberId: req.member!.id, objectPath: storage.normalizeObjectEntityPath(uploadUrl), contentType: data.contentType, size: data.size}});
    return {uploadId: upload.id, uploadUrl};
  }, {timeout: 35000});
  res.json(V.RequestReceiptUploadResponse.parse(ticket));
});

router.put("/receipts/upload/:id/content", requireMember, (req, res, next) => {
  parseReceiptContent(req, res, (error?: Error) => {
    if (error) {
      next(new HttpError(413, "يجب ألا يتجاوز حجم صورة الإيصال 5 ميغابايت."));
      return;
    }
    next();
  });
}, async (req, res): Promise<void> => {
  const {id} = input(V.UploadReceiptBytesParams, req.params);
  const upload = await prisma.receiptUpload.findUnique({where: {id}});
  if (!upload || upload.memberId !== req.member!.id) throw new HttpError(404, "طلب رفع الصورة غير موجود.");
  if (upload.used) throw new HttpError(409, "تم استخدام صورة هذا الطلب بالفعل.");
  if (Date.now() - upload.createdAt.getTime() > 30 * 60_000) throw new HttpError(400, "انتهت مهلة رفع الوصل، يرجى رفعه مجدداً.");

  const content = req.body;
  const contentType = (req.get("content-type") ?? "").split(";", 1)[0]!.trim().toLowerCase();
  if (!Buffer.isBuffer(content) || !receiptContentTypes.includes(contentType as (typeof receiptContentTypes)[number])) {
    throw new HttpError(400, "أرسل صورة PNG أو JPEG أو WebP صالحة.");
  }
  if (contentType !== upload.contentType || content.length !== upload.size) {
    throw new HttpError(400, "حجم الصورة أو نوعها لا يطابق بيانات الرفع.");
  }

  await storage.saveObjectEntityFile(upload.objectPath, content, upload.contentType);
  res.json(V.UploadReceiptBytesResponse.parse({stored: true}));
});

router.get("/receipts/:id", requireMember, async (req, res) => {
  const id = String(req.params.id);
  const upload = await prisma.receiptUpload.findUnique({where: {id}});
  if (!upload?.used || !upload.finalPath || (req.member!.id !== upload.memberId && req.member!.role !== "admin")) throw new HttpError(404, "الصورة غير متاحة.");
  const file = await storage.getObjectEntityFile(upload.finalPath);
  res.setHeader("Content-Type", upload.contentType);
  res.setHeader("Content-Disposition", "inline");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Content-Security-Policy", "default-src 'none'");
  file.createReadStream().on("error", () => { if (!res.headersSent) res.sendStatus(404); else res.destroy(); }).pipe(res);
});
export default router;