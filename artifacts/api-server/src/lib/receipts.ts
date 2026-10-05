import { randomUUID } from "node:crypto";
import { ObjectStorageService, objectStorageClient } from "./objectStorage";
import { prisma } from "./prisma";
import { HttpError } from "./http";
export const storage = new ObjectStorageService();
export const MAX_RECEIPT_SIZE = 5 * 1024 * 1024;

// Freeze the validated generation to a different key: the browser's signed PUT
// can never overwrite the evidence an admin reviews.
export async function freezeReceipt(uploadId: string, memberId: string): Promise<string> {
  const upload = await prisma.receiptUpload.findUnique({where: {id: uploadId}});
  if (!upload || upload.memberId !== memberId || upload.used) throw new HttpError(400, "صورة الوصل غير متاحة لهذا الطلب.");
  if (Date.now() - upload.createdAt.getTime() > 30 * 60_000) throw new HttpError(400, "انتهت مهلة رفع الوصل، يرجى رفعه مجدداً.");
  const file = await storage.getObjectEntityFile(upload.objectPath).catch(() => { throw new HttpError(400, "لم يكتمل رفع الصورة."); });
  const [metadata] = await file.getMetadata();
  const size = Number(metadata.size);
  if (!size || size > MAX_RECEIPT_SIZE || size !== upload.size || metadata.contentType !== upload.contentType) throw new HttpError(400, "حجم الصورة أو نوعها لا يطابق بيانات الرفع.");
  const version = objectStorageClient.bucket(file.bucket.name).file(file.name, {generation: Number(metadata.generation)});
  const [header] = await version.download({start: 0, end: 15});
  const detected = header.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? "image/png"
    : header[0] === 255 && header[1] === 216 && header[2] === 255 ? "image/jpeg"
    : header.toString("ascii", 0, 4) === "RIFF" && header.toString("ascii", 8, 12) === "WEBP" ? "image/webp" : "";
  if (detected !== upload.contentType) throw new HttpError(400, "الملف ليس صورة PNG أو JPEG أو WebP صالحة.");
  const suffix = `receipts/${randomUUID()}`;
  const originalSuffix = upload.objectPath.slice("/objects/".length);
  const base = file.name.slice(0, -originalSuffix.length);
  await version.copy(objectStorageClient.bucket(file.bucket.name).file(base + suffix), {preconditionOpts: {ifGenerationMatch: 0}});
  return `/objects/${suffix}`;
}