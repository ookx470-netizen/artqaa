import { useEffect, useState } from "react";

export const FREE_PLAN_ID = "starter";
export const planDurationDays = (planId: string) => planId === FREE_PLAN_ID ? 180 : 365;
export const subscriptionDurationDays = (startsAt: string, expiresAt: string) =>
  Math.max(0, Math.round((new Date(expiresAt).getTime() - new Date(startsAt).getTime()) / 86_400_000));

export function apiError(err: unknown, fallback = "تعذر إتمام العملية، حاول مجددًا"): string {
  const e = err as { data?: { error?: unknown } | null; status?: number } | null;
  const msg = e?.data && typeof e.data === "object" ? e.data.error : undefined;
  if (typeof msg === "string" && msg.trim()) return msg;
  if (e?.status === 401) return "انتهت الجلسة، يرجى تسجيل الدخول";
  if (e?.status === 403) return "لا تملك صلاحية لهذا الإجراء";
  return fallback;
}

export const usdt = (n: number | undefined | null) =>
  `${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 }).format(Number(n ?? 0))} USDT`;

export const dateAr = (iso?: string | null, withTime = false) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-EG-u-nu-latn", {
    year: "numeric", month: "long", day: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(d);
};

export function useCountdown(iso?: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!iso) return null;
  const ms = Math.max(0, new Date(iso).getTime() - now);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  const p = (x: number) => String(x).padStart(2, "0");
  return { ms, text: `${p(h)}:${p(m)}:${p(s)}` };
}

export const statusAr: Record<string, string> = {
  awaiting_receipt: "بانتظار الإيصال", pending: "قيد المراجعة", approved: "معتمد", rejected: "مرفوض", cancelled: "ملغى", processing: "قيد التحويل", paid: "مدفوع",
};
export const kindAr: Record<string, string> = {
  accrual: "ربح يومي", daily_profit: "ربح يومي", task_reward: "مكافأة مهمة", subscription: "اشتراك", deposit: "إيداع", withdrawal: "سحب", withdrawal_refund: "استرداد سحب", refund: "استرداد", honor: "نقاط شرف", adjustment: "تعديل إداري",
};

export const isAddr = (s: string) => /^0x[a-fA-F0-9]{40}$/.test(s) && !/^0x0{40}$/.test(s);
export const isTx = (s: string) => /^0x[a-fA-F0-9]{64}$/.test(s);
export const shortHex = (s: string) => (s.length > 14 ? `${s.slice(0, 8)}...${s.slice(-6)}` : s);
