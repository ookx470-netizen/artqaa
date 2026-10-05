import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, Redirect } from "wouter";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { Phone, Lock, UserRound, Eye, EyeOff, ArrowLeft, Fingerprint, Sunrise, Scale, Ticket } from "lucide-react";
import { useLogin, useRegister, getGetSessionQueryKey } from "@workspace/api-client-react";
import { Backdrop, Logo } from "@/components/brand";
import { TelegramButton, useSessionUser } from "@/components/shell";
import { apiError } from "@/lib/helpers";

const story = [
  { icon: Sunrise, t: "ربح يومي ثابت", d: "مبلغ ثابت تحدده الإدارة لكل خطة، يُقيَّد تلقائيًا بعد كل 24 ساعة كاملة من اعتماد الاشتراك، دون تراكم مركب." },
  { icon: Fingerprint, t: "هوية عضوية ثابتة", d: "رقم عضوية خاص بك ونقاط شرف تديرها الإدارة." },
  { icon: Scale, t: "مراجعة يدوية", d: "إيداعات USDT على Polygon تُراجع يدويًا مع إيصال، وكل حركة مسجلة بتاريخها." },
];

function AuthLayout({ children, title, sub }: { children: ReactNode; title: string; sub: string }) {
  return (
    <div className="grain relative min-h-[100dvh] overflow-hidden">
      <Backdrop />
      <div className="relative z-10 mx-auto grid min-h-[100dvh] max-w-6xl items-center gap-7 px-5 py-7 lg:grid-cols-[1.1fr_1fr] lg:gap-10 lg:py-10">
        <section className="mx-auto w-full max-w-md lg:max-w-none">
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .8 }}>
            <div className="mb-4 flex justify-center lg:mb-0 lg:justify-start"><Logo size={44} /></div>
            <h2 className="font-display mt-6 text-center text-4xl font-semibold leading-[1.2] sm:text-5xl xl:mt-12 xl:text-6xl lg:text-right lg:leading-[1.15]">
              تقدّم صغير كل يوم،<br /><span className="gold-text">يصنع أثرًا يُرى.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-md text-center leading-relaxed text-muted-foreground lg:mx-0 lg:mt-6 lg:text-right lg:leading-loose">
              ارتقاء منصة عضوية بخطط متعددة المدة. للخطة المجانية شرط توثيق بإيداع 4 USDT؛ وبعد مراجعة الإيصال واعتماده يُقيَّد الربح اليومي تلقائيًا خلال مدة الخطة.
            </p>
            <div className="mx-auto mt-5 max-w-md space-y-2 lg:mx-0 lg:mt-10 lg:space-y-3">
              {story.map((s, i) => (
                <motion.div key={s.t} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .3 + i * .12 }}
                  className="glass flex gap-4 rounded-2xl p-3 lg:p-4">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[hsl(168_42%_52%/.12)] text-accent"><s.icon className="h-5 w-5" /></div>
                  <div><p className="font-display font-medium">{s.t}</p><p className="text-sm text-muted-foreground mt-0.5">{s.d}</p></div>
                </motion.div>
              ))}
            </div>
            <div className="mt-5 flex justify-center gap-5 text-sm lg:mt-8 lg:justify-start">
              <Link href="/plans" data-testid="link-plans" className="text-primary hover:underline underline-offset-4">استعرض الخطط</Link>
              <Link href="/about" data-testid="link-about" className="text-muted-foreground hover:text-foreground">رؤيتنا</Link>
            </div>
          </motion.div>
        </section>

        <motion.section initial={{ opacity: 0, y: 24, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .7, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto w-full max-w-md">
          <div className="absolute -inset-px rounded-[2rem] bg-gradient-to-b from-[hsl(40_62%_68%/.35)] via-transparent to-[hsl(168_42%_52%/.25)]" />
          <div className="glass-strong relative rounded-[1.5rem] p-5 sm:rounded-[2rem] sm:p-8 md:p-10">
            <h1 className="font-display text-3xl font-semibold">{title}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{sub}</p>
            <div className="hairline my-7" />
            {children}
            <p className="mt-8 text-[11px] leading-relaxed text-muted-foreground/80">
              الأرصدة سجل داخلي وليست إثبات حفظ أموال. لا توجد عوائد مضمونة، وكل إيداع وسحب يُراجع يدويًا من الإدارة.
            </p>
          </div>
        </motion.section>
      </div>
      <TelegramButton />
    </div>
  );
}

function Field({ icon: Icon, label, type = "text", value, onChange, testid, placeholder, auto }: {
  icon: typeof Phone; label: string; type?: string; value: string; onChange: (v: string) => void; testid: string; placeholder?: string; auto?: string;
}) {
  const [show, setShow] = useState(false);
  const isPw = type === "password";
  return (
    <label className="block">
      <span className="mb-2 block text-sm text-muted-foreground">{label}</span>
      <div className="relative">
        <Icon className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input data-testid={testid} type={isPw && !show ? "password" : isPw ? "text" : type} value={value} autoComplete={auto}
          onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          dir={type === "tel" ? "ltr" : undefined}
          className={`field pr-11 ${isPw ? "pl-11" : ""} ${type === "tel" ? "text-right" : ""}`} />
        {isPw && (
          <button type="button" data-testid={`toggle-${testid}`} onClick={() => setShow(!show)} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </label>
  );
}

function ErrLine({ msg }: { msg: string }) {
  if (!msg) return null;
  return <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} data-testid="text-error"
    className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-[hsl(4_80%_78%)]">{msg}</motion.p>;
}

function useAuthSuccess() {
  const qc = useQueryClient();
  const [, setLoc] = useLocation();
  return (s: { user: unknown }) => {
    qc.clear();
    qc.setQueryData(getGetSessionQueryKey(), s);
    setLoc("/dashboard");
  };
}

const phoneOk = (p: string) => /^\+?[0-9]{10,15}$/.test(p.replace(/\s/g, ""));

export function LoginPage() {
  const { user } = useSessionUser();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const done = useAuthSuccess();
  const login = useLogin({ mutation: { onSuccess: done, onError: (e) => setErr(apiError(e, "رقم الهاتف أو كلمة المرور غير صحيحة")) } });
  if (user) return <Redirect to="/dashboard" />;
  const submit = (e: FormEvent) => {
    e.preventDefault(); setErr("");
    const p = phone.replace(/\s/g, "");
    if (!phoneOk(p)) return setErr("أدخل رقم هاتف صحيح من 10 إلى 15 رقمًا");
    if (password.length < 8) return setErr("كلمة المرور 8 أحرف على الأقل");
    login.mutate({ data: { phone: p, password } });
  };
  return (
    <AuthLayout title="مرحبًا بعودتك" sub="سجّل الدخول لمتابعة اشتراكك ورصيدك.">
      <form onSubmit={submit} className="space-y-5">
        <Field icon={Phone} label="رقم الهاتف" type="tel" value={phone} onChange={setPhone} testid="input-phone" placeholder="+9665XXXXXXXX" auto="tel" />
        <Field icon={Lock} label="كلمة المرور" type="password" value={password} onChange={setPassword} testid="input-password" auto="current-password" />
        <ErrLine msg={err} />
        <button data-testid="button-login" disabled={login.isPending} className="btn-gold group flex w-full items-center justify-center gap-2 py-3.5">
          {login.isPending ? "جارٍ التحقق..." : "تسجيل الدخول"}
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        ليس لديك حساب؟ <Link href="/register" data-testid="link-register" className="text-primary hover:underline underline-offset-4">أنشئ عضويتك</Link>
      </p>
    </AuthLayout>
  );
}

export function RegisterPage() {
  const { user } = useSessionUser();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState(() => (new URLSearchParams(window.location.search).get("ref") ?? "").trim().toUpperCase());
  const [err, setErr] = useState("");
  const done = useAuthSuccess();
  const reg = useRegister({ mutation: { onSuccess: done, onError: (e) => setErr(apiError(e, "تعذر إنشاء الحساب")) } });
  if (user) return <Redirect to="/dashboard" />;
  const strength = Math.min(4, [password.length >= 8, /[A-Z]/.test(password) || /[a-z]/.test(password), /\d/.test(password), /[^\w]/.test(password) || password.length >= 12].filter(Boolean).length);
  const submit = (e: FormEvent) => {
    e.preventDefault(); setErr("");
    const p = phone.replace(/\s/g, "");
    if (name.trim().length < 2) return setErr("الاسم حرفان على الأقل");
    if (!phoneOk(p)) return setErr("أدخل رقم هاتف صحيح من 10 إلى 15 رقمًا");
    if (password.length < 8) return setErr("كلمة المرور 8 أحرف على الأقل");
    const rc = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(rc)) return setErr("رمز الدعوة يجب أن يتكوّن من 6 أحرف أو أرقام.");
    reg.mutate({ data: { name: name.trim(), phone: p, password, referralCode: rc } });
  };
  return (
    <AuthLayout title="ابدأ عضويتك" sub="حساب عضو جديد خلال أقل من دقيقة.">
      <p data-testid="text-invite-only" className="mb-5 rounded-xl border border-[hsl(40_60%_70%/.25)] bg-[hsl(40_40%_90%/.05)] px-4 py-3 text-sm text-muted-foreground">
        العضوية في ارتقاء <span className="text-primary">بالدعوة فقط</span>. أدخل رمز الدعوة الذي حصلت عليه من عضو قائم.
      </p>
      <form onSubmit={submit} className="space-y-5">
        <Field icon={Ticket} label="رمز الدعوة (6 أحرف أو أرقام)" value={code.slice(0, 6)} onChange={(v) => setCode(v.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toUpperCase())} testid="input-referral-code" placeholder="A7K2P9" auto="off" />
        <Field icon={UserRound} label="الاسم الكامل" value={name} onChange={setName} testid="input-name" auto="name" />
        <Field icon={Phone} label="رقم الهاتف" type="tel" value={phone} onChange={setPhone} testid="input-phone" placeholder="+9665XXXXXXXX" auto="tel" />
        <div>
          <Field icon={Lock} label="كلمة المرور" type="password" value={password} onChange={setPassword} testid="input-password" auto="new-password" />
          <div className="mt-2 flex gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                <motion.div className="h-full bg-gradient-to-l from-[hsl(42_72%_76%)] to-[hsl(168_42%_52%)] origin-right" animate={{ scaleX: i < strength ? 1 : 0 }} />
              </div>
            ))}
          </div>
        </div>
        <ErrLine msg={err} />
        <button data-testid="button-register" disabled={reg.isPending} className="btn-gold group flex w-full items-center justify-center gap-2 py-3.5">
          {reg.isPending ? "جارٍ الإنشاء..." : "إنشاء الحساب"}
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        لديك حساب؟ <Link href="/" data-testid="link-login" className="text-primary hover:underline underline-offset-4">سجّل الدخول</Link>
      </p>
    </AuthLayout>
  );
}
