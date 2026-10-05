import { Link } from "wouter";
import { motion } from "framer-motion";
import { Check, Compass, Eye, HandHeart, ShieldAlert, Settings2 } from "lucide-react";
import { useListPlans, getListPlansQueryKey } from "@workspace/api-client-react";
import { PageHead, Skel, ErrorBox } from "@/components/brand";
import { useSessionUser } from "@/components/shell";
import { usdt, FREE_PLAN_ID, planDurationDays } from "@/lib/helpers";

export function PlansPage() {
  const { user } = useSessionUser();
  const plans = useListPlans({ query: { queryKey: getListPlansQueryKey(), refetchInterval: 30000 } });
  return (
    <>
      <PageHead eyebrow="العضوية" title="الخطط المتاحة" desc="تختلف مدة كل خطة وسعرها. يُقيَّد الربح اليومي بعد كل 24 ساعة كاملة دون تراكم مركب. لا توجد عوائد مضمونة." />
      {plans.isLoading ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <Skel key={i} className="h-80" />)}</div>
        : plans.isError ? <ErrorBox onRetry={() => plans.refetch()} />
        : !plans.data?.length ? (
          <div data-testid="empty-plans" className="glass rounded-3xl p-12 text-center">
            <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-[hsl(40_62%_68%/.1)] text-primary"><Settings2 className="h-7 w-7" /></div>
            <p className="font-display text-xl">لا توجد خطط مُهيأة بعد</p>
            <p className="mt-2 text-muted-foreground max-w-md mx-auto leading-relaxed">تعمل الإدارة على ضبط أسعار الخطط والربح اليومي وعناوين الاستلام والشروط. ستظهر الخطط هنا فور اكتمال الإعداد.</p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {plans.data.map((p, i) => (
              <motion.div key={p.id} data-testid={`card-plan-${p.id}`} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .08 }}
                className="glass relative flex flex-col rounded-3xl p-5 sm:p-7">
                <p className="font-display text-xl">{p.name}</p>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed min-h-[3rem]">{p.description}</p>
                <p className="mt-6"><span className="font-display text-3xl font-semibold gold-text">{p.id === FREE_PLAN_ID ? "مجانية" : <span className="num">{usdt(p.annualPrice)}</span>}</span>{p.id !== FREE_PLAN_ID && <span className="text-sm text-muted-foreground"> / سنويًا</span>}</p>
                <ul className="mt-6 space-y-3 text-sm flex-1">
                  <li className="flex gap-2"><Check className="h-4 w-4 text-accent mt-0.5" /><span>ربح يومي ثابت <span className="num">{usdt(p.dailyProfit)}</span></span></li>
                  <li className="flex gap-2"><Check className="h-4 w-4 text-accent mt-0.5" />يُقيَّد بعد كل 24 ساعة كاملة من الاعتماد</li>
                  <li className="flex gap-2"><Check className="h-4 w-4 text-accent mt-0.5" />مدة العقد {planDurationDays(p.id)} يومًا</li>
                  {p.id === FREE_PLAN_ID && <li className="flex gap-2 text-primary"><Check className="h-4 w-4 mt-0.5" /><span>توثيق الحساب بإيداع 4 USDT لمنع إنشاء أكثر من حساب</span></li>}
                </ul>
                <Link href={user ? "/deposits" : "/register"} data-testid={`link-join-${p.id}`} className="btn-gold mt-7 block py-3 text-center">{user ? p.id === FREE_PLAN_ID ? "ابدأ التوثيق" : "ابدأ الإيداع" : "أنشئ حسابًا للاشتراك"}</Link>
              </motion.div>
            ))}
          </div>
        )}
    </>
  );
}

const pillars = [
  { icon: Compass, t: "قواعد ثابتة", d: "لكل خطة سعر سنوي وربح يومي ثابت يحددهما المسؤول. لا مهام، ولا فوائد مركبة، ولا شروط مخفية." },
  { icon: Eye, t: "سجل داخلي شفاف", d: "كل قيد على رصيدك مسجل بتاريخه ونوعه. الرصيد سجل محاسبي داخلي وليس إثباتًا لحفظ أموال." },
  { icon: HandHeart, t: "مراجعة بشرية", d: "كل إيداع وسحب يراجعه مسؤول يدويًا، وكل قرار إداري مسجّل باسم منفّذه." },
];

export function AboutPage() {
  return (
    <>
      <section className="py-10 md:py-16 max-w-3xl">
        <p className="text-xs tracking-[0.2em] text-accent mb-4">عن ارتقاء</p>
        <h1 className="font-display text-4xl md:text-6xl font-semibold leading-[1.2]">قواعد واضحة،<br /><span className="gold-text">لا وعود ثراء.</span></h1>
        <p className="mt-8 text-lg text-muted-foreground leading-loose">
          يختار العضو خطة بمدة محددة، ويودع المبلغ الموضح بعملة USDT على شبكة Polygon، ثم يرفع إيصال التحويل. بعد مراجعة المسؤول واعتماده، يُقيَّد الربح اليومي تلقائيًا طوال مدة الخطة، وحتى 365 يومًا كحد أقصى.
        </p>
      </section>
      <div className="glass mb-8 flex gap-3 rounded-3xl border-[hsl(12_60%_66%/.25)] p-4 sm:mb-12 sm:gap-4 sm:p-6">
        <ShieldAlert className="h-6 w-6 shrink-0 text-[hsl(12_70%_74%)]" />
        <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
          <p className="font-display font-medium text-foreground text-base">إفصاحات مهمة</p>
          <p>ارتقاء غير تابعة لـ Binance أو OKX ولا ترتبط بهما بأي شراكة. الاسمان مجرد تسميات لعناوين استلام يضبطها المسؤول يدويًا، ولا يوجد أي تكامل برمجي معهما.</p>
          <p>الأرصدة المعروضة سجل داخلي وليست إثباتًا لحفظ الأموال. لا نقدم عوائد مضمونة، والتحقق من التحويلات يتم يدويًا دون ربط آلي بالبلوكتشين.</p>
          <p>أُغلقت أي أرصدة من المرحلة التجريبية السابقة، وبدأ السجل الحقيقي لكل عضو من الصفر.</p>
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-[1.4fr_1fr_1fr]">
        {pillars.map((p, i) => (
          <motion.div key={p.t} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * .1 }}
            className={`glass rounded-3xl p-5 sm:p-7 ${i === 0 ? "md:row-span-2" : ""}`}>
            <p.icon className="h-6 w-6 text-primary" />
            <p className="font-display text-xl mt-5">{p.t}</p>
            <p className="mt-2 text-muted-foreground leading-relaxed">{p.d}</p>
          </motion.div>
        ))}
        <div className="glass rounded-3xl p-5 sm:p-7 md:col-span-2">
          <p className="font-display text-xl">كيف تعمل؟</p>
          <ol className="mt-4 space-y-3 text-muted-foreground">
            <li><span className="num text-primary ml-2">01</span>أنشئ حسابك برقم الهاتف وكلمة مرور.</li>
            <li><span className="num text-primary ml-2">02</span>اختر خطة وقناة الاستلام، واقرأ الشروط، ثم أنشئ طلبًا لتحصل على العنوان والمبلغ الدقيق؛ توثيق الخطة المجانية يتطلب إيداع 4 USDT.</li>
            <li><span className="num text-primary ml-2">03</span>حوّل USDT على Polygon، ثم ارفع صورة الإيصال للمراجعة اليدوية.</li>
            <li><span className="num text-primary ml-2">04</span>بعد اعتماد المسؤول، يُقيَّد الربح اليومي الثابت تلقائيًا بعد كل 24 ساعة كاملة.</li>
          </ol>
        </div>
      </div>
      <div className="mt-14 text-center">
        <Link href="/plans" data-testid="link-about-plans" className="btn-gold inline-block px-8 py-3.5">استعرض الخطط</Link>
      </div>
    </>
  );
}
