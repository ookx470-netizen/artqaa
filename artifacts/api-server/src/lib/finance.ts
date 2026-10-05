import type { Deposit, Withdrawal, Member } from "@prisma/client";
import { money } from "./platform";
export const depositView = (d: Deposit & {member: Member}) => ({
  id: d.id, memberId: d.memberId, memberName: d.member.name, planId: d.planId, planName: d.planName,
  amount: money(d.amountCents), dailyProfit: money(d.dailyProfitCents), channel: d.channel, address: d.address,
  status: d.status, txHash: d.txHash, receiptUrl: d.receiptUploadId ? `/api/receipts/${d.receiptUploadId}` : null,
  reviewNote: d.reviewNote, createdAt: d.createdAt.toISOString(), reviewedAt: d.reviewedAt?.toISOString() ?? null,
  terms: d.terms, fundingDescription: d.fundingDescription,
});
export const withdrawalView = (w: Withdrawal & {member: Member}) => ({
  id: w.id, memberId: w.memberId, memberName: w.member.name, amount: money(w.amountCents),
  status: w.status, address: w.address, txHash: w.txHash, reviewNote: w.reviewNote,
  createdAt: w.createdAt.toISOString(), reviewedAt: w.reviewedAt?.toISOString() ?? null,
});