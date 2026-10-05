import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { Copy, Check, Award, Timer, ShieldAlert, ArrowUpLeft, Gem, CalendarRange, CalendarCheck, Lock, ExternalLink } from "lucide-react";
import {
  useGetDashboard, getGetDashboardQueryKey, useListActivity, getListActivityQueryKey,
  useListWithdrawals, getListWithdrawalsQueryKey, useRequestWithdrawal, useGetSettings, getGetSettingsQueryKey, useSavePayoutAddress,
  type Activity, type Withdrawal,
} from "@workspace/api-client-react";
import { PageHead, Skel, ErrorBox } from "@/components/brand";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useSessionUser } from "@/components/shell";
import { useToast } from "@/hooks/use-toast";
import { apiError, usdt, dateAr, useCountdown, statusAr, kindAr, isAddr, shortHex, subscriptionDurationDays } from "@/lib/helpers";
import { useInvalidateAll, live } from "@/lib/invalidate";

export function MemberId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button data-testid="button-copy-id" onClick={() => { navigator.clipboard?.writeText(id); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="group inline-flex items-center gap-2 rounded-xl border border-[hsl(40_62%_68%/.25)] bg-[hsl(40_62%_68%/.06)] px-3 py-2 sm:gap-3 sm:px-4">
      <span data-testid="text-member-id" className="num text-base tracking-[0.12em] gold-text font-medium sm:text-lg sm:tracking-[0.18em]">{id}</span>
      {copied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />}
    </button>
  );
}

export function HonorRing({ value, size = 132 }: { value: number; size?: number }) {
  const r = (size - 14) / 2, c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(200 22% 18%)" strokeWidth="7" fill="none" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} stroke="url(#hr)" strokeWidth="7" fill="none" strokeLinecap="round"
          strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - Math.min(100, value) / 100) }} transition={{ duration: 1.4, ease: "easeOut" }} />
        <defs><linearGradient id="hr"><stop stopColor="hsl(168 42% 55%)" /><stop offset="1" stopColor="hsl(42 72% 76%)" /></linearGradient></defs>
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div><p data-testid="text-honor" className="num font-display text-3xl font-semibold">{value}</p><p className="text-[11px] text-muted-foreground">من 100</p></div>
      </div>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone: Record<string, string> = {
    approved: "border-accent/40 text-accent bg-accent/10", paid: "border-accent/40 text-accent bg-accent/10",
    pending: "border-[hsl(40_62%_68%/.4)] text-primary bg-[hsl(40_62%_68%/.08)]",
    awaiting_receipt: "border-[hsl(40_62%_68%/.4)] text-primary bg-[hsl(40_62%_68%/.08)]",
    processing: "border-[hsl(210_50%_65%/.45)] text-[hsl(210_60%_78%)] bg-[hsl(210_50%_60%/.1)]",
    rejected: "border-[hsl(4_60%_66%/.4)] text-[hsl(4_80%_76%)] bg-[hsl(4_60%_60%/.08)]",
    cancelled: "border-border text-muted-foreground",
  };
  return <span data-testid={`status-${status}`} className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs ${tone[status] ?? "border-border"}`}>{statusAr[status] ?? status}</span>;
}

function ActivityList({ items }: { items: Activity[] }) {
  if (!items.length) return (
    <div className="py-10 text-center text-sm text-muted-foreground">
      <div className="mx-auto mb-3 h-12 w-12 rounded-full border border-dashed border-border grid place-items-center"><Timer className="h-5 w-5" /></div>
      لا توجد حركات بعد. ستظهر هنا كل قيد على رصيدك بتاريخه.
    </div>
  );
  return (
    <ul className="divide-y divide-border/60">
      {items.map((a) => (
        <li key={a.id} data-testid={`row-activity-${a.id}`} className="flex items-center justify-between gap-4 py-3.5">
          <div className="min-w-0">
            <p className="truncate text-sm">{a.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{kindAr[a.kind] ?? a.kind} · {dateAr(a.createdAt, true)}</p>
          </div>
          <span className={`num text-sm font-medium ${a.amount >= 0 ? "text-accent" : "text-[hsl(12_70%_72%)]"}`}>{a.amount >= 0 ? "+" : ""}{usdt(a.amount)}</span>
        </li>
      ))}
    </ul>
  );
}

export function DashboardPage() {
  const { user } = useSessionUser();
  const q = useGetDashboard({ query: { enabled: !!user, queryKey: getGetDashboardQueryKey(), ...live } });
  const cd = useCountdown(q.data?.nextAccrualAt ?? undefined);
  if (q.isLoading) return <div className="grid gap-4 md:grid-cols-3"><Skel className="h-56 md:col-span-2" /><Skel className="h-56" /><Skel className="h-32" /><Skel className="h-32" /><Skel className="h-32" /></div>;
  if (q.isError || !q.data) return <ErrorBox onRetry={() => q.refetch()} />;
  const d = q.data;
  const durationDays = d.subscription ? subscriptionDurationDays(d.subscription.startsAt, d.subscription.expiresAt) : 0;
  const remainingDays = Math.max(0, durationDays - d.creditedDays);
  const pct = durationDays ? remainingDays / durationDays : 0;
  return (
    <>
      <PageHead eyebrow="لوحة العضو" title={`أهلًا، ${d.user.name}`} desc="رصيدك سجل داخلي في ارتقاء، وليس إثباتًا لحفظ أموال. يُضاف ربح الخطة عند تفعيلها، ثم يُقيَّد بعد كل 24 ساعة." />
      <div className="grid gap-4 md:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="glass relative min-w-0 overflow-hidden rounded-3xl p-5 sm:p-7 md:col-span-2">
          <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full border border-[hsl(40_62%_68%/.1)]" />
          <div className="absolute -left-10 -top-10 h-64 w-64 rounded-full border border-[hsl(168_42%_52%/.08)]" />
          <p className="text-xs text-muted-foreground mb-3">رقم العضوية</p>
          <MemberId id={d.user.memberId} />
          <div className="mt-6 flex flex-wrap items-end gap-6 sm:mt-8 sm:gap-10">
            <div>
              <p className="text-xs text-muted-foreground">الرصيد المتاح</p>
              <p data-testid="text-balance" className="num font-display text-4xl md:text-5xl font-semibold mt-2">{usdt(d.user.balance)}</p>
            </div>
            <div><p className="text-xs text-muted-foreground">محجوز لسحوبات قيد المعالجة</p><p data-testid="text-reserved" className="num text-xl mt-1">{usdt(d.reservedBalance)}</p></div>
            <div><p className="text-xs text-muted-foreground">مُقيَّد اليوم</p><p className="num text-xl mt-1 text-accent">{usdt(d.todayEarned)}</p></div>
            <div><p className="text-xs text-muted-foreground">إجمالي المُقيَّد</p><p className="num text-xl mt-1">{usdt(d.user.totalEarned)}</p></div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .08 }} className="glass flex flex-col items-center rounded-3xl p-5 text-center sm:p-7">
          <p className="text-xs text-muted-foreground mb-4 flex items-center gap-2"><Award className="h-4 w-4 text-primary" />نقاط الشرف</p>
          <HonorRing value={d.user.honorPoints} />
          <p className="mt-4 text-xs text-muted-foreground leading-relaxed">تعدّلها الإدارة فقط مع سبب مسجّل، ولا تؤثر في السحب.</p>
        </motion.div>

        <div className="glass rounded-3xl p-6">
          <p className="text-xs text-muted-foreground flex items-center gap-2"><CalendarCheck className="h-4 w-4" />الأيام المتبقية</p>
          <p data-testid="text-remaining-days" className="num font-display text-3xl mt-3">{remainingDays}<span className="text-muted-foreground text-lg"> / {durationDays}</span></p>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"><motion.div className="h-full origin-right bg-gradient-to-l from-[hsl(42_72%_76%)] to-[hsl(168_42%_52%)]" initial={{ scaleX: 0 }} animate={{ scaleX: pct }} transition={{ duration: 1 }} /></div>
          <p className="text-xs text-muted-foreground mt-3">الربح اليومي: <span className="num text-foreground">{usdt(d.dailyProfit)}</span></p>
        </div>
        <div className="glass rounded-3xl p-6">
          <p className="text-xs text-muted-foreground flex items-center gap-2"><Timer className="h-4 w-4" />القيد التالي خلال</p>
          <p data-testid="text-countdown" className="num font-display text-3xl mt-3">{d.nextAccrualAt && cd ? cd.text : "--:--:--"}</p>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{d.nextAccrualAt ? `يُقيَّد ربح الخطة التالي بعد 24 ساعة كاملة، الموعد ${dateAr(d.nextAccrualAt, true)}` : d.subscription ? "اكتملت أيام الاشتراك أو لا يوجد قيد قادم." : "يبدأ ربح الخطة بعد اعتماد الإدارة لإيداعك."}</p>
        </div>
        <div className="glass rounded-3xl p-6">
          <p className="text-xs text-muted-foreground flex items-center gap-2"><Gem className="h-4 w-4" />الاشتراك</p>
          {d.subscription ? (
            <><p className="font-display text-xl mt-3">{d.subscription.plan.name}</p><p className="text-xs text-muted-foreground mt-2">من {dateAr(d.subscription.startsAt)} حتى {dateAr(d.subscription.expiresAt)}</p></>
          ) : (
            <><p className="text-sm mt-3 text-muted-foreground">لا يوجد اشتراك نشط</p><Link href="/deposits" data-testid="link-choose-plan" className="mt-3 inline-flex items-center gap-1 text-sm text-primary">ابدأ إيداعًا <ArrowUpLeft className="h-4 w-4" /></Link></>
          )}
        </div>
        <div className="glass rounded-3xl p-6 md:col-span-2">
          <div className="flex items-center justify-between mb-2"><h3 className="font-display font-medium">آخر الحركات</h3><Link href="/wallet" data-testid="link-all-activity" className="text-xs text-primary">عرض الكل</Link></div>
          <ActivityList items={d.recentActivity.slice(0, 6)} />
        </div>
        <div className={`glass rounded-3xl p-6 ${d.canWithdraw ? "" : "border-[hsl(12_60%_66%/.25)]"}`}>
          <p className="text-xs text-muted-foreground flex items-center gap-2"><ShieldAlert className="h-4 w-4" />حالة السحب</p>
          <p data-testid="status-withdraw" className={`font-display text-lg mt-3 ${d.canWithdraw ? "text-accent" : "text-[hsl(12_70%_74%)]"}`}>{d.canWithdraw ? "يمكنك طلب سحب" : "غير متاح حاليًا"}</p>
          {d.withdrawalReason && <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{d.withdrawalReason}</p>}
        </div>
      </div>
    </>
  );
}

function WithdrawalRow({ w }: { w: Withdrawal }) {
  return (
    <li data-testid={`row-withdrawal-${w.id}`} className="py-3.5 text-sm space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <div><p className="num">{usdt(w.amount)}</p><p className="text-xs text-muted-foreground">{dateAr(w.createdAt, true)}</p></div>
        <StatusPill status={w.status} />
      </div>
      <p className="text-xs text-muted-foreground">إلى <span className="num break-all">{w.address}</span></p>
      {w.status === "processing" && <p className="text-xs text-[hsl(210_60%_78%)]">قيد التحويل اليدوي من الإدارة. لم يُدفع بعد.</p>}
      {w.txHash && <a data-testid={`link-wtx-${w.id}`} href={`https://polygonscan.com/tx/${w.txHash}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary"><span className="num">{shortHex(w.txHash)}</span><ExternalLink className="h-3 w-3" /></a>}
      {w.reviewNote && <p className="text-xs text-muted-foreground">ملاحظة الإدارة: {w.reviewNote}</p>}
    </li>
  );
}

export function WalletPage() {
  const { user } = useSessionUser();
  const { toast } = useToast();
  const inv = useInvalidateAll();
  const dash = useGetDashboard({ query: { enabled: !!user, queryKey: getGetDashboardQueryKey(), ...live } });
  const act = useListActivity({ query: { enabled: !!user, queryKey: getListActivityQueryKey(), ...live } });
  const wd = useListWithdrawals({ query: { enabled: !!user, queryKey: getListWithdrawalsQueryKey(), ...live } });
  const settings = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });
  const [amount, setAmount] = useState("");
  const [err, setErr] = useState("");
  const [walletErr, setWalletErr] = useState("");
  const payoutForm = useForm<{address: string}>({defaultValues: {address: ""}});
  const minimumWithdrawal = settings.data?.minimumWithdrawal ?? 2;
  const req = useRequestWithdrawal({
    mutation: {
      onSuccess: () => { setAmount(""); toast({ title: "أُرسل طلب السحب", description: "حُجز المبلغ من رصيدك المتاح بانتظار مراجعة الإدارة." }); inv(); },
      onError: (e) => setErr(apiError(e)),
    },
  });
  const wallet = useSavePayoutAddress({
    mutation: {
      onSuccess: () => { setWalletErr(""); payoutForm.reset(); toast({ title: "تم حفظ عنوان المحفظة", description: "لا يمكن تغييره من حسابك؛ التغيير متاح للإدارة فقط." }); inv(); },
      onError: (e) => setWalletErr(apiError(e)),
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault(); if (req.isPending) return; setErr("");
    const n = Number(amount);
    if (!Number.isFinite(n) || n < minimumWithdrawal) return setErr(`الحد الأدنى للسحب ${usdt(minimumWithdrawal)}.`);
    if (dash.data && n > dash.data.user.balance) return setErr("المبلغ يتجاوز الرصيد المتاح");
    req.mutate({ data: { amount: n } });
  };
  const savePayoutAddress = ({address: rawAddress}: {address: string}) => {
    setWalletErr("");
    const address = rawAddress.trim();
    if (!isAddr(address)) {
      payoutForm.setError("address", {message: "أدخل عنوان Polygon صحيحًا يبدأ بـ 0x ويتكون من 40 خانة."});
      return;
    }
    wallet.mutate({data: {address}});
  };
  const d = dash.data;
  return (
    <>
      <PageHead eyebrow="المحفظة" title="رصيدك وسحوباتك" desc={`الأرصدة قيود داخلية بعملة USDT وليست إثبات حفظ. الحد الأدنى للسحب ${usdt(minimumWithdrawal)}، والتحويل يدوي عبر شبكة Polygon بعد مراجعة الإدارة.`} />
      <div data-testid="card-payout-wallet" className="glass mb-4 rounded-3xl p-4 sm:p-6">
        <h3 className="font-display font-medium">محفظة السحب على Polygon</h3>
        {d?.user.payoutAddress ? (
          <div className="mt-3 space-y-2">
            <p data-testid="text-payout-wallet" dir="ltr" className="num break-all rounded-xl border border-border bg-background/20 p-3 text-left text-sm">{d.user.payoutAddress}</p>
            <p className="flex items-center gap-2 text-xs text-muted-foreground"><Lock className="h-3.5 w-3.5 shrink-0" />العنوان محفوظ ولا يمكن تغييره من حسابك. اطلب من الإدارة تغييره عند الحاجة.</p>
          </div>
        ) : (
          <Form {...payoutForm}>
            <form onSubmit={payoutForm.handleSubmit(savePayoutAddress)} className="mt-3 space-y-3">
              <FormField control={payoutForm.control} name="address" render={({field}) => (
                <FormItem>
                  <FormLabel>عنوان محفظتك لاستلام USDT على Polygon</FormLabel>
                  <FormControl>
                    <input {...field} data-testid="input-payout-wallet" maxLength={42} dir="ltr" placeholder="0x..." className="field num text-left text-sm" disabled={wallet.isPending} onChange={(e) => { field.onChange(e); payoutForm.clearErrors("address"); setWalletErr(""); }} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              {walletErr && <p data-testid="text-wallet-error" role="alert" className="text-sm text-[hsl(4_80%_76%)]">{walletErr}</p>}
              <p className="text-xs leading-relaxed text-muted-foreground">تأكد من العنوان والشبكة قبل الحفظ. بعد الحفظ لا يمكن تغييره إلا من الإدارة، ولا يمكن ربط عنوان واحد بأكثر من حساب.</p>
              <button data-testid="button-save-payout-wallet" disabled={wallet.isPending} className="btn-gold w-full py-2.5 sm:w-auto sm:px-8">{wallet.isPending ? "جارٍ الحفظ..." : "حفظ عنوان المحفظة"}</button>
            </form>
          </Form>
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-4">
          <div className="glass rounded-3xl p-5 sm:p-7">
            {dash.isLoading ? <Skel className="h-24" /> : d ? (
              <>
                <p className="text-xs text-muted-foreground">الرصيد المتاح</p>
                <p data-testid="text-wallet-balance" className="num font-display text-4xl font-semibold mt-2">{usdt(d.user.balance)}</p>
                <div className="mt-5 flex flex-wrap gap-6 text-sm">
                  <div><span className="text-muted-foreground">محجوز </span><span className="num">{usdt(d.reservedBalance)}</span></div>
                  <div><span className="text-muted-foreground">الحد الأدنى للسحب </span><span className="num">{usdt(minimumWithdrawal)}</span></div>
                </div>
              </>
            ) : <ErrorBox onRetry={() => dash.refetch()} />}
          </div>
          <form onSubmit={submit} className="glass rounded-3xl p-4 space-y-4 sm:p-7">
            <h3 className="font-display font-medium">طلب سحب USDT (Polygon)</h3>
            {d && !d.canWithdraw && <p className="rounded-xl bg-[hsl(12_60%_66%/.08)] border border-[hsl(12_60%_66%/.25)] p-3 text-sm text-[hsl(12_70%_78%)]">{d.withdrawalReason || "السحب غير متاح حاليًا"}</p>}
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground num">USDT</span>
              <input data-testid="input-amount" type="number" step="0.01" min={minimumWithdrawal} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" dir="ltr" className="field num pl-16" disabled={!d?.canWithdraw} />
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">سيُرسل الطلب إلى عنوان محفظتك المحفوظ أعلاه. راجعه قبل الإرسال؛ التحويل إلى عنوان أو شبكة خاطئة قد لا يمكن استرجاعه.</p>
            {err && <p data-testid="text-withdraw-error" className="text-sm text-[hsl(4_80%_76%)]">{err}</p>}
            <button data-testid="button-withdraw" disabled={!d?.canWithdraw || req.isPending} className="btn-gold w-full py-3">{req.isPending ? "جارٍ الإرسال..." : "إرسال طلب السحب"}</button>
          </form>
          <div className="glass rounded-3xl p-6">
            <h3 className="font-display font-medium mb-1">سجل السحوبات</h3>
            {wd.isLoading ? <Skel className="h-20" /> : wd.isError ? <ErrorBox onRetry={() => wd.refetch()} /> : !wd.data?.length ? <p className="py-6 text-center text-sm text-muted-foreground">لا توجد طلبات بعد.</p> : (
              <ul className="divide-y divide-border/60">{wd.data.map((w) => <WithdrawalRow key={w.id} w={w} />)}</ul>
            )}
          </div>
        </div>
        <div className="glass h-fit rounded-3xl p-4 sm:p-6">
          <h3 className="font-display font-medium mb-2">كل الحركات</h3>
          {act.isLoading ? <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skel key={i} className="h-12" />)}</div> : act.isError ? <ErrorBox onRetry={() => act.refetch()} /> : <ActivityList items={act.data ?? []} />}
        </div>
      </div>
    </>
  );
}

export function ProfilePage() {
  const { user } = useSessionUser();
  const dash = useGetDashboard({ query: { enabled: !!user, queryKey: getGetDashboardQueryKey(), ...live } });
  if (dash.isLoading) return <Skel className="h-80" />;
  if (dash.isError || !dash.data) return <ErrorBox onRetry={() => dash.refetch()} />;
  const { user: u, subscription: s } = dash.data;
  const rows: [string, string][] = [["الاسم", u.name], ["الهاتف", u.phone], ["الدور", u.role === "admin" ? "مسؤول" : "عضو"], ["الحالة", u.active ? "نشط" : "موقوف"], ["عضو منذ", dateAr(u.createdAt)]];
  return (
    <>
      <PageHead eyebrow="الملف الشخصي" title="هويتك في ارتقاء" />
      <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
        <div className="glass rounded-3xl p-5 sm:p-8">
          <div className="flex flex-wrap items-center gap-6">
            <div className="grid h-20 w-20 place-items-center rounded-2xl bg-gradient-to-br from-[hsl(42_72%_76%/.25)] to-[hsl(168_42%_52%/.2)] font-display text-3xl text-primary">{u.name.trim().charAt(0)}</div>
            <div className="min-w-0"><p className="break-words font-display text-xl sm:text-2xl">{u.name}</p><div className="mt-2"><MemberId id={u.memberId} /></div></div>
          </div>
          <div className="hairline my-7" />
          <dl className="grid gap-4 sm:grid-cols-2">
            {rows.map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className={`mt-1 ${k === "الهاتف" ? "num text-right" : ""}`}>{v}</dd></div>)}
          </dl>
        </div>
        <div className="space-y-4">
          <div className="glass flex items-center gap-4 rounded-3xl p-5 sm:gap-6 sm:p-7">
            <HonorRing value={u.honorPoints} size={110} />
            <div><p className="font-display">نقاط الشرف</p><p className="text-xs text-muted-foreground mt-1 leading-relaxed">تُعدَّل إداريًا فقط بين 0 و100 مع سبب مسجّل.</p></div>
          </div>
          <div className="glass rounded-3xl p-5 sm:p-7">
            <p className="font-display flex items-center gap-2"><CalendarRange className="h-4 w-4 text-primary" />الاشتراك</p>
            {s ? (
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">الخطة</dt><dd className="break-words">{s.plan.name}</dd></div>
                <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">البداية</dt><dd>{dateAr(s.startsAt)}</dd></div>
                <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">الانتهاء</dt><dd>{dateAr(s.expiresAt)}</dd></div>
                <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">الربح اليومي الثابت</dt><dd className="num">{usdt(dash.data.dailyProfit)}</dd></div>
                <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">الأيام المتبقية</dt><dd data-testid="text-profile-remaining-days" className="num">{s ? Math.max(0, subscriptionDurationDays(s.startsAt, s.expiresAt) - dash.data.creditedDays) : 0} / {s ? subscriptionDurationDays(s.startsAt, s.expiresAt) : 0}</dd></div>
              </dl>
            ) : <p className="mt-4 text-sm text-muted-foreground flex items-center gap-2"><Lock className="h-4 w-4" />لا يوجد اشتراك نشط. <Link href="/deposits" data-testid="link-profile-deposit" className="text-primary">ابدأ إيداعًا</Link></p>}
          </div>
        </div>
      </div>
    </>
  );
}
