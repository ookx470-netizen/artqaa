import { useRef, useState, type FormEvent, type MouseEvent } from "react";
import { Copy, Check, AlertTriangle, Upload, ImageIcon, Settings2, FileText } from "lucide-react";
import {
  useListPlans, getListPlansQueryKey, useGetSettings, getGetSettingsQueryKey, useListDeposits, getListDepositsQueryKey,
  useCreateDeposit, useSubmitDepositProof, useCancelDeposit, useRequestReceiptUpload, type Deposit,
} from "@workspace/api-client-react";
import { PageHead, Skel, ErrorBox } from "@/components/brand";
import { useSessionUser } from "@/components/shell";
import { StatusPill } from "@/pages/member";
import { useToast } from "@/hooks/use-toast";
import { apiError, usdt, dateAr, FREE_PLAN_ID, planDurationDays } from "@/lib/helpers";
import { useInvalidateAll, live } from "@/lib/invalidate";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const channelAr: Record<string, string> = { binance: "Binance", okx: "OKX" };
const TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

class ReceiptUploadError extends Error {}

async function uploadReceiptThroughApp(uploadId: string, file: File): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`/api/receipts/upload/${encodeURIComponent(uploadId)}/content`, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
  } catch {
    throw new ReceiptUploadError("تعذر الاتصال بخدمة رفع الصور. تحقق من الاتصال وحاول مجددًا.");
  }
  if (response.ok) return;
  const body = await response.json().catch(() => null) as { error?: unknown } | null;
  throw new ReceiptUploadError(typeof body?.error === "string" ? body.error : "تعذر رفع الصورة، حاول مجددًا.");
}

function CopyBtn({ text, id }: { text: string; id: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" data-testid={`button-copy-${id}`} onClick={() => { navigator.clipboard?.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className="btn-ghost flex shrink-0 items-center gap-1.5 px-3 py-2 text-xs">{ok ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}{ok ? "نُسخ" : "نسخ"}</button>
  );
}

export function DepositsPage() {
  const { user } = useSessionUser();
  const plans = useListPlans({ query: { queryKey: getListPlansQueryKey(), ...live } });
  const settings = useGetSettings({ query: { queryKey: getGetSettingsQueryKey(), ...live } });
  const deps = useListDeposits({ query: { enabled: !!user, queryKey: getListDepositsQueryKey(), ...live } });
  const open = deps.data?.find((d) => d.status === "awaiting_receipt" || d.status === "pending");

  return (
    <>
      <PageHead eyebrow="الإيداع" title="اشتراك عبر USDT على Polygon" desc="أنشئ الطلب أولًا لتحصل على عنوان الاستلام والمبلغ الدقيق، ثم ارفع الإيصال. التفعيل يتم بعد مراجعة يدوية من المسؤول." />
      {deps.isLoading || plans.isLoading || settings.isLoading ? <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]"><Skel className="h-96" /><Skel className="h-96" /></div>
        : deps.isError || plans.isError || settings.isError ? <ErrorBox onRetry={() => { deps.refetch(); plans.refetch(); settings.refetch(); }} />
        : (
          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <div>{open ? <OpenOrder d={open} /> : <NewOrder />}</div>
            <div className="glass h-fit rounded-3xl p-4 sm:p-6">
              <h3 className="font-display font-medium mb-1">سجل الإيداعات</h3>
              {!deps.data?.length ? <p className="py-8 text-center text-sm text-muted-foreground">لا توجد طلبات إيداع بعد.</p> : (
                <ul className="divide-y divide-border/60">
                  {deps.data.map((d) => (
                    <li key={d.id} data-testid={`row-deposit-${d.id}`} className="py-3.5 text-sm space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <div><p>{d.planName} <span className="text-xs text-muted-foreground">· {channelAr[d.channel] ?? d.channel}</span></p><p className="num text-xs text-muted-foreground text-right">{usdt(d.amount)}</p></div>
                        <StatusPill status={d.status} />
                      </div>
                      <p className="text-xs text-muted-foreground">{dateAr(d.createdAt, true)}{d.reviewedAt ? ` · رُوجع ${dateAr(d.reviewedAt, true)}` : ""}</p>
                      <div className="flex flex-wrap gap-3 text-xs">
                        {d.receiptUrl && <a href={d.receiptUrl} target="_blank" rel="noreferrer" data-testid={`link-receipt-${d.id}`} className="inline-flex items-center gap-1 text-primary"><ImageIcon className="h-3 w-3" />الإيصال</a>}
                      </div>
                      {d.reviewNote && <p className="text-xs text-muted-foreground">ملاحظة الإدارة: {d.reviewNote}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
    </>
  );
}

function NewOrder() {
  const { toast } = useToast();
  const inv = useInvalidateAll();
  const plans = useListPlans({ query: { queryKey: getListPlansQueryKey() } });
  const settings = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });
  const [planId, setPlanId] = useState("");
  const [channel, setChannel] = useState<"binance" | "okx" | "">("");
  const [accepted, setAccepted] = useState(false);
  const [err, setErr] = useState("");
  const [verifyOpen, setVerifyOpen] = useState(false);
  const create = useCreateDeposit({
    mutation: {
      onSuccess: () => { toast({ title: "أُنشئ طلب الإيداع", description: "استخدم العنوان والمبلغ الظاهرين في الطلب فقط." }); setAccepted(false); setVerifyOpen(false); inv(); },
      onError: (e) => setErr(apiError(e)),
    },
  });
  const s = settings.data;
  const list = plans.data ?? [];
  if (!s?.ready || !s.depositsEnabled || !list.length) {
    return (
      <div data-testid="empty-deposits-setup" className="glass rounded-3xl p-10 text-center">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-[hsl(40_62%_68%/.1)] text-primary"><Settings2 className="h-7 w-7" /></div>
        <p className="font-display text-xl">الإيداع غير متاح حاليًا</p>
        <p className="mt-2 text-muted-foreground leading-relaxed max-w-md mx-auto">{!list.length ? "لم تُهيأ أي خطة بعد. " : ""}{!s?.depositsEnabled || !s?.ready ? "لم يكتمل إعداد عناوين الاستلام والشروط من قِبل الإدارة. " : ""}عُد لاحقًا، ولا تحوّل أي مبلغ إلى عنوان لم يظهر داخل طلب إيداع منشأ هنا.</p>
      </div>
    );
  }
  const submit = (e: FormEvent) => {
    e.preventDefault(); if (create.isPending) return; setErr("");
    if (!planId) return setErr("اختر خطة");
    if (!channel) return setErr("اختر قناة الاستلام");
    if (!accepted) return setErr("يجب الموافقة على الشروط");
    if (planId === FREE_PLAN_ID) return setVerifyOpen(true);
    create.mutate({ data: { planId, channel, acceptedTerms: true } });
  };
  const confirmFreeVerification = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (create.isPending || planId !== FREE_PLAN_ID || !channel || !accepted) return;
    create.mutate({ data: { planId, channel, acceptedTerms: true } });
  };
  const channels = (["binance", "okx"] as const).filter((c) => (c === "binance" ? s.binanceAddress : s.okxAddress));
  return (
    <form onSubmit={submit} className="glass rounded-3xl p-4 space-y-6 sm:p-7">
      <div>
        <p className="text-sm text-muted-foreground mb-3">1. اختر الخطة</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((p) => (
            <button type="button" key={p.id} data-testid={`select-plan-${p.id}`} onClick={() => setPlanId(p.id)}
              className={`rounded-2xl border p-4 text-right transition-colors ${planId === p.id ? "border-[hsl(40_62%_68%/.6)] bg-[hsl(40_62%_68%/.08)]" : "border-border hover:bg-[hsl(40_40%_90%/.03)]"}`}>
               <div className="flex flex-wrap items-center justify-between gap-2">
                 <p className="font-display">{p.name}</p>
                 {p.id === FREE_PLAN_ID && <span className="rounded-full border border-[hsl(40_62%_68%/.45)] px-2.5 py-1 text-[10px] text-primary">بشرط التوثيق</span>}
               </div>
               <p className="mt-2 text-primary text-right">{p.id === FREE_PLAN_ID ? "مجانية" : <span className="num">{usdt(p.annualPrice)}</span>}</p>
               {p.id === FREE_PLAN_ID && <p className="mt-1 text-xs text-muted-foreground">مدة العقد {planDurationDays(p.id)} يومًا</p>}
              <p className="text-xs text-muted-foreground mt-1">ربح يومي ثابت <span className="num">{usdt(p.dailyProfit)}</span></p>
            </button>
          ))}
        </div>
         {planId === FREE_PLAN_ID && (
           <div data-testid="notice-free-plan-verification" className="mt-3 rounded-2xl border border-[hsl(40_62%_68%/.35)] bg-[hsl(40_62%_68%/.06)] p-4 text-sm leading-relaxed">
             العقد مجاني لمدة 180 يومًا بربح يومي 0.50 USDT. يتطلب توثيق الحساب إيداع 4 USDT لمنع استغلال الميزة وإنشاء أكثر من حساب؛ لا يبدأ العقد قبل مراجعة الإيصال من الإدارة.
           </div>
         )}
      </div>
      <div>
        <p className="text-sm text-muted-foreground mb-3">2. قناة الاستلام</p>
        <div className="flex gap-3">
          {channels.map((c) => (
            <button type="button" key={c} data-testid={`select-channel-${c}`} onClick={() => setChannel(c)}
              className={`flex-1 rounded-2xl border px-4 py-3 text-sm ${channel === c ? "border-[hsl(40_62%_68%/.6)] bg-[hsl(40_62%_68%/.08)] text-primary" : "border-border"}`}>{channelAr[c]}</button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">تسميات لعناوين يضبطها المسؤول يدويًا. ارتقاء غير تابعة لـ Binance أو OKX.</p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground mb-3 flex items-center gap-2"><FileText className="h-4 w-4" />3. وصف التمويل والشروط</p>
        <div className="max-h-56 overflow-y-auto rounded-2xl border border-border bg-[hsl(205_36%_7%/.5)] p-4 text-sm leading-relaxed whitespace-pre-wrap space-y-3">
          <p data-testid="text-funding-description">{s.fundingDescription}</p>
          <div className="hairline" />
          <p data-testid="text-terms" className="text-muted-foreground">{s.terms}</p>
        </div>
        <label className="mt-3 flex items-start gap-3 text-sm cursor-pointer">
          <input data-testid="checkbox-accept-terms" type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-1 h-4 w-4 accent-[hsl(40_62%_68%)]" />
          قرأت الوصف والشروط وأوافق عليها، وأفهم أنه لا توجد عوائد مضمونة.
        </label>
      </div>
      {err && <p className="text-sm text-[hsl(4_80%_76%)]">{err}</p>}
       <button data-testid="button-create-deposit" disabled={create.isPending} className="btn-gold w-full py-3">{create.isPending ? "جارٍ الإنشاء..." : planId === FREE_PLAN_ID ? "تفعيل العقد المجاني" : "إنشاء طلب الإيداع"}</button>
       <AlertDialog open={verifyOpen} onOpenChange={setVerifyOpen}>
         <AlertDialogContent dir="rtl" className="glass-strong border-border bg-transparent">
           <AlertDialogHeader className="text-right sm:text-right">
             <AlertDialogTitle className="font-display">توثيق الحساب مطلوب لتفعيل العقد المجاني</AlertDialogTitle>
             <AlertDialogDescription className="leading-relaxed">
               العقد مجاني بالكامل. يتطلب توثيق الحساب إيداع 4 USDT لمنع استغلال الميزة وإنشاء أكثر من حساب. لن يُفعّل العقد قبل رفع الإيصال والتحقق اليدوي من وصول المبلغ.
             </AlertDialogDescription>
           </AlertDialogHeader>
           <dl className="grid gap-2 rounded-2xl border border-border bg-background/40 p-4 text-sm">
             <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">سعر العقد</dt><dd className="num">0 USDT</dd></div>
             <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">الربح اليومي</dt><dd className="num text-accent">0.50 USDT</dd></div>
             <div className="flex items-center justify-between gap-3"><dt className="text-muted-foreground">مدة العقد</dt><dd className="num">180 يومًا</dd></div>
             <div className="flex items-center justify-between gap-3 border-t border-border pt-2 font-medium"><dt>إيداع التوثيق المطلوب</dt><dd className="num text-primary">4 USDT</dd></div>
           </dl>
           {err && <p data-testid="text-verify-error" className="text-sm text-[hsl(4_80%_76%)]">{err}</p>}
           <AlertDialogFooter className="gap-2 sm:flex-row-reverse sm:justify-start">
             <AlertDialogAction type="button" data-testid="button-confirm-free-verification" disabled={create.isPending} className="btn-gold border-0" onClick={confirmFreeVerification}>
               {create.isPending ? "جارٍ إنشاء الطلب..." : "متابعة لإيداع 4 USDT"}
             </AlertDialogAction>
             <AlertDialogCancel type="button" data-testid="button-cancel-free-verification" className="btn-ghost bg-transparent">إلغاء</AlertDialogCancel>
           </AlertDialogFooter>
         </AlertDialogContent>
       </AlertDialog>
    </form>
  );
}

function OpenOrder({ d }: { d: Deposit }) {
  const { toast } = useToast();
  const inv = useInvalidateAll();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState("");
  const [uploading, setUploading] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const reqUpload = useRequestReceiptUpload();
  const proof = useSubmitDepositProof({
    mutation: {
      onSuccess: () => { toast({ title: "أُرسل الإيصال", description: "الطلب قيد المراجعة. لن يُفعّل الاشتراك قبل اعتماد المسؤول." }); setFile(null); inv(); },
      onError: (e) => setErr(apiError(e)),
    },
  });
  const cancel = useCancelDeposit({
    mutation: {
      onSuccess: () => { toast({ title: "أُلغي طلب الإيداع" }); inv(); },
      onError: (e) => toast({ title: "تعذر الإلغاء", description: apiError(e), variant: "destructive" }),
      onSettled: () => setConfirmCancel(false),
    },
  });
  const busy = uploading || proof.isPending;
  const pick = (f: File | undefined) => {
    setErr("");
    if (!f) return;
    if (!(TYPES as readonly string[]).includes(f.type)) return setErr("الصيغ المسموحة: PNG أو JPEG أو WebP");
    if (f.size > 5 * 1024 * 1024) return setErr("الحد الأقصى لحجم الصورة 5 ميغابايت");
    setFile(f);
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault(); if (busy) return; setErr("");
    if (!file) return setErr("أرفق صورة الإيصال");
    setUploading(true);
    try {
      const up = await reqUpload.mutateAsync({ data: { contentType: file.type as (typeof TYPES)[number], size: file.size } });
      let directUploadSucceeded = false;
      try {
        const res = await fetch(up.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
        directUploadSucceeded = res.ok;
      } catch {
        // Some mobile browsers cannot complete the cross-origin signed PUT; retry via the same-origin API.
      }
      if (!directUploadSucceeded) await uploadReceiptThroughApp(up.uploadId, file);
      setUploading(false);
      proof.mutate({ id: d.id, data: { uploadId: up.uploadId } });
    } catch (x) {
      setUploading(false);
      setErr(x instanceof ReceiptUploadError ? x.message : apiError(x));
    }
  };

  if (d.status === "pending") {
    return (
      <div data-testid="card-deposit-pending" className="glass rounded-3xl p-5 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="font-display text-xl">طلبك قيد المراجعة</p><StatusPill status="pending" /></div>
        <p className="mt-3 text-muted-foreground leading-relaxed">أُرسلت صورة الإيصال. سيتحقق المسؤول يدويًا من تفاصيل التحويل، ولن يُفعّل الاشتراك قبل الاعتماد. تتحدث هذه الصفحة تلقائيًا.</p>
        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-muted-foreground">الخطة</dt><dd>{d.planName}</dd></div>
          <div><dt className="text-xs text-muted-foreground">المبلغ</dt><dd className="num text-right">{usdt(d.amount)}</dd></div>
        </dl>
        {d.receiptUrl && <a href={d.receiptUrl} target="_blank" rel="noreferrer" data-testid="link-pending-receipt"><img src={d.receiptUrl} alt="الإيصال" className="mt-5 max-h-60 rounded-2xl border border-border object-contain" /></a>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div data-testid="card-deposit-order" className="glass rounded-3xl p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="font-display text-xl">حوّل المبلغ الدقيق</p><StatusPill status={d.status} /></div>
        <div className="mt-6 space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2">المبلغ (USDT)</p>
            <div className="flex items-center gap-3"><p data-testid="text-deposit-amount" className="num font-display text-3xl gold-text flex-1">{d.amount}</p><CopyBtn text={String(d.amount)} id="amount" /></div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">عنوان الاستلام · {channelAr[d.channel] ?? d.channel}</p>
            <div className="flex items-center gap-3 rounded-2xl border border-[hsl(40_62%_68%/.3)] bg-[hsl(40_62%_68%/.05)] p-3">
              <p data-testid="text-deposit-address" className="num flex-1 break-all text-sm">{d.address}</p><CopyBtn text={d.address} id="address" />
            </div>
          </div>
          <div className="text-xs text-muted-foreground">الخطة {d.planName} · ربح يومي ثابت <span className="num">{usdt(d.dailyProfit)}</span></div>
        </div>
        <div className="mt-6 rounded-2xl border border-[hsl(12_60%_66%/.3)] bg-[hsl(12_60%_66%/.06)] p-4 text-sm text-[hsl(12_70%_80%)] space-y-1.5">
          <p className="flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" />تنبيهات قبل التحويل</p>
          <p>أرسل USDT فقط وعلى شبكة Polygon فقط. أي رمز أو شبكة أخرى قد تضيع ولا يمكن استرجاعها.</p>
          <p>أرسل المبلغ الدقيق أعلاه، واحتسب رسوم السحب من منصتك بحيث يصل المبلغ كاملًا.</p>
          <p>استخدم هذا العنوان المحفوظ في الطلب فقط، وليس أي عنوان من مصدر آخر.</p>
        </div>
      </div>

      <form onSubmit={submit} className="glass rounded-3xl p-4 space-y-4 sm:p-7">
        <h3 className="font-display font-medium">بعد التحويل: ارفع صورة الإيصال</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">ارفع صورة واضحة تعرض تفاصيل التحويل قدر الإمكان. لا تحتاج إلى إدخال رمز المعاملة؛ ستراجع الإدارة الإيصال وتتحقق يدويًا من وصول USDT على Polygon.</p>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} data-testid="input-receipt-file" />
        <button type="button" data-testid="button-pick-receipt" onClick={() => fileRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground hover:bg-[hsl(40_40%_90%/.03)]">
          <Upload className="h-4 w-4" />{file ? <span className="text-foreground">{file.name} · <span className="num">{(file.size / 1024 / 1024).toFixed(2)} MB</span></span> : "اختر صورة الإيصال (PNG / JPEG / WebP حتى 5MB)"}
        </button>
        {err && <p data-testid="text-proof-error" className="text-sm text-[hsl(4_80%_76%)]">{err}</p>}
        <button data-testid="button-submit-proof" disabled={busy} className="btn-gold w-full py-3">{uploading ? "جارٍ رفع الصورة..." : proof.isPending ? "جارٍ الإرسال..." : "إرسال للمراجعة"}</button>
        <button type="button" data-testid="button-cancel-deposit" onClick={() => setConfirmCancel(true)} disabled={busy || cancel.isPending} className="btn-ghost w-full py-2.5 text-sm text-muted-foreground">إلغاء الطلب</button>
      </form>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent dir="rtl" className="glass-strong border-border bg-transparent">
          <AlertDialogHeader className="text-right sm:text-right">
            <AlertDialogTitle className="font-display">إلغاء طلب الإيداع؟</AlertDialogTitle>
            <AlertDialogDescription>إذا كنت قد حوّلت المبلغ بالفعل فلا تلغِ الطلب، بل ارفع الإيصال أو تواصل مع الدعم أولًا. الإلغاء بعد التحويل قد يصعّب تتبع أموالك.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:flex-row-reverse sm:justify-start">
            <AlertDialogAction data-testid="button-confirm-cancel" className="btn-gold border-0" disabled={cancel.isPending} onClick={(e) => { e.preventDefault(); cancel.mutate({ id: d.id }); }}>{cancel.isPending ? "جارٍ الإلغاء..." : "لم أحوّل، ألغِ الطلب"}</AlertDialogAction>
            <AlertDialogCancel data-testid="button-keep-deposit" className="btn-ghost bg-transparent">تراجع</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
