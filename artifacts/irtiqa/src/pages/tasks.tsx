import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Clock3, Coins, FileCheck2, LockKeyhole, RotateCcw, ShieldCheck, Timer } from "lucide-react";
import {
  getGetDashboardQueryKey, getGetTaskBoardQueryKey, getListActivityQueryKey,
  useGetTaskBoard, useSubmitTask, type TaskAssignment,
} from "@workspace/api-client-react";
import { ErrorBox, PageHead, Skel } from "@/components/brand";
import { apiError, dateAr, usdt, useCountdown } from "@/lib/helpers";

const statusCopy: Record<TaskAssignment["status"], string> = {
  available: "متاحة",
  submitted: "بانتظار المراجعة",
  approved: "معتمدة",
  rejected: "تحتاج إلى تعديل",
};

const statusStyle: Record<TaskAssignment["status"], string> = {
  available: "border-primary/30 bg-primary/10 text-primary",
  submitted: "border-[hsl(210_50%_65%/.35)] bg-[hsl(210_50%_65%/.08)] text-[hsl(210_60%_78%)]",
  approved: "border-accent/35 bg-accent/10 text-accent",
  rejected: "border-[hsl(4_60%_66%/.35)] bg-[hsl(4_60%_60%/.08)] text-[hsl(4_80%_76%)]",
};

function TaskCard({ task, onSubmitted }: { task: TaskAssignment; onSubmitted: () => void }) {
  const qc = useQueryClient();
  const [evidence, setEvidence] = useState(task.evidence ?? "");
  const [error, setError] = useState("");
  const submit = useSubmitTask({
    mutation: {
      onSuccess: () => {
        setError("");
        onSubmitted();
        void qc.invalidateQueries({ queryKey: getGetTaskBoardQueryKey() });
        void qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        void qc.invalidateQueries({ queryKey: getListActivityQueryKey() });
      },
      onError: (err) => setError(apiError(err, "تعذر إرسال الإثبات. حاول مجددًا.")),
    },
  });
  const canSubmit = task.status === "available" || task.status === "rejected";
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const proof = evidence.trim();
    if (proof.length < 5) return setError("أضف تفاصيل كافية لإثبات إنجاز المهمة (5 أحرف على الأقل).");
    if (proof.length > 3000) return setError("لا يمكن أن يتجاوز الإثبات 3000 حرف.");
    submit.mutate({ id: task.id, data: { evidence: proof } });
  };

  return (
    <article data-testid={`card-task-${task.id}`} className="glass relative overflow-hidden rounded-3xl p-5 sm:p-7">
      <div className="absolute inset-y-0 right-0 w-1 bg-gradient-to-b from-[hsl(42_72%_76%/.8)] to-[hsl(168_42%_52%/.35)]" />
      <div className="flex flex-wrap items-start justify-between gap-4 pr-2">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[.18em] text-muted-foreground">مهمة الدورة</p>
          <h2 data-testid={`text-task-title-${task.id}`} className="mt-2 break-words font-display text-xl font-medium sm:text-2xl">{task.taskTitle}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-[hsl(40_62%_68%/.24)] bg-[hsl(40_62%_68%/.07)] px-3 py-2">
          <Coins className="h-4 w-4 text-primary" />
          <span data-testid={`text-task-reward-${task.id}`} className="num text-sm text-primary">{usdt(task.reward)}</span>
        </div>
      </div>
      <div className="mt-5 rounded-2xl border border-border/60 bg-background/25 p-4 sm:p-5">
        <p className="mb-2 text-xs text-muted-foreground">التعليمات</p>
        <p data-testid={`text-task-instructions-${task.id}`} className="whitespace-pre-wrap break-words text-sm leading-7 text-foreground/90">{task.instructions}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span data-testid={`status-task-${task.id}`} className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${statusStyle[task.status]}`}>
          {task.status === "approved" ? <Check className="h-3.5 w-3.5" /> : task.status === "submitted" ? <Clock3 className="h-3.5 w-3.5" /> : task.status === "rejected" ? <RotateCcw className="h-3.5 w-3.5" /> : <FileCheck2 className="h-3.5 w-3.5" />}
          {statusCopy[task.status]}
        </span>
        {task.submittedAt && <span className="text-xs text-muted-foreground">أُرسل {dateAr(task.submittedAt, true)}</span>}
        {task.reviewedAt && <span className="text-xs text-muted-foreground">مراجعة {dateAr(task.reviewedAt, true)}</span>}
      </div>

      {task.status === "submitted" && (
        <div data-testid={`notice-task-submitted-${task.id}`} className="mt-4 rounded-2xl border border-[hsl(210_50%_65%/.25)] bg-[hsl(210_50%_65%/.06)] p-4 text-sm leading-relaxed text-[hsl(210_60%_82%)]">
          وصل إثباتك إلى الإدارة. ستظهر النتيجة هنا بعد المراجعة اليدوية.
        </div>
      )}
      {task.status === "approved" && (
        <div data-testid={`notice-task-approved-${task.id}`} className="mt-4 rounded-2xl border border-accent/25 bg-accent/5 p-4 text-sm leading-relaxed text-accent">
          تمت الموافقة. أُضيف المكافأة إلى رصيدك الداخلي بعملة USDT.
          {task.reviewNote && <p className="mt-2 text-foreground/75">ملاحظة الإدارة: {task.reviewNote}</p>}
        </div>
      )}
      {task.status === "rejected" && (
        <div data-testid={`notice-task-rejected-${task.id}`} className="mt-4 rounded-2xl border border-[hsl(4_60%_66%/.28)] bg-[hsl(4_60%_60%/.06)] p-4 text-sm leading-relaxed text-[hsl(4_80%_80%)]">
          يرجى مراجعة الملاحظة ثم تعديل الإثبات وإرساله مجددًا خلال الدورة الحالية.
          {task.reviewNote && <p data-testid={`text-task-review-note-${task.id}`} className="mt-2 text-foreground/85">ملاحظة الإدارة: {task.reviewNote}</p>}
        </div>
      )}
      {canSubmit && (
        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <label htmlFor={`proof-${task.id}`} className="block text-sm font-medium">{task.status === "rejected" ? "تعديل الإثبات وإعادة الإرسال" : "إثبات الإنجاز"}</label>
          <textarea id={`proof-${task.id}`} data-testid={`input-task-evidence-${task.id}`} value={evidence} onChange={(event) => setEvidence(event.target.value)} maxLength={3000} rows={5}
            placeholder="اكتب وصفًا واضحًا لما أنجزته، وأرفق رابطًا عند الحاجة." className="field min-h-32 resize-y leading-6" />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">{evidence.length} / 3000 حرفًا</span>
            <button data-testid={`button-submit-task-${task.id}`} type="submit" disabled={submit.isPending} className="btn-gold flex min-h-11 items-center justify-center gap-2 px-5 py-2.5 text-sm">
              {submit.isPending ? "جارٍ الإرسال..." : task.status === "rejected" ? "إعادة إرسال الإثبات" : "إرسال للمراجعة"}
            </button>
          </div>
          {error && <p data-testid={`text-task-error-${task.id}`} role="alert" className="text-sm text-[hsl(4_80%_76%)]">{error}</p>}
        </form>
      )}
      {task.evidence && !canSubmit && task.status !== "approved" && (
        <details className="mt-4 rounded-xl border border-border/60 p-3">
          <summary className="cursor-pointer text-xs text-muted-foreground">عرض الإثبات المرسل</summary>
          <p data-testid={`text-task-evidence-${task.id}`} className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{task.evidence}</p>
        </details>
      )}
    </article>
  );
}

export function TasksPage() {
  const board = useGetTaskBoard({ query: { queryKey: getGetTaskBoardQueryKey(), refetchOnWindowFocus: true, refetchInterval: 30000 } });
  const [sentMessage, setSentMessage] = useState("");
  const countdown = useCountdown(board.data?.nextCycleAt);
  if (board.isLoading) {
    return <div className="space-y-6"><Skel className="h-28" /><div className="grid gap-4 lg:grid-cols-2"><Skel className="h-96" /><Skel className="h-96" /></div></div>;
  }
  if (board.isError || !board.data) return <ErrorBox onRetry={() => board.refetch()} />;

  const { data } = board;
  const tasks = data.tasks ?? [];
  const activeCount = tasks.filter((task) => task.status !== "approved").length;
  return (
    <div dir="rtl">
      <PageHead eyebrow="مساحة الإنجاز" title="مهام دورتك" desc="مهمتان لكل دورة اشتراك مدفوعة مدتها 24 ساعة. أرسل إثباتك لتراجعه الإدارة يدويًا." />
      <section className="glass relative mb-5 overflow-hidden rounded-3xl p-5 sm:mb-7 sm:p-7">
        <div className="absolute -left-14 -top-16 h-56 w-56 rounded-full border border-[hsl(40_62%_68%/.1)]" />
        <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-primary"><ShieldCheck className="h-4 w-4" /><span className="text-xs tracking-wide">الدورة الحالية</span></div>
            <p data-testid="text-task-board-message" className="mt-3 text-sm leading-7 text-foreground/85">{data.message}</p>
            <p className="mt-3 max-w-2xl text-xs leading-6 text-muted-foreground">تُضاف مكافآت المهام المعتمدة إلى رصيدك الداخلي بعملة USDT بعد مراجعة يدوية. لا يُنفَّذ تحويل على السلسلة عند اعتماد المهمة.</p>
          </div>
          {data.eligible && data.nextCycleAt && (
            <div className="min-w-[190px] rounded-2xl border border-[hsl(40_62%_68%/.2)] bg-background/35 px-4 py-3">
              <p className="flex items-center gap-2 text-xs text-muted-foreground"><Timer className="h-4 w-4 text-primary" />بداية الدورة التالية</p>
              <p data-testid="text-task-countdown" className="num mt-2 text-2xl font-medium text-primary">{countdown?.text ?? "--:--:--"}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{dateAr(data.nextCycleAt, true)}</p>
            </div>
          )}
        </div>
        {data.cycleStartAt && <p data-testid="text-task-cycle-start" className="relative mt-5 border-t border-border/50 pt-4 text-xs text-muted-foreground">بدأت هذه الدورة {dateAr(data.cycleStartAt, true)} · مهمتان كحد أقصى خلال كل دورة</p>}
      </section>

      {sentMessage && <p role="status" data-testid="text-task-success" className="mb-4 rounded-2xl border border-accent/25 bg-accent/5 p-3 text-sm text-accent">{sentMessage}</p>}
      {!data.eligible ? (
        <section data-testid="state-tasks-ineligible" className="glass rounded-3xl border border-[hsl(40_62%_68%/.2)] p-7 sm:p-10">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-primary/25 bg-primary/10 text-primary"><LockKeyhole className="h-5 w-5" /></div>
          <h2 className="mt-4 text-center font-display text-xl">المهام متاحة مع اشتراك مدفوع نشط</h2>
          <p className="mx-auto mt-2 max-w-lg text-center text-sm leading-7 text-muted-foreground">{data.message || "لا يمكن للخطة المجانية تفعيل المهام. يلزم اشتراك مدفوع نشط."}</p>
        </section>
      ) : tasks.length === 0 ? (
        <section data-testid="state-tasks-empty" className="glass rounded-3xl p-8 text-center sm:p-12">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-border text-muted-foreground"><FileCheck2 className="h-5 w-5" /></div>
          <h2 className="mt-4 font-display text-xl">لا توجد مهام في هذه الدورة</h2>
          <p className="mt-2 text-sm text-muted-foreground">ستظهر مهامك هنا عند تجهيز التعيين التالي.</p>
        </section>
      ) : tasks.length < 2 ? (
        <section data-testid="state-tasks-waiting" className="mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-6 text-muted-foreground">بانتظار تجهيز المهمتين لهذه الدورة. المهام الحالية أدناه إن توفرت.</section>
      ) : null}

      {data.eligible && tasks.length > 0 && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg">التعيينات</h2>
            <span data-testid="text-task-progress" className="text-xs text-muted-foreground">{tasks.length} من مهمتين · {activeCount} قيد الإنجاز أو المراجعة</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {tasks.map((task) => <TaskCard key={task.id} task={task} onSubmitted={() => setSentMessage("تم إرسال الإثبات. ستظهر حالة المراجعة عند تحديث لوحة المهام.")} />)}
          </div>
        </>
      )}
    </div>
  );
}
