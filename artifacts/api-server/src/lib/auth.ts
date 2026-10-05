import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";
import type { Request, Response, NextFunction } from "express";
import type { Member } from "@prisma/client";
import { prisma } from "./prisma";
import { HttpError } from "./http";

const scrypt = promisify(scryptCallback);
const COOKIE = "irtiqa_session";
const SESSION_MS = 7 * 86400_000;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

declare global {
  namespace Express { interface Request { member?: Member } }
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/[٠-٩]/g, digit => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[\s()-]/g, "").replace(/^00/, "+");
  if (!/^\+?[0-9]{10,15}$/.test(digits)) throw new HttpError(400, "أدخل رقم هاتف صحيحاً من 10 إلى 15 رقماً.");
  return digits;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded?: string): Promise<boolean> {
  const [salt, stored] = (encoded ?? "00000000000000000000000000000000:" + "00".repeat(64)).split(":");
  const hash = await scrypt(password, salt!, 64) as Buffer;
  const expected = Buffer.from(stored!, "hex");
  return hash.length === expected.length && timingSafeEqual(hash, expected) && !!encoded;
}

export async function startSession(req: Request, res: Response, memberId: string): Promise<void> {
  const previous = req.cookies?.[COOKIE];
  if (typeof previous === "string") await prisma.session.deleteMany({where: {tokenHash: digest(previous)}});
  const token = randomBytes(32).toString("base64url");
  await prisma.session.create({data: {tokenHash: digest(token), memberId, expiresAt: new Date(Date.now() + SESSION_MS)}});
  res.cookie(COOKIE, token, {httpOnly: true, sameSite: "lax", secure: req.secure || process.env.NODE_ENV === "production", path: "/api", maxAge: SESSION_MS});
}

export async function endSession(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[COOKIE];
  if (typeof token === "string") await prisma.session.deleteMany({where: {tokenHash: digest(token)}});
  res.clearCookie(COOKIE, {path: "/api", httpOnly: true, sameSite: "lax", secure: req.secure || process.env.NODE_ENV === "production"});
}

export async function loadSession(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.[COOKIE];
  if (typeof token === "string" && token.length < 100) {
    const session = await prisma.session.findUnique({where: {tokenHash: digest(token)}, include: {member: true}});
    if (session && session.expiresAt.getTime() > Date.now() && session.member.active) req.member = session.member;
  }
  next();
}

export function requireMember(req: Request, _res: Response, next: NextFunction): void {
  if (!req.member) throw new HttpError(401, "يرجى تسجيل الدخول للمتابعة.");
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.member?.role !== "admin") throw new HttpError(403, "هذه الصفحة مخصصة للإدارة.");
  next();
}

export function sameOrigin(req: Request, _res: Response, next: NextFunction): void {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const contentType = (req.get("content-type") ?? "").split(";", 1)[0]!.trim().toLowerCase();
    const path = req.originalUrl.split("?")[0];
    const isReceiptImageUpload = req.method === "PUT" &&
      /^\/api\/receipts\/upload\/[^/]+\/content$/.test(path) &&
      ["image/png", "image/jpeg", "image/webp"].includes(contentType);
    if (contentType && !req.is("application/json") && !isReceiptImageUpload) {
      throw new HttpError(415, "نوع الطلب غير مدعوم.");
    }
    const origin = req.get("origin");
    const host = req.get("x-forwarded-host")?.split(",")[0]?.trim() || req.get("host");
    if (req.get("sec-fetch-site") === "cross-site") throw new HttpError(403, "مصدر الطلب غير مسموح.");
    if (origin) {
      let originHost = "";
      try { originHost = new URL(origin).host; } catch { /* reject below */ }
      if (originHost !== host) throw new HttpError(403, "مصدر الطلب غير مسموح.");
    }
  }
  next();
}

export async function rateLimit(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const key = digest(`auth:${req.ip ?? "unknown"}:${Math.floor(Date.now() / 900_000)}`);
  const attempt = await prisma.authAttempt.upsert({
    where: {key}, create: {key, count: 1, expiresAt: new Date(Date.now() + 900_000)},
    update: {count: {increment: 1}},
  });
  if (attempt.count > 30) throw new HttpError(429, "محاولات كثيرة. يرجى الانتظار 15 دقيقة.");
  next();
}