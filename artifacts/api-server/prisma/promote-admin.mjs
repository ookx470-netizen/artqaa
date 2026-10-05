// Operator-only command. Never expose role assignment through public registration.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const phone = process.argv[2]?.replace(/[\s()-]/g, "").replace(/^00/, "+");
if (!phone) throw new Error("Provide the registered phone number as the argument.");
try {
  await prisma.$transaction(async tx => {
    const member = await tx.member.findUniqueOrThrow({where: {phone}});
    await tx.member.update({where: {id: member.id}, data: {role: "admin"}});
    await tx.audit.create({data: {actorId: "operator", action: "grant_admin", targetId: member.id, detail: "Explicit operator provisioning"}});
  });
} finally {
  await prisma.$disconnect();
}