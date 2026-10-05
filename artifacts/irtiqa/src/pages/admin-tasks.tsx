import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, Check, ClipboardCheck, Clock3, Coins, FileText, Pencil, Plus, RotateCcw, Save, ShieldCheck, X } from "lucide-react";
import {
  getGetDashboardQueryKey, getGetTaskBoardQueryKey, getListActivityQueryKey,
  getListAdminTaskSubmissionsQueryKey, getListAdminTasksQueryKey,
  useCreateAdminTask, useListAdminTasks, useListAdminTaskSubmissions,
  useReviewAdminTaskSubmission, useUpdateAdminTask,
  type AdminTaskSubmission, type TaskDefinition, type TaskInput,
} from "@workspace/api-client-react";
import { ErrorBox, Skel } from "@/components/brand";
import { apiError, dateAr, usdt } from "@/lib/helpers";
import { Switch } from "@/components/ui/switch";

type EditorItem = TaskDefinition | "new" | null;
type Filter = "all" | "submitted" | "reviewed";

const refreshKeys = [
  getListAdminTaskSubmissionsQueryKey(),
  getListAdminTasksQueryKey(),
  getGetTaskBoardQueryKey(),
  getListActivityQueryKey(),
  getGetDashboardQueryKey(),
];

function TaskEditor({ task, onClose, onSaved }: { task: EditorItem; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(task && task !== "new" ? task.title : "");
  const [instructions, setInstructions] = useState(task && task !== "new" ? task.instructions : "");
  const [reward, setReward] = useState(task && task !== "new" ? String(task.reward) : "");
  const [active, setActive] = useState(task === "new" ? true : task ? task.active : true);
  const [error, setError] = useState("");
  const qc = useQueryClient();
  const finish = () => {
    refreshKeys.forEach((queryKey) => void qc.invalidateQueries({ queryKey }));
    onSaved();
    onClose();
  };
  const create = useCreateAdminTask({ mutation: { onSuccess: finish, onError: (err) => setError(apiError(err)) } });
  const update = useUpdateAdminTask({ mutation: { onSuccess: finish, onError: (err) => setError(apiError(err)) } });
  const busy = create.isPending || update.isPending;

  const save = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const value = Number(reward);
    if (title.trim().length < 3 || title.trim().length > 100) return setError("عنوان المهمة بين 3 و100 حرف.");
    if (instructions.trim().length < 3 || instructions.trim().length > 3000) return setError("اكتب تعليمات واضحة بين 3 و3000 حرف.");
    if (!Number.isFinite(value) || value < 0.01 || value > 100000 || Math.round(value * 100) !== value * 100) return setError("المكافأة بين 0.01 و100000 USDT وبحد أقصى منزلتين عشريتين.");
    const data: TaskInput = { title: title.trim(), instructions: instructions.trim(), reward: value, active };
    if (task === "new") create.mutate({ data });
    else if (task) update.mutate({ id: task.id, data });
  };

  if (!task) return null;
  return (
    <form data-testid="form-admin-task" onSubmit={save} className="glass-strong mb-5 space-y-4 rounded-3xl border border-[hsl(40_62%_68%/.22)] p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[.16em] text-accent">إعداد المهمة</p>
          <h3 className="mt-1 font-display text-lg">{task === "new" ? "تعريف مهمة جديدة" : "تعديل تعريف المهمة"}</h3>
        </div>
        <button data-testid="button-close-task-editor" type="button" onClick={onClose} className="btn-ghost grid h-10 w-10 place-items-center text-muted-foreground" aria-label="إغلاق"><X className="h-4 w-4" /></button>
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_190px]">
        <label className="block text-sm text-muted-foreground">عنوان المهمة
          <input data-testid="input-admin-task-title" value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} maxLength={100} required className="field mt-2" />
        </label>
        <label className="block text-sm text-muted-foreground">المكافأة لكل إنجاز (USDT)
          <input data-testid="input-admin-task-reward" type="number" min="0.01" max="100000" step="0.01" value={reward} onChange={(event) => setReward(event.target.value)} required dir="ltr" className="field num mt-2 text-left" />
        </label>
      </div>
      <label className="block text-sm text-muted-foreground">التعليمات
        <textarea data-testid="input-admin-task-instructions" value={instructions} onChange={(event) => setInstructions(event.target.value)} minLength={3} maxLength={3000} rows={5} required className="field mt-2 resize-y leading-6" />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/60 p-3">
        <div><p className="text-sm">إتاحة المهمة للتعيين</p><p className="mt-1 text-xs text-muted-foreground">إيقافها يؤرشف التعريف دون حذف سجلّه.</p></div>
        <Switch data-testid="switch-admin-task-active" checked={active} onCheckedChange={setActive} />
      </div>
      {error && <p data-testid="text-admin-task-form-error" role="alert" className="text-sm text-[hsl(4_80%_76%)]">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button data-testid="button-cancel-admin-task" type="button" onClick={onClose} className="btn-ghost min-h-11 px-4 text-sm">إلغاء</button>
        <button data-testid="button-save-admin-task" type="submit" disabled={busy} className="btn-gold flex min-h-11 items-center gap-2 px-5 text-sm"><Save className="h-4 w-4" />{busy ? "جارٍ الحفظ..." : "حفظ التعريف"}</button>
      </div>
    </form>
  );
}

function DefinitionCard({ task, onEdit, onToggle, busy }: { task: TaskDefinition; onEdit: () => void; onToggle: (active: boolean) => void; busy: boolean }) {
  return (
    <article data-testid={`card-admin-task-${task.id}`} className={`glass rounded-2xl p-4 sm:p-5 ${task.active ? "" : "opacity-70"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words font-display text-lg">{task.title}</h3>
            {!task.active && <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">مؤرشفة</span>}
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{task.instructions}</p>
        </div>
        <span className="num shrink-0 rounded-xl border border-primary/20 bg-primary/5 px-2.5 py-1.5 text-xs text-primary">{usdt(task.reward)}</span>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 pt-3">
        <p className="text-[11px] text-muted-foreground">آخر تحديث: {dateAr(task.updatedAt, true)}</p>
        <div className="flex items-center gap-3">
          <button data-testid={`button-edit-admin-task-${task.id}`} onClick={onEdit} className="btn-ghost flex min-h-10 items-center gap-1.5 px-3 text-xs"><Pencil className="h-3.5 w-3.5" />تعديل</button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch data-testid={`switch-admin-task-${task.id}`} checked={task.active} disabled={busy} aria-label={task.active ? "أرشفة المهمة" : "إعادة تفعيل المهمة"} onCheckedChange={onToggle} />
            {task.active ? "نشطة" : "مؤرشفة"}
          </div>
        </div>
      </div>
    </article>
  );
}

function SubmissionCard({ submission, busy, onReview }: { submission: AdminTaskSubmission; busy: boolean; onReview: (decision: "approved" | "rejected", note: string) => void }) {
  const [note, setNote] = useState(submission.reviewNote ?? "");
  const [error, setError] = useState("");
  const isPending = submission.status === "submitted";
  const review = (decision: "approved" | "rejected") => {
    if (!isPending || busy) return;
    if (note.trim().length > 1000) return setError("لا يمكن أن تتجاوز الملاحظة 1000 حرف.");
    setError("");
    onReview(decision, note.trim());
  };
  const statusLabel = submission.status === "approved" ? "معتمدة" : submission.status === "rejected" ? "مرفوضة" : "بانتظار المراجعة";
  const badgeStyle = submission.status === "approved" ? "border-accent/35 bg-accent/10 text-accent" : submission.status === "rejected" ? "border-[hsl(4_60%_66%/.35)] bg-[hsl(4_60%_60%/.08)] text-[hsl(4_80%_76%)]" : "border-primary/30 bg-primary/10 text-primary";
  return (
    <article data-testid={`card-task-submission-${submission.id}`} className="glass rounded-3xl p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words font-display text-lg">{submission.taskTitle}</h3>
            <span data-testid={`status-task-submission-${submission.id}`} className={`rounded-full border px-2.5 py-1 text-[11px] ${badgeStyle}`}>{statusLabel}</span>
          </div>
          <p className="mt-2 text-sm">{submission.memberName} <span className="num mr-1 text-xs text-primary">{submission.memberNumber}</span></p>
          <p className="mt-1 text-xs text-muted-foreground">أُرسل {dateAr(submission.submittedAt, true)} · المكافأة <span className="num text-foreground">{usdt(submission.reward)}</span></p>
        </div>
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-primary/20 bg-primary/5 text-primary"><ClipboardCheck className="h-5 w-5" /></span>
      </div>
      <details className="mt-4 rounded-2xl border border-border/60 bg-background/20 p-4">
        <summary className="cursor-pointer text-xs text-muted-foreground">تعليمات المهمة</summary>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{submission.instructions}</p>
      </details>
      <div className="mt-4">
        <p className="mb-2 flex items-center gap-2 text-xs text-muted-foreground"><FileText className="h-3.5 w-3.5" />إثبات العضو</p>
        <div data-testid={`text-submission-evidence-${submission.id}`} className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-2xl border border-[hsl(40_62%_68%/.14)] bg-[hsl(40_62%_68%/.035)] p-4 text-sm leading-7">{submission.evidence}</div>
      </div>
      {isPending ? (
        <div className="mt-4 space-y-3 border-t border-border/50 pt-4">
          <label className="block text-xs text-muted-foreground">ملاحظة المراجعة <span className="text-muted-foreground/70">(اختيارية عند الموافقة، مطلوبة لتوضيح الرفض)</span>
            <textarea data-testid={`input-review-note-${submission.id}`} value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={3} className="field mt-2 resize-y" placeholder="ملاحظة تظهر للعضو عند القرار" />
          </label>
          {error && <p role="alert" className="text-xs text-[hsl(4_80%_76%)]">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button data-testid={`button-reject-submission-${submission.id}`} onClick={() => {
              if (!note.trim()) return setError("اكتب سبب الرفض حتى يعرف العضو ما يحتاج إلى تعديل.");
              review("rejected");
            }} disabled={busy} className="btn-ghost flex min-h-10 items-center gap-2 px-4 text-sm text-[hsl(4_80%_76%)]"><X className="h-4 w-4" />{busy ? "جارٍ الحفظ..." : "رفض الإثبات"}</button>
            <button data-testid={`button-approve-submission-${submission.id}`} onClick={() => review("approved")} disabled={busy} className="btn-gold flex min-h-10 items-center gap-2 px-4 text-sm"><Check className="h-4 w-4" />{busy ? "جارٍ الحفظ..." : "اعتماد وإضافة للرصد الداخلي"}</button>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-border/60 p-4 text-sm">
          <p className="text-xs text-muted-foreground">{submission.status === "approved" ? "تمت الموافقة" : "تم الرفض"}{submission.reviewedAt ? ` · ${dateAr(submission.reviewedAt, true)}` : ""}</p>
          {submission.reviewNote && <p data-testid={`text-review-note-${submission.id}`} className="mt-2 whitespace-pre-wrap leading-6">{submission.reviewNote}</p>}
        </div>
      )}
    </article>
  );
}

export function AdminTasksPanel({ enabled = true }: { enabled?: boolean }) {
  const qc = useQueryClient();
  const [editor, setEditor] = useState<EditorItem>(null);
  const [filter, setFilter] = useState<Filter>("submitted");
  const [reviewError, setReviewError] = useState("");
  const tasks = useListAdminTasks({ query: { enabled, queryKey: getListAdminTasksQueryKey(), refetchOnWindowFocus: true, refetchInterval: 30000 } });
  const submissions = useListAdminTaskSubmissions({ query: { enabled, queryKey: getListAdminTaskSubmissionsQueryKey(), refetchOnWindowFocus: true, refetchInterval: 30000 } });
  const invalidate = () => refreshKeys.forEach((queryKey) => void qc.invalidateQueries({ queryKey }));
  const update = useUpdateAdminTask({ mutation: { onSuccess: invalidate } });
  const review = useReviewAdminTaskSubmission({
    mutation: {
      onSuccess: () => { setReviewError(""); invalidate(); },
      onError: (err) => setReviewError(apiError(err, "تعذر حفظ قرار المراجعة.")),
    },
  });

  if (tasks.isLoading || submissions.isLoading) return <div className="space-y-4"><Skel className="h-16" /><div className="grid gap-4 lg:grid-cols-2"><Skel className="h-56" /><Skel className="h-56" /></div></div>;
  if (tasks.isError) return <ErrorBox onRetry={() => tasks.refetch()} text="تعذر تحميل تعريفات المهام" />;
  if (submissions.isError) return <ErrorBox onRetry={() => submissions.refetch()} text="تعذر تحميل إثباتات الأعضاء" />;
  const all = submissions.data ?? [];
  const pendingCount = all.filter((item) => item.status === "submitted").length;
  const visible = all.filter((item) => filter === "all" || (filter === "submitted" ? item.status === "submitted" : item.status !== "submitted"));

  return (
    <section dir="rtl" data-testid="panel-admin-tasks" className="space-y-8">
      <div className="glass relative overflow-hidden rounded-3xl p-5 sm:p-7">
        <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full border border-[hsl(40_62%_68%/.1)]" />
        <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="flex items-center gap-2 text-xs tracking-[.16em] text-accent"><ShieldCheck className="h-4 w-4" />تشغيل ومراجعة</p>
            <h2 className="mt-2 font-display text-2xl sm:text-3xl">إدارة المهام</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">كل عضو مؤهل يحصل على مهمتين لكل دورة اشتراك مدفوعة مدتها 24 ساعة. لا يتأهل أصحاب الخطة المجانية. المكافأة تُضاف إلى الرصيد الداخلي بعد اعتماد الإثبات يدويًا.</p>
          </div>
          <button data-testid="button-new-admin-task" onClick={() => setEditor("new")} className="btn-gold flex min-h-11 shrink-0 items-center justify-center gap-2 px-4 text-sm"><Plus className="h-4 w-4" />تعريف مهمة</button>
        </div>
      </div>

      <TaskEditor key={editor === "new" ? "new" : editor?.id ?? "closed"} task={editor} onClose={() => setEditor(null)} onSaved={() => setEditor(null)} />
      <section aria-labelledby="task-definitions-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-[11px] tracking-[.16em] text-muted-foreground">مكتبة التعيينات</p><h3 id="task-definitions-title" className="mt-1 font-display text-xl">تعريفات المهام</h3></div>
          <span data-testid="text-admin-task-count" className="text-xs text-muted-foreground">{tasks.data?.filter((task) => task.active).length ?? 0} نشطة / {tasks.data?.length ?? 0} إجمالي</span>
        </div>
        {!tasks.data?.length ? (
          <div data-testid="state-admin-tasks-empty" className="glass rounded-3xl p-8 text-center sm:p-10">
            <Archive className="mx-auto h-6 w-6 text-primary" /><p className="mt-3 font-display">لا توجد تعريفات بعد</p><p className="mt-1 text-sm text-muted-foreground">أنشئ تعريفًا نشطًا لبدء تجهيز تعيينات المهام.</p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {tasks.data.map((task) => <DefinitionCard key={task.id} task={task} onEdit={() => setEditor(task)} busy={update.isPending} onToggle={(active) => update.mutate({ id: task.id, data: { title: task.title, instructions: task.instructions, reward: task.reward, active } })} />)}
          </div>
        )}
      </section>

      <section aria-labelledby="task-reviews-title">
        <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div><p className="text-[11px] tracking-[.16em] text-muted-foreground">مراجعة بشرية</p><h3 id="task-reviews-title" className="mt-1 font-display text-xl">إثباتات الأعضاء</h3></div>
          <div className="flex flex-wrap items-center gap-2">
            <span data-testid="text-pending-task-reviews" className="rounded-full border border-primary/25 bg-primary/5 px-3 py-1.5 text-xs text-primary">{pendingCount} بانتظار القرار</span>
            <div className="flex rounded-xl border border-border bg-background/25 p-1">
              {([["submitted", "قيد المراجعة"], ["reviewed", "تمت مراجعتها"], ["all", "الكل"]] as [Filter, string][]).map(([value, label]) => (
                <button key={value} type="button" data-testid={`filter-task-submissions-${value}`} onClick={() => setFilter(value)} aria-pressed={filter === value} className={`rounded-lg px-3 py-2 text-xs transition-colors ${filter === value ? "bg-[hsl(40_62%_68%/.14)] text-primary" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>
              ))}
            </div>
          </div>
        </div>
        {reviewError && <p data-testid="text-review-error" role="alert" className="mb-3 rounded-xl border border-[hsl(4_60%_66%/.3)] bg-[hsl(4_60%_60%/.06)] p-3 text-sm text-[hsl(4_80%_76%)]">{reviewError}</p>}
        {!visible.length ? (
          <div data-testid="state-task-submissions-empty" className="glass rounded-3xl p-8 text-center sm:p-10">
            <Clock3 className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-3 font-display">{filter === "submitted" ? "لا توجد إثباتات تنتظر المراجعة" : "لا توجد إثباتات في هذا العرض"}</p>
            <p className="mt-1 text-sm text-muted-foreground">ستظهر هنا الإثباتات مع بيانات العضو وقيمة المكافأة.</p>
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {visible.map((submission) => <SubmissionCard key={submission.id} submission={submission} busy={review.isPending} onReview={(decision, note) => review.mutate({ id: submission.id, data: { decision, note } })} />)}
          </div>
        )}
      </section>
    </section>
  );
}
