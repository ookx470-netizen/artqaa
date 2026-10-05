import { Router, type IRouter } from "express";
import { randomBytes } from "node:crypto";
import * as V from "@workspace/api-zod";
import { prisma } from "../lib/prisma";
import { HttpError, input } from "../lib/http";
import { endSession, hashPassword, normalizePhone, rateLimit, startSession, verifyPassword } from "../lib/auth";
import { userView } from "../lib/platform";

const router: IRouter = Router();
router.get("/auth/session", (req, res) => {
  res.json(V.GetSessionResponse.parse({user: req.member ? userView(req.member) : null}));
});
router.post("/auth/register", rateLimit, async (req, res): Promise<void> => {
  const data = input(V.RegisterBody, req.body);
  const phone = normalizePhone(data.phone);
  const name = data.name.trim();
  if (name.length < 2) throw new HttpError(400, "يرجى إدخال الاسم الكامل.");
  const passwordHash = await hashPassword(data.password);
  const member = await prisma.$transaction(async tx => {
    // A transaction-level lock serializes suffix allocation and duplicate registration.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(748291)`;
    const referralCode = data.referralCode.trim().toLowerCase();
    if (!/^[a-z0-9]{6}$/.test(referralCode)) throw new HttpError(400, "يجب أن يتكوّن رمز الدعوة من 6 أحرف أو أرقام.");
    const inviter = await tx.member.findUnique({where: {referralCode}});
    if (!inviter?.active) throw new HttpError(400, "كود الدعوة غير صالح أو حساب صاحب الدعوة موقوف.");
    if (await tx.member.findUnique({where: {phone}})) throw new HttpError(409, "تعذر إنشاء الحساب بهذا الرقم. جرّب تسجيل الدخول.");
    const base = phone.slice(-5);
    let memberId = base;
    let suffix = 1;
    while (await tx.member.findUnique({where: {memberId}})) memberId = `${base}-${suffix++}`;
    let newCode = randomBytes(4).toString("hex").slice(0, 6);
    while (await tx.member.findUnique({where: {referralCode: newCode}})) newCode = randomBytes(4).toString("hex").slice(0, 6);
    const created = await tx.member.create({data: {name, phone, passwordHash, memberId, referralCode: newCode, inviterId: inviter.id, honorPoints: 0}});
    await tx.activity.create({data: {memberId: created.id, mode: "live", kind: "account", title: "مرحباً بك في ارتقاء — تم إنشاء حسابك"}});
    return created;
  });
  await startSession(req, res, member.id);
  res.json(V.RegisterResponse.parse({user: userView(member)}));
});
router.post("/auth/login", rateLimit, async (req, res): Promise<void> => {
  const data = input(V.LoginBody, req.body);
  const phone = normalizePhone(data.phone);
  const member = await prisma.member.findUnique({where: {phone}});
  const valid = await verifyPassword(data.password, member?.passwordHash);
  if (!member || !valid || !member.active) throw new HttpError(401, "بيانات الدخول غير صحيحة أو الحساب غير متاح.");
  await startSession(req, res, member.id);
  res.json(V.LoginResponse.parse({user: userView(member)}));
});
router.post("/auth/logout", async (req, res): Promise<void> => {
  await endSession(req, res);
  res.json(V.LogoutResponse.parse({message: "تم تسجيل الخروج."}));
});
export default router;