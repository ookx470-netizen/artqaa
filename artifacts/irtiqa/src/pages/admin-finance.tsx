import { useState, type FormEvent } from "react";
import { ExternalLink, ImageIcon, Inbox } from "lucide-react";
import {
  useListAdminDeposits, getListAdminDepositsQueryKey, useReviewDeposit,
  useListAdminWithdrawals, getListAdminWithdrawalsQueryKey, useReviewWithdrawal, type Deposit, type Withdrawal,
} from "@workspace/api-client-react";
import { Skel, ErrorBox } from "@/components/brand";
import { StatusPill } from "@/pages/member";
import { useToast } from "@/hooks/use-toast";
import { apiError, usdt, dateAr, isTx } from "@/lib/helpers";
import { useInvalidateAll, live } from "@/lib/invalidate";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const Empty = ({ t }: { t: string }) => (
  <div className="glass rounded-3xl p-6 text-center text-muted-foreground sm:p-12">
    <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full border border-dashed border-border"><Inbox className="h-5 w-5" /></div>{t}
  </div>
);

const txLink = (h: string, id: string) => (
  <a data-testid={`link-polygonscan-${id}`} href={`https://polygonscan.com/tx/${h}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary"><span className="num break-all">{h}</span><ExternalLink className="h-3 w-3 shrink-0" /></a>
);

function Filter<T extends string>({ value, onChange, opts }: { value: T; onChange: (v: T) => void; opts: [T, string][] }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {opts.map(([k, l]) => (
        <button key={k} data-testid={`filter-${k}`} onClick={() => onChange(k)} className={`rounded-full border px-3 py-1 text-xs ${value === k ? "border-[hsl(40_62%_68%/.5)] text-primary bg-[hsl(40_62%_68%/.08)]" : "border-border text-muted-foreground"}`}>{l}</button>
      ))}
    </div>
  );
}

export function DepositsReview({ enabled }: { enabled: boolean }) {
  const q = useListAdminDeposits({ query: { enabled, queryKey: getListAdminDepositsQueryKey(), ...live } });
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [target, setTarget] = useState<Deposit | null>(null);
  if (q.isLoading) return <div className="space-y-2">{[0, 1, 2].map((i) => <Skel key={i} className="h-28" />)}</div>;
  if (q.isError) return <ErrorBox onRetry={() => q.refetch()} />;
  const list = (q.data ?? []).filter((d) => filter === "all" || d.status === "pending");
  return (
    <>
      <Filter value={filter} onChange={(v) => setFilter(v === "pending" ? "pending" : "all")} opts={[["pending", "قيد المراجعة"], ["all", "كل الحالات"]]} />
      {!list.length ? <Empty t={filter === "pending" ? "لا توجد إيداعات بانتظار المراجعة." : "لا توجد إيداعات."} /> : (
        <div className="space-y-3">
          {list.map((d) => (
            <div key={d.id} data-testid={`card-admin-deposit-${d.id}`} className="glass rounded-2xl p-4 text-sm sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="font-display">{d.memberName} <span className="num text-xs text-primary">{d.memberId}</span></p>
                  <p className="text-xs text-muted-foreground mt-1">{d.planName} · {d.channel} · {dateAr(d.createdAt, true)}</p></div>
                <div className="flex items-center gap-3"><span className="num font-display text-lg">{usdt(d.amount)}</span><StatusPill status={d.status} /></div>
              </div>
              <div className="mt-3 grid gap-1.5 text-xs text-muted-foreground">
                <p>المستلم: <a href={`https://polygonscan.com/address/${encodeURIComponent(d.address)}#tokentxns`} target="_blank" rel="noreferrer" className="num break-all text-primary">{d.address}<ExternalLink className="mr-1 inline h-3 w-3" /></a></p>
                <p>ربح يومي في اللقطة: <span className="num">{usdt(d.dailyProfit)}</span></p>
                {d.receiptUrl && <a href={d.receiptUrl} target="_blank" rel="noreferrer" data-testid={`link-admin-receipt-${d.id}`} className="inline-flex items-center gap-1 text-primary"><ImageIcon className="h-3 w-3" />عرض الإيصال</a>}
                {d.reviewNote && <p>ملاحظة: {d.reviewNote}</p>}
              </div>
              {d.status === "pending" && <button data-testid={`button-review-deposit-${d.id}`} onClick={() => setTarget(d)} className="btn-gold mt-4 px-4 py-2 text-xs">مراجعة</button>}
            </div>
          ))}
        </div>
      )}
      <DepositDialog d={target} onClose={() => setTarget(null)} />
    </>
  );
}

function DepositDialog({ d, onClose }: { d: Deposit | null; onClose: () => void }) {
  const { toast } = useToast();
  const inv = useInvalidateAll();
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [err, setErr] = useState("");
  const close = () => { setNote(""); setConfirmed(false); setErr(""); onClose(); };
  const m = useReviewDeposit({
    mutation: {
      onSuccess: (r) => { toast({ title: r.status === "approved" ? "اعتُمد الإيداع وفُعّل الاشتراك" : "رُفض الإيداع" }); inv(); close(); },
      onError: (e) => setErr(apiError(e)),
    },
  });
  const act = (decision: "approved" | "rejected") => {
    setErr("");
    if (!d || m.isPending) return;
    if (decision === "approved" && !confirmed) return setErr("أكّد أنك تحققت يدويًا من وصول التحويل على الشبكة");
    if (decision === "rejected" && note.trim().length < 3) return setErr("اكتب سبب الرفض (3 أحرف على الأقل)");
    m.mutate({ id: d.id, data: { decision, note: note.trim(), confirmed: decision === "approved" ? confirmed : false } });
  };
  return (
    <Dialog open={!!d} onOpenChange={(o) => !o && close()}>
      <DialogContent dir="rtl" className="glass-strong border-border bg-transparent max-h-[90dvh] overflow-y-auto">
        <DialogHeader className="text-right sm:text-right"><DialogTitle className="font-display">مراجعة إيداع {d?.memberName}</DialogTitle></DialogHeader>
        {d && (
          <div className="space-y-4 text-sm">
            <dl className="grid gap-2 rounded-2xl border border-border p-4 text-xs">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">المبلغ المطلوب</dt><dd className="num">{usdt(d.amount)}</dd></div>
              <div><dt className="text-muted-foreground">المستلم</dt><dd><a href={`https://polygonscan.com/address/${encodeURIComponent(d.address)}#tokentxns`} target="_blank" rel="noreferrer" className="num break-all text-primary">{d.address}<ExternalLink className="mr-1 inline h-3 w-3" /></a></dd></div>
            </dl>
            {d.receiptUrl && <a href={d.receiptUrl} target="_blank" rel="noreferrer"><img src={d.receiptUrl} alt="الإيصال" className="max-h-64 w-full rounded-2xl border border-border object-contain" /></a>}
            <p className="text-xs text-muted-foreground">الإيصال وحده لا يثبت وصول الأموال. لا يوجد تحقق آلي؛ افتح سجل USDT لعنوان الاستلام على Polygonscan، وطابق وقت التحويل والمبلغ والحالة المؤكدة قبل الاعتماد.</p>
            <label className="flex items-start gap-3 rounded-xl border border-[hsl(40_62%_68%/.3)] p-3 text-xs cursor-pointer">
              <input data-testid="checkbox-deposit-confirm" type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[hsl(40_62%_68%)]" />
              تحققت يدويًا من سجل USDT المؤكد لهذا العنوان على Polygon، وطابقت المستلم والمبلغ ووقت التحويل.
            </label>
            <textarea data-testid="input-deposit-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} placeholder="ملاحظة (إلزامية عند الرفض)" className="field resize-none" />
            {err && <p className="text-sm text-[hsl(4_80%_76%)]">{err}</p>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button data-testid="button-approve-deposit" disabled={m.isPending || !confirmed} onClick={() => act("approved")} className="btn-gold py-3">{m.isPending ? "..." : d.planId === "starter" ? "اعتماد وتفعيل 180 يومًا" : "اعتماد وتفعيل 365 يومًا"}</button>
              <button data-testid="button-reject-deposit" disabled={m.isPending} onClick={() => act("rejected")} className="btn-ghost py-3 text-[hsl(4_80%_76%)]">رفض</button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function WithdrawalsReview({ enabled }: { enabled: boolean }) {
  const { toast } = useToast();
  const inv = useInvalidateAll();
  const q = useListAdminWithdrawals({ query: { enabled, queryKey: getListAdminWithdrawalsQueryKey(), ...live } });
  const [filter, setFilter] = useState<"open" | "all">("open");
  const [target, setTarget] = useState<Withdrawal | null>(null);
  const approval = useReviewWithdrawal({
    mutation: {
      onSuccess: () => { toast({title: "قُبل طلب السحب وأصبح قيد التحويل"}); inv(); },
      onError: (e) => toast({title: "تعذرت الموافقة", description: apiError(e), variant: "destructive"}),
    },
  });
  const approve = (w: Withdrawal) => {
    if (approval.isPending) return;
    approval.mutate({id: w.id, data: {decision: "processing", txHash: "", note: "", confirmed: false}});
  };
  if (q.isLoading) return <div className="space-y-2">{[0, 1, 2].map((i) => <Skel key={i} className="h-28" />)}</div>;
  if (q.isError) return <ErrorBox onRetry={() => q.refetch()} />;
  const list = (q.data ?? []).filter((w) => filter === "all" || w.status === "pending" || w.status === "processing");
  return (
    <>
      <Filter value={filter} onChange={(v) => setFilter(v === "open" ? "open" : "all")} opts={[["open", "مفتوحة"], ["all", "كل الحالات"]]} />
      {!list.length ? <Empty t={filter === "open" ? "لا توجد سحوبات مفتوحة." : "لا توجد سحوبات."} /> : (
        <div className="space-y-3">
          {list.map((w) => (
            <div key={w.id} data-testid={`card-admin-withdrawal-${w.id}`} className="glass rounded-2xl p-4 text-sm sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="font-display">{w.memberName} <span className="num text-xs text-primary">{w.memberId}</span></p><p className="text-xs text-muted-foreground mt-1">{dateAr(w.createdAt, true)}</p></div>
                <div className="flex items-center gap-3"><span className="num font-display text-lg">{usdt(w.amount)}</span><StatusPill status={w.status} /></div>
              </div>
              <div className="mt-3 grid gap-1.5 text-xs text-muted-foreground">
                <p>إلى (Polygon): <span className="num break-all text-foreground">{w.address}</span></p>
                {w.txHash && <p>المعاملة: {txLink(w.txHash, w.id)}</p>}
                {w.reviewNote && <p>ملاحظة: {w.reviewNote}</p>}
              </div>
              {w.status === "pending" && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button data-testid={`button-approve-withdrawal-${w.id}`} disabled={approval.isPending} onClick={() => approve(w)} className="btn-gold px-5 py-2 text-xs">{approval.isPending ? "جارٍ الاعتماد..." : "موافقة على السحب"}</button>
                  <button data-testid={`button-review-withdrawal-${w.id}`} onClick={() => setTarget(w)} className="btn-ghost px-4 py-2 text-xs">رفض الطلب</button>
                </div>
              )}
              {w.status === "processing" && <button data-testid={`button-review-withdrawal-${w.id}`} onClick={() => setTarget(w)} className="btn-gold mt-4 px-4 py-2 text-xs">تسجيل الدفع أو الرفض</button>}
            </div>
          ))}
        </div>
      )}
      <WithdrawalDialog w={target} onClose={() => setTarget(null)} />
    </>
  );
}

function WithdrawalDialog({ w, onClose }: { w: Withdrawal | null; onClose: () => void }) {
  const { toast } = useToast();
  const inv = useInvalidateAll();
  const [note, setNote] = useState("");
  const [tx, setTx] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [err, setErr] = useState("");
  const close = () => { setNote(""); setTx(""); setConfirmed(false); setErr(""); onClose(); };
  const labels: Record<string, string> = { paid: "سُجّل السحب كمدفوع", rejected: "رُفض السحب وأُعيد المبلغ للرصيد" };
  const m = useReviewWithdrawal({
    mutation: {
      onSuccess: (r) => { toast({ title: labels[r.status] ?? "تم التحديث" }); inv(); close(); },
      onError: (e) => setErr(apiError(e)),
    },
  });
  const act = (decision: "paid" | "rejected") => {
    setErr("");
    if (!w || m.isPending) return;
    if (decision === "paid") {
      if (!isTx(tx.trim())) return setErr("أدخل رمز معاملة صالحًا (0x + 64 خانة)");
      if (!confirmed) return setErr("أكّد أنك نفّذت التحويل خارجيًا أولًا");
    }
    if (decision === "rejected" && note.trim().length < 3) return setErr("اكتب سبب الرفض (3 أحرف على الأقل)");
    m.mutate({ id: w.id, data: { decision, txHash: decision === "paid" ? tx.trim() : "", note: note.trim(), confirmed: decision === "paid" ? confirmed : false } });
  };
  return (
    <Dialog open={!!w} onOpenChange={(o) => !o && close()}>
      <DialogContent dir="rtl" className="glass-strong border-border bg-transparent max-h-[90dvh] overflow-y-auto">
        <DialogHeader className="text-right sm:text-right"><DialogTitle className="font-display">سحب {w?.memberName}</DialogTitle></DialogHeader>
        {w && (
          <form onSubmit={(e: FormEvent) => e.preventDefault()} className="space-y-4 text-sm">
            <dl className="grid gap-2 rounded-2xl border border-border p-4 text-xs">
              <div className="flex justify-between"><dt className="text-muted-foreground">المبلغ</dt><dd className="num">{usdt(w.amount)}</dd></div>
              <div><dt className="text-muted-foreground">العنوان (Polygon)</dt><dd className="num break-all">{w.address}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">الحالة</dt><dd><StatusPill status={w.status} /></dd></div>
            </dl>
            {w.status === "processing" && (
              <div className="space-y-3 rounded-2xl border border-[hsl(40_62%_68%/.3)] p-4">
                <p className="text-xs text-muted-foreground">نفّذ تحويل USDT على Polygon يدويًا من محفظتك أولًا، ثم سجّل رمز المعاملة هنا.</p>
                <input data-testid="input-withdrawal-tx" value={tx} onChange={(e) => setTx(e.target.value)} maxLength={66} placeholder="0x... (64 خانة)" dir="ltr" className="field num text-left text-xs" />
                <label className="flex items-start gap-3 text-xs cursor-pointer">
                  <input data-testid="checkbox-withdrawal-confirm" type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[hsl(40_62%_68%)]" />
                  نفّذت التحويل خارجيًا إلى العنوان أعلاه بالمبلغ نفسه، والمعاملة مؤكدة على الشبكة.
                </label>
                <button type="button" data-testid="button-withdrawal-paid" disabled={m.isPending || !confirmed} onClick={() => act("paid")} className="btn-gold w-full py-3">تسجيل كمدفوع</button>
              </div>
            )}
            <textarea data-testid="input-withdrawal-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={2} placeholder="ملاحظة (إلزامية عند الرفض)" className="field resize-none" />
            {err && <p className="text-sm text-[hsl(4_80%_76%)]">{err}</p>}
            <button type="button" data-testid="button-withdrawal-reject" disabled={m.isPending} onClick={() => act("rejected")} className="btn-ghost w-full py-2.5 text-[hsl(4_80%_76%)]">رفض وإعادة المبلغ المحجوز</button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
