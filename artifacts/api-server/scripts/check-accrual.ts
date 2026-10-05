import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { accrue, DAY } from "../src/lib/platform";
const id = randomUUID();
const now = new Date();
const start = new Date(now.getTime() - DAY * 2 - 1000);
try {
  await prisma.member.create({data: {id, phone: `test-${id}`, memberId: `test-${id}`, name: "Isolated accrual check", passwordHash: "disabled", balanceCents: 999999}});
  await prisma.plan.create({data: {id, name: "Isolated accrual check", description: "", annualPriceCents: 10000, dailyTasks: 0, taskRewardCents: 0}});
  await prisma.subscription.create({data: {id, memberId: id, planId: id, planName: "Check", planDescription: "", annualPriceCents: 10000, dailyTasks: 0, taskRewardCents: 0, dailyProfitCents: 125, startsAt: start, expiresAt: new Date(start.getTime() + DAY * 365), mode: "live"}});
  await Promise.all(Array.from({length: 5}, () => prisma.$transaction(tx => accrue(tx, id, now), {timeout: 15000})));
  assert.equal((await prisma.member.findUniqueOrThrow({where: {id}})).realBalanceCents, 250);
  assert.equal(await prisma.dailyCredit.count({where: {subscriptionId: id}}), 2);
  await prisma.$transaction(tx => accrue(tx, id, new Date(start.getTime() + 500 * DAY)));
  assert.equal(await prisma.dailyCredit.count({where: {subscriptionId: id}}), 365);
  assert.equal((await prisma.member.findUniqueOrThrow({where: {id}})).realBalanceCents, 365 * 125);
  await prisma.$transaction(tx => accrue(tx, id, new Date(start.getTime() + 600 * DAY)));
  assert.equal((await prisma.member.findUniqueOrThrow({where: {id}})).realBalanceCents, 365 * 125);
  console.log("PASS: concurrent accrual exactly once, catch-up, 365-day cap, legacy balance isolation.");
} finally {
  await prisma.dailyCredit.deleteMany({where: {subscriptionId: id}});
  await prisma.activity.deleteMany({where: {memberId: id}});
  await prisma.subscription.deleteMany({where: {memberId: id}});
  await prisma.member.deleteMany({where: {id}});
  await prisma.plan.deleteMany({where: {id}});
  await prisma.$disconnect();
}