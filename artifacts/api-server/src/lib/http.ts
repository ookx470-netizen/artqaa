import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { ZodError, type ZodType } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function input<T>(schema: ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new HttpError(400, "يرجى التأكد من صحة الحقول المدخلة.");
  return parsed.data;
}

export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof HttpError) {
    res.status(error.status).json({error: error.message});
  } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = error.meta?.target;
    const targetText = Array.isArray(target) ? target.join(",") : String(target ?? "");
    res.status(409).json({error: targetText.includes("payoutAddress")
      ? "عنوان المحفظة مرتبط بحساب آخر."
      : "هذا السجل موجود بالفعل. يرجى تحديث الصفحة."});
  } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
    res.status(404).json({error: "لم يتم العثور على السجل المطلوب."});
  } else if (error instanceof ZodError) {
    req.log.error("Response validation failed");
    res.status(500).json({error: "تعذر معالجة البيانات. يرجى المحاولة لاحقاً."});
  } else {
    req.log.error({err: error}, "Request failed");
    res.status(500).json({error: "حدث خطأ غير متوقع. يرجى المحاولة لاحقاً."});
  }
}