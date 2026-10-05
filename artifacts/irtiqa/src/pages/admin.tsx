import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Users, Gem, Coins, Receipt, Plus, Pencil, Search, ArrowDownToLine, ArrowUpFromLine, Lock, AlertTriangle, UserRoundCog, KeyRound, Wallet, Trash2 } from "lucide-react";
import {
  useGetAdminStats, getGetAdminStatsQueryKey, useListUsers, getListUsersQueryKey, useUpdateUser, useUpdateHonor,
  useUpdateUserPassword, useAdjustUserBalance, useDeleteUser,
  useListAdminPlans, getListAdminPlansQueryKey, useCreatePlan, useUpdatePlan,
  useGetSettings, getGetSettingsQueryKey, useUpdateSettings, type User, type Plan, type PlanInput,
} from "@workspace/api-client-react";
import { PageHead, Skel, ErrorBox } from "@/components/brand";
import { DepositsReview, WithdrawalsReview } from "@/pages/admin-finance";
import { AdminTasksPanel } from "@/pages/admin-tasks";
import { useInvalidateAll } from "@/lib/invalidate";
import { useSessionUser } from "@/components/shell";
import { useToast } from "@/hooks/use-toast";
import { apiError, usdt, dateAr, isAddr } from "@/lib/helpers";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Tab = "deposits" | "withdrawals" | "users" | "plans" | "tasks" | "settings";

export function AdminPage() {
  const { user } = useSessionUser();
  const isAdmin = user?.role === "admin";
  const stats = useGetAdminStats({ query: { enabled: isAdmin, queryKey: getGetAdminStatsQueryKey(), refetchOnWindowFocus: true, refetchInterval: 30000 } });
  const [tab, setTab] = useState<Tab>("deposits");
  const cards = stats.data ? [
    { icon: Users, l: "الأعضاء", v: String(stats.data.users) },
    { icon: Gem, l: "اشتراكات نشطة", v: String(stats.data.activeSubscriptions) },
    { icon: ArrowDownToLine, l: "إيداعات بانتظار المراجعة", v: String(stats.data.pendingDeposits) },
    { icon: ArrowUpFromLine, l: "سحوبات مفتوحة", v: String(stats.data.pendingWithdrawals) },
    { icon: Lock, l: "رصيد محجوز", v: usdt(stats.data.reservedBalance) },
    { icon: Coins, l: "أرباح مُقيَّدة", v: usdt(stats.data.totalEarned) },
    { icon: Receipt, l: "مبيعات معتمدة", v: usdt(stats.data.annualSales) },
  ] : [];
  return (
    <>
      <PageHead eyebrow="لوحة الإدارة" title="إدارة ارتقاء" desc="الأرقام قيود داخلية في السجل. كل قرار يُسجَّل باسمك." />
      {stats.isLoading ? <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <Skel key={i} className="h-24" />)}</div>
        : stats.isError ? <ErrorBox onRetry={() => stats.refetch()} /> : (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <div key={c.l} className="glass min-w-0 rounded-2xl p-3 sm:p-5">
                <c.icon className="h-4 w-4 text-primary" />
                <p className="num break-all font-display text-lg leading-tight mt-3 sm:text-2xl" data-testid={`stat-${c.l}`}>{c.v}</p>
                <p className="break-words text-xs text-muted-foreground mt-1">{c.l}</p>
              </div>
            ))}
          </div>
        )}
      <SetupNotice enabled={isAdmin} />
      <div className="glass mt-8 flex max-w-full overflow-x-auto rounded-2xl p-1 w-fit">
        {([["deposits", "الإيداعات"], ["withdrawals", "السحوبات"], ["users", "الأعضاء"], ["plans", "الخطط"], ["tasks", "المهام"], ["settings", "الإعدادات"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} data-testid={`tab-${k}`} onClick={() => setTab(k)}
            className={`whitespace-nowrap rounded-xl px-5 py-2 text-sm transition-colors ${tab === k ? "bg-[hsl(40_62%_68%/.14)] text-primary" : "text-muted-foreground hover:text-foreground"}`}>{l}</button>
        ))}
      </div>
      <div className="mt-6">
        {tab === "deposits" && <DepositsReview enabled={isAdmin} />}
        {tab === "withdrawals" && <WithdrawalsReview enabled={isAdmin} />}
        {tab === "users" && <UsersPanel enabled={isAdmin} />}
        {tab === "plans" && <PlansPanel enabled={isAdmin} />}
        {tab === "tasks" && <AdminTasksPanel enabled={isAdmin} />}
        {tab === "settings" && <SettingsPanel />}
      </div>
    </>
  );
}

function UsersPanel({ enabled }: { enabled: boolean }) {
  const { user: currentUser } = useSessionUser();
  const { toast } = useToast();
  const users = useListUsers({ query: { enabled, queryKey: getListUsersQueryKey(), refetchOnWindowFocus: true, refetchInterval: 30000 } });
  const [search, setSearch] = useState("");
  const [honorFor, setHonorFor] = useState<User | null>(null);
  const [manageFor, setManageFor] = useState<User | null>(null);
  const refresh = useInvalidateAll();
  const upd = useUpdateUser({
    mutation: {
      onSuccess: (_u, variables) => {
        const active = variables.data.active;
        toast({ title: active === undefined ? "تم تحديث بيانات العضو" : active ? "تم تفعيل الحساب" : "تم إيقاف الحساب" });
        refresh();
      },
      onError: (e) => toast({ title: "تعذر التحديث", description: apiError(e), variant: "destructive" }),
    },
  });
  if (users.isLoading) return <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skel key={i} className="h-16" />)}</div>;
  if (users.isError) return <ErrorBox onRetry={() => users.refetch()} />;
  const list = (users.data ?? []).filter((u) => !search || u.name.includes(search) || (!u.phone.startsWith("deleted:") && u.phone.includes(search)) || u.memberId.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="glass rounded-3xl p-3 sm:p-5">
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input data-testid="input-search-users" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم أو الهاتف أو رقم العضوية" className="field pr-11 py-2.5 text-sm" />
      </div>
      {!list.length ? <p className="py-10 text-center text-muted-foreground">لا يوجد أعضاء مطابقون.</p> : (
        <>
        <div className="space-y-3 lg:hidden">
          {list.map((u) => (
            <article key={u.id} data-testid={`row-user-mobile-${u.id}`} className="rounded-2xl border border-border/70 bg-background/20 p-4">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words font-medium">{u.name} {u.role === "admin" && <span className="text-[10px] text-primary">مسؤول</span>}</p>
                  <p className="num mt-1 break-all text-xs text-muted-foreground">{u.phone.startsWith("deleted:") ? "بيانات مخفية" : u.phone}</p>
                </div>
                <span className="num shrink-0 text-sm text-primary">{u.memberId}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border/50 pt-3 text-sm">
                <div><p className="text-xs text-muted-foreground">الرصيد</p><p className="num mt-1">{usdt(u.balance)}</p></div>
                <div><p className="text-xs text-muted-foreground">نقاط الشرف</p><p className="num mt-1">{u.honorPoints}</p></div>
                <div><p className="text-xs text-muted-foreground">تاريخ الانضمام</p><p className="mt-1 text-xs">{dateAr(u.createdAt)}</p></div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{u.active ? "الحساب نشط" : "الحساب متوقف"}</span>
                  <Switch data-testid={`switch-active-mobile-${u.id}`} aria-label={u.active ? "إيقاف الحساب" : "تفعيل الحساب"} checked={u.active} disabled={upd.isPending || u.phone.startsWith("deleted:") || (u.id === currentUser?.id && u.role === "admin")} onCheckedChange={(v) => upd.mutate({ id: u.id, data: { active: v } })} />
                </div>
              </div>
              {!u.phone.startsWith("deleted:") && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-border/50 pt-3">
                  <button data-testid={`button-manage-user-mobile-${u.id}`} onClick={() => setManageFor(u)} className="btn-ghost flex min-h-10 items-center gap-1 px-3 py-2 text-xs"><UserRoundCog className="h-3.5 w-3.5" />إدارة العضو</button>
                  <button data-testid={`button-honor-mobile-${u.id}`} onClick={() => setHonorFor(u)} className="btn-ghost min-h-10 px-3 py-2 text-xs">نقاط الشرف</button>
                </div>
              )}
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-muted-foreground text-right">
              <th className="p-3 font-normal">العضو</th><th className="p-3 font-normal">رقم العضوية</th><th className="p-3 font-normal">الرصيد</th><th className="p-3 font-normal">الشرف</th><th className="p-3 font-normal">انضم</th><th className="p-3 font-normal">نشط</th><th className="p-3" />
            </tr></thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id} data-testid={`row-user-${u.id}`} className="border-t border-border/50 hover:bg-[hsl(40_40%_90%/.03)]">
                  <td className="p-3"><p>{u.name} {u.role === "admin" && <span className="text-[10px] text-primary">مسؤول</span>}</p><p className="num text-xs text-muted-foreground text-right">{u.phone.startsWith("deleted:") ? "بيانات مخفية" : u.phone}</p></td>
                  <td className="p-3 num text-primary">{u.memberId}</td>
                  <td className="p-3 num">{usdt(u.balance)}</td>
                  <td className="p-3 num">{u.honorPoints}</td>
                  <td className="p-3 text-xs text-muted-foreground">{dateAr(u.createdAt)}</td>
                  <td className="p-3"><Switch data-testid={`switch-active-${u.id}`} checked={u.active} disabled={upd.isPending || u.phone.startsWith("deleted:") || (u.id === currentUser?.id && u.role === "admin")} onCheckedChange={(v) => upd.mutate({ id: u.id, data: { active: v } })} /></td>
                  <td className="p-3"><div className="flex flex-wrap gap-1.5">
                    {!u.phone.startsWith("deleted:") && <button data-testid={`button-manage-user-${u.id}`} onClick={() => setManageFor(u)} className="btn-ghost flex items-center gap-1 px-2.5 py-1.5 text-xs"><UserRoundCog className="h-3.5 w-3.5" />إدارة</button>}
                    {!u.phone.startsWith("deleted:") && <button data-testid={`button-honor-${u.id}`} onClick={() => setHonorFor(u)} className="btn-ghost px-2.5 py-1.5 text-xs">الشرف</button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
      <HonorDialog user={honorFor} onClose={() => setHonorFor(null)} onDone={refresh} />
      <UserManagementDialog user={manageFor} onClose={() => setManageFor(null)} onDone={refresh} />
    </div>
  );
}

function UserManagementDialog({ user, onClose, onDone }: { user: User | null; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [payoutAddress, setPayoutAddress] = useState("");
  const [password, setPassword] = useState("");
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setPhone(user.phone);
    setPayoutAddress(user.payoutAddress ?? "");
    setPassword("");
    setDirection("credit");
    setAmount("");
    setReason("");
    setErr("");
    setConfirmDelete(false);
  }, [user]);

  const done = (message: string) => {
    setConfirmDelete(false);
    toast({ title: message });
    onDone();
    onClose();
  };
  const profile = useUpdateUser({
    mutation: {
      onSuccess: () => done("تم تحديث بيانات العضو"),
      onError: (e) => setErr(apiError(e)),
    },
  });
  const passwordMutation = useUpdateUserPassword({
    mutation: {
      onSuccess: (r) => done(r.message),
      onError: (e) => setErr(apiError(e)),
    },
  });
  const balanceMutation = useAdjustUserBalance({
    mutation: {
      onSuccess: () => done(direction === "credit" ? "تمت إضافة الرصيد" : "تم سحب الرصيد"),
      onError: (e) => setErr(apiError(e)),
    },
  });
  const deleteMutation = useDeleteUser({
    mutation: {
      onSuccess: () => done("أُخفيت بيانات العضو مع الاحتفاظ بسجله المالي"),
      onError: (e) => { setErr(apiError(e)); setConfirmDelete(false); },
    },
  });
  const busy = profile.isPending || passwordMutation.isPending || balanceMutation.isPending || deleteMutation.isPending;

  const saveProfile = (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!user || busy) return;
    if (name.trim().length < 2) return setErr("أدخل اسمًا من حرفين على الأقل.");
    if (phone.trim().length < 10) return setErr("أدخل رقم هاتف صحيحًا.");
    const wallet = payoutAddress.trim();
    if (user.payoutAddress && !wallet) return setErr("لا يمكن إزالة عنوان محفوظ؛ أدخل عنوان Polygon آخر لتغييره.");
    if (wallet && !isAddr(wallet)) return setErr("أدخل عنوان Polygon صحيحًا مكوّنًا من 42 خانة.");
    profile.mutate({ id: user.id, data: { name: name.trim(), phone: phone.trim(), payoutAddress: wallet || null } });
  };
  const savePassword = (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!user || busy) return;
    if (password.length < 8 || password.length > 128) return setErr("كلمة المرور من 8 إلى 128 حرفًا.");
    passwordMutation.mutate({ id: user.id, data: { password } });
  };
  const saveBalance = (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!user || busy) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0.01 || value > 1000000 || Math.abs(value * 100 - Math.round(value * 100)) > 0.000001) {
      return setErr("أدخل مبلغًا بين 0.01 و1,000,000 USDT وبحد أقصى منزلتين عشريتين.");
    }
    if (reason.trim().length < 3) return setErr("اكتب سببًا واضحًا من 3 أحرف على الأقل.");
    balanceMutation.mutate({ id: user.id, data: { direction, amount: value, reason: reason.trim() } });
  };

  return (
    <>
      <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
        <DialogContent dir="rtl" className="glass-strong max-h-[90dvh] overflow-y-auto border-border bg-transparent">
          <DialogHeader className="text-right sm:text-right">
            <DialogTitle className="font-display">إدارة العضو: {user?.name}</DialogTitle>
          </DialogHeader>
          {user && (
            <div className="space-y-5">
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>رقم العضوية <b className="num text-primary">{user.memberId}</b></span>
                <span>الرصيد الحالي <b className="num text-foreground">{usdt(user.balance)} USDT</b></span>
              </div>
              <form onSubmit={saveProfile} className="space-y-3 rounded-2xl border border-border p-4">
                <h3 className="flex items-center gap-2 text-sm font-medium"><Pencil className="h-4 w-4 text-primary" />الاسم ورقم الهاتف</h3>
                <label className="block text-xs text-muted-foreground">الاسم
                  <input data-testid="input-user-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className="field mt-1.5" /></label>
                <label className="block text-xs text-muted-foreground">رقم الهاتف
                  <input data-testid="input-user-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={16} dir="ltr" className="field num mt-1.5 text-left" /></label>
                <label className="block text-xs text-muted-foreground">عنوان محفظة السحب (Polygon)
                  <input data-testid="input-user-payout-address" value={payoutAddress} onChange={(e) => setPayoutAddress(e.target.value)} maxLength={42} placeholder="0x... عنوان Polygon للعضو" dir="ltr" className="field num mt-1.5 text-left" />
                  <span className="mt-1.5 block leading-relaxed">يمكن للإدارة استبداله، لكن لا يمكن إزالة عنوان محفوظ. الطلبات المفتوحة تحتفظ بالعنوان الذي أُرسل به الطلب.</span>
                </label>
                <button data-testid="button-save-user-profile" type="submit" disabled={busy} className="btn-gold w-full py-2.5 text-sm">حفظ البيانات</button>
              </form>

              <form onSubmit={savePassword} className="space-y-3 rounded-2xl border border-border p-4">
                <h3 className="flex items-center gap-2 text-sm font-medium"><KeyRound className="h-4 w-4 text-primary" />تعيين كلمة مرور جديدة</h3>
                <p className="text-xs leading-relaxed text-muted-foreground">لا يمكن عرض كلمة المرور الحالية. سيُطلب من العضو تسجيل الدخول مجددًا بعد تغييرها.</p>
                <input data-testid="input-user-new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} maxLength={128} placeholder="8 أحرف على الأقل" className="field" />
                <button data-testid="button-reset-user-password" type="submit" disabled={busy} className="btn-ghost flex w-full items-center justify-center gap-2 py-2.5 text-sm"><Lock className="h-4 w-4" />تغيير كلمة المرور</button>
              </form>

              <form onSubmit={saveBalance} className="space-y-3 rounded-2xl border border-border p-4">
                <h3 className="flex items-center gap-2 text-sm font-medium"><Wallet className="h-4 w-4 text-primary" />تعديل رصيد USDT</h3>
                <div className="grid grid-cols-[1fr_1.2fr] gap-2">
                  <select data-testid="select-balance-direction" value={direction} onChange={(e) => setDirection(e.target.value as "credit" | "debit")} className="field">
                    <option value="credit">إضافة رصيد</option>
                    <option value="debit">سحب رصيد</option>
                  </select>
                  <input data-testid="input-balance-amount" type="number" min="0.01" max="1000000" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="المبلغ" dir="ltr" className="field num text-left" />
                </div>
                <textarea data-testid="input-balance-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={2} placeholder="سبب التعديل (إلزامي)" className="field resize-none" />
                <p className="text-xs leading-relaxed text-muted-foreground">يُسجَّل التعديل في سجل العضو وسجل التدقيق. السحب لا يتجاوز الرصيد المتاح.</p>
                <button data-testid="button-adjust-user-balance" type="submit" disabled={busy} className="btn-ghost flex w-full items-center justify-center gap-2 py-2.5 text-sm"><Wallet className="h-4 w-4" />حفظ تعديل الرصيد</button>
              </form>

              {user.role !== "admin" && (
                <div className="rounded-2xl border border-[hsl(4_60%_55%/.35)] p-4">
                  <h3 className="flex items-center gap-2 text-sm font-medium text-[hsl(4_80%_76%)]"><Trash2 className="h-4 w-4" />إزالة العضو</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">سيُعطَّل الحساب وتُخفى بيانات الاسم والهاتف وتُنهى جلساته. تبقى حركاته المالية وسجلاته محفوظة للمراجعة، ولا يمكن التراجع عن إخفاء البيانات.</p>
                  <button data-testid="button-delete-user" type="button" disabled={busy} onClick={() => setConfirmDelete(true)} className="btn-ghost mt-3 flex w-full items-center justify-center gap-2 py-2.5 text-sm text-[hsl(4_80%_76%)]"><Trash2 className="h-4 w-4" />إخفاء البيانات وتعطيل الحساب</button>
                </div>
              )}
              {err && <p role="alert" className="text-sm text-[hsl(4_80%_76%)]">{err}</p>}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent dir="rtl" className="glass-strong border-border bg-transparent">
          <AlertDialogHeader className="text-right sm:text-right">
            <AlertDialogTitle className="font-display">تأكيد إزالة العضو</AlertDialogTitle>
            <AlertDialogDescription>سيصبح الحساب غير قابل للدخول، وستُخفى بيانات الاسم والهاتف. لن تُحذف الإيداعات أو السحوبات أو الأرصدة من السجل، ولا يمكن استعادة البيانات المخفية.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:flex-row-reverse sm:justify-start">
            <AlertDialogAction data-testid="button-confirm-delete-user" className="btn-gold border-0" disabled={deleteMutation.isPending} onClick={(e) => {
              e.preventDefault();
              if (user && !deleteMutation.isPending) deleteMutation.mutate({ id: user.id });
            }}>{deleteMutation.isPending ? "جارٍ الإزالة..." : "إخفاء البيانات وإزالة الحساب"}</AlertDialogAction>
            <AlertDialogCancel data-testid="button-cancel-delete-user" className="btn-ghost bg-transparent">إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function HonorDialog({ user, onClose, onDone }: { user: User | null; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [points, setPoints] = useState("0");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { if (user) { setPoints(String(user.honorPoints)); setReason(""); setErr(""); } }, [user]);
  const m = useUpdateHonor({
    mutation: {
      onSuccess: () => { toast({ title: "تم تحديث نقاط الشرف" }); onDone(); onClose(); },
      onError: (e) => setErr(apiError(e)),
    },
  });
  const submit = (e: FormEvent) => {
    e.preventDefault(); setErr("");
    const p = Number(points);
    if (!Number.isInteger(p) || p < 0 || p > 100) return setErr("النقاط بين 0 و100");
    if (reason.trim().length < 3) return setErr("اكتب سببًا واضحًا (3 أحرف على الأقل)");
    if (user) m.mutate({ id: user.id, data: { points: p, reason: reason.trim() } });
  };
  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="glass-strong border-border bg-transparent">
        <DialogHeader className="text-right sm:text-right"><DialogTitle className="font-display">نقاط شرف: {user?.name}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <label className="block"><span className="text-sm text-muted-foreground">القيمة الجديدة (0–100)</span>
            <input data-testid="input-honor-points" type="number" min={0} max={100} value={points} onChange={(e) => setPoints(e.target.value)} className="field num mt-2" dir="ltr" /></label>
          <label className="block"><span className="text-sm text-muted-foreground">السبب</span>
            <textarea data-testid="input-honor-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={3} className="field mt-2 resize-none" /></label>
          {err && <p className="text-sm text-[hsl(4_80%_76%)]">{err}</p>}
          <button data-testid="button-save-honor" disabled={m.isPending} className="btn-gold w-full py-3">{m.isPending ? "جارٍ الحفظ..." : "حفظ"}</button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SetupNotice({ enabled }: { enabled: boolean }) {
  const plans = useListAdminPlans({ query: { enabled, queryKey: getListAdminPlansQueryKey(), refetchInterval: 30000 } });
  const s = useGetSettings({ query: { queryKey: getGetSettingsQueryKey(), refetchInterval: 30000 } });
  if (!plans.data || !s.data) return null;
  const missing: string[] = [];
  if (!plans.data.some((p) => p.configured && p.active)) missing.push("عدّل خطة واحدة على الأقل لضبط السعر السنوي والربح اليومي الثابت وتفعيلها (الخطط الأولية غير مُهيأة).");
  if (!isAddr(s.data.binanceAddress) && !isAddr(s.data.okxAddress)) missing.push("أضف عنوان استلام Polygon صالحًا واحدًا على الأقل (Binance أو OKX).");
  if (!s.data.fundingDescription.trim() || !s.data.terms.trim()) missing.push("اكتب وصف التمويل والشروط التي يوافق عليها العضو.");
  if (!s.data.depositsEnabled) missing.push("فعّل الإيداع يدويًا من الإعدادات بعد اكتمال ما سبق. لا يُفعَّل تلقائيًا.");
  if (!missing.length) return null;
  return (
      <div data-testid="notice-setup" className="glass mt-6 rounded-3xl border-[hsl(40_62%_68%/.3)] p-4 sm:p-6">
      <p className="font-display flex items-center gap-2 text-primary"><AlertTriangle className="h-4 w-4" />الإيداع لم يُفتح للأعضاء بعد</p>
      <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground list-disc pr-5">{missing.map((m) => <li key={m}>{m}</li>)}</ul>
    </div>
  );
}

const emptyPlan: PlanInput = { name: "", description: "", annualPrice: 0, dailyProfit: 0, active: true };

function PlansPanel({ enabled }: { enabled: boolean }) {
  const { toast } = useToast();
  const plans = useListAdminPlans({ query: { enabled, queryKey: getListAdminPlansQueryKey() } });
  const [editing, setEditing] = useState<Plan | "new" | null>(null);
  const refresh = useInvalidateAll();
  const upd = useUpdatePlan({
    mutation: {
      onSuccess: (p) => { toast({ title: p.active ? "الخطة مفعّلة" : "تم تعطيل الخطة" }); refresh(); },
      onError: (e) => toast({ title: "تعذر التحديث", description: apiError(e), variant: "destructive" }),
    },
  });
  if (plans.isLoading) return <div className="grid gap-3 md:grid-cols-2">{[0, 1].map((i) => <Skel key={i} className="h-40" />)}</div>;
  if (plans.isError) return <ErrorBox onRetry={() => plans.refetch()} />;
  return (
    <>
      <div className="mb-4 flex justify-end"><button data-testid="button-new-plan" onClick={() => setEditing("new")} className="btn-gold flex items-center gap-2 px-4 py-2.5 text-sm"><Plus className="h-4 w-4" />خطة جديدة</button></div>
      {!plans.data?.length ? <div className="glass rounded-3xl p-8 text-center text-muted-foreground sm:p-12">لا توجد خطط بعد. أنشئ أول خطة.</div> : (
        <div className="grid gap-3 md:grid-cols-2">
          {plans.data.map((p) => (
            <div key={p.id} data-testid={`card-admin-plan-${p.id}`} className={`glass rounded-2xl p-4 sm:p-5 ${p.active ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-display text-lg">{p.name}</p><p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p></div>
                <Switch data-testid={`switch-plan-${p.id}`} checked={p.active} disabled={upd.isPending}
                  onCheckedChange={(v) => upd.mutate({ id: p.id, data: { name: p.name, description: p.description, annualPrice: p.annualPrice, dailyProfit: p.dailyProfit, active: v } })} />
              </div>
              {!p.configured && <p className="mt-3 rounded-xl border border-[hsl(40_62%_68%/.3)] bg-[hsl(40_62%_68%/.06)] p-2 text-xs text-primary">غير مُهيأة: لن تظهر للأعضاء حتى تحفظ السعر والربح اليومي.</p>}
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                <span><span className="text-muted-foreground">السعر السنوي </span><span className="num">{usdt(p.annualPrice)}</span></span>
                <span><span className="text-muted-foreground">ربح يومي ثابت </span><span className="num">{usdt(p.dailyProfit)}</span></span>
              </div>
              <button data-testid={`button-edit-plan-${p.id}`} onClick={() => setEditing(p)} className="btn-ghost mt-4 flex items-center gap-2 px-3 py-1.5 text-xs"><Pencil className="h-3 w-3" />تعديل</button>
            </div>
          ))}
        </div>
      )}
      <PlanDialog plan={editing} onClose={() => setEditing(null)} onDone={refresh} />
    </>
  );
}

function PlanDialog({ plan, onClose, onDone }: { plan: Plan | "new" | null; onClose: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [f, setF] = useState({ name: "", description: "", annualPrice: "", dailyProfit: "", active: true });
  const [err, setErr] = useState("");
  useEffect(() => {
    if (!plan) return;
    const src = plan === "new" ? emptyPlan : plan;
    setF({ name: src.name, description: src.description, annualPrice: src.annualPrice ? String(src.annualPrice) : "", dailyProfit: src.dailyProfit ? String(src.dailyProfit) : "", active: src.active });
    setErr("");
  }, [plan]);
  const opts = { mutation: { onSuccess: () => { toast({ title: "تم حفظ الخطة" }); onDone(); onClose(); }, onError: (e: unknown) => setErr(apiError(e)) } };
  const create = useCreatePlan(opts);
  const update = useUpdatePlan(opts);
  const busy = create.isPending || update.isPending;
  const submit = (e: FormEvent) => {
    e.preventDefault(); setErr("");
    const data: PlanInput = { name: f.name.trim(), description: f.description.trim(), annualPrice: Number(f.annualPrice), dailyProfit: Number(f.dailyProfit), active: f.active };
    if (data.name.length < 2) return setErr("اسم الخطة حرفان على الأقل");
    if (!(data.annualPrice >= 0.01 && data.annualPrice <= 100000)) return setErr("السعر السنوي بين 0.01 و100000 USDT");
    if (!(data.dailyProfit >= 0 && data.dailyProfit <= 100000) || f.dailyProfit === "") return setErr("الربح اليومي بين 0 و100000 USDT");
    if (plan === "new") create.mutate({ data }); else if (plan) update.mutate({ id: plan.id, data });
  };
  return (
    <Dialog open={!!plan} onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="glass-strong border-border bg-transparent max-h-[90dvh] overflow-y-auto">
        <DialogHeader className="text-right sm:text-right"><DialogTitle className="font-display">{plan === "new" ? "خطة جديدة" : "تعديل الخطة"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <label className="block"><span className="text-sm text-muted-foreground">الاسم</span>
            <input data-testid="input-plan-name" value={f.name} maxLength={60} onChange={(e) => setF({ ...f, name: e.target.value })} className="field mt-2" /></label>
          <label className="block"><span className="text-sm text-muted-foreground">الوصف</span>
            <textarea data-testid="input-plan-description" maxLength={500} rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className="field mt-2 resize-none" /></label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block"><span className="text-sm text-muted-foreground">السعر السنوي USDT</span>
              <input data-testid="input-plan-annualPrice" type="number" step="any" value={f.annualPrice} onChange={(e) => setF({ ...f, annualPrice: e.target.value })} className="field num mt-2" dir="ltr" /></label>
            <label className="block"><span className="text-sm text-muted-foreground">ربح يومي ثابت USDT</span>
              <input data-testid="input-plan-dailyProfit" type="number" step="any" value={f.dailyProfit} onChange={(e) => setF({ ...f, dailyProfit: e.target.value })} className="field num mt-2" dir="ltr" /></label>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">يُقيَّد الربح اليومي بعد كل 24 ساعة كاملة من الاعتماد، بحد أقصى 365 يومًا ودون تراكم. التعديل لا يغيّر طلبات قائمة حُفظت لقطتها.</p>
          <label className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">نشطة ومعروضة للأعضاء
            <Switch data-testid="switch-plan-active" checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} /></label>
          {err && <p className="text-sm text-[hsl(4_80%_76%)]">{err}</p>}
          <button data-testid="button-save-plan" disabled={busy} className="btn-gold w-full py-3">{busy ? "جارٍ الحفظ..." : "حفظ"}</button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SettingsPanel() {
  const { toast } = useToast();
  const inv = useInvalidateAll();
  const qc = useQueryClient();
  const s = useGetSettings({ query: { queryKey: getGetSettingsQueryKey() } });
  const [f, setF] = useState({ telegramUrl: "", binanceAddress: "", okxAddress: "", depositsEnabled: false, fundingDescription: "", terms: "" });
  const [err, setErr] = useState("");
  const loaded = useRef(false);
  useEffect(() => {
    if (s.data && !loaded.current) {
      loaded.current = true;
      const d = s.data;
      setF({ telegramUrl: d.telegramUrl, binanceAddress: d.binanceAddress, okxAddress: d.okxAddress, depositsEnabled: d.depositsEnabled, fundingDescription: d.fundingDescription, terms: d.terms });
    }
  }, [s.data]);
  const m = useUpdateSettings({
    mutation: {
      onSuccess: (d) => { qc.setQueryData(getGetSettingsQueryKey(), d); inv(); toast({ title: "تم حفظ الإعدادات" }); },
      onError: (e) => setErr(apiError(e)),
    },
  });
  if (s.isLoading) return <Skel className="h-96 max-w-2xl" />;
  if (s.isError) return <ErrorBox onRetry={() => s.refetch()} />;
  const submit = (e: FormEvent) => {
    e.preventDefault(); setErr("");
    const u = f.telegramUrl.trim(), b = f.binanceAddress.trim(), o = f.okxAddress.trim();
    if (u && !/^https:\/\/(t\.me|telegram\.me)\/[A-Za-z0-9_+/-]+$/.test(u)) return setErr("أدخل رابط تيليجرام صحيح يبدأ بـ https://t.me/ أو اتركه فارغًا");
    if (b && !isAddr(b)) return setErr("عنوان Binance غير صالح (0x + 40 خانة، غير صفري) أو اتركه فارغًا");
    if (o && !isAddr(o)) return setErr("عنوان OKX غير صالح (0x + 40 خانة، غير صفري) أو اتركه فارغًا");
    if (f.depositsEnabled) {
      if (!b && !o) return setErr("لتفعيل الإيداع أضف عنوانًا واحدًا صالحًا على الأقل");
      if (!f.fundingDescription.trim() || !f.terms.trim()) return setErr("لتفعيل الإيداع اكتب وصف التمويل والشروط");
    }
    m.mutate({ data: { telegramUrl: u, binanceAddress: b, okxAddress: o, depositsEnabled: f.depositsEnabled, fundingDescription: f.fundingDescription.trim(), terms: f.terms.trim() } });
  };
  return (
    <form onSubmit={submit} className="glass max-w-2xl space-y-5 rounded-3xl p-4 sm:p-7">
      <div className="flex flex-wrap gap-3 text-xs">
        <span className="rounded-full border border-border px-3 py-1">العملة <span className="num">{s.data?.currency}</span></span>
        <span className="rounded-full border border-border px-3 py-1">الشبكة <span className="num">{s.data?.network}</span></span>
        <span className="rounded-full border border-border px-3 py-1">الحد الأدنى للسحب <span className="num">{usdt(s.data?.minimumWithdrawal)}</span></span>
        <span data-testid="status-ready" className={`rounded-full border px-3 py-1 ${s.data?.ready ? "border-accent/40 text-accent" : "border-[hsl(40_62%_68%/.4)] text-primary"}`}>{s.data?.ready ? "جاهز لاستقبال الإيداعات" : "غير جاهز"}</span>
      </div>
      <label className="block"><span className="text-sm text-muted-foreground">عنوان استلام Binance (Polygon)</span>
        <input data-testid="input-binance-address" value={f.binanceAddress} onChange={(e) => setF({ ...f, binanceAddress: e.target.value })} maxLength={42} placeholder="0x..." dir="ltr" className="field num mt-2 text-left text-sm" /></label>
      <label className="block"><span className="text-sm text-muted-foreground">عنوان استلام OKX (Polygon)</span>
        <input data-testid="input-okx-address" value={f.okxAddress} onChange={(e) => setF({ ...f, okxAddress: e.target.value })} maxLength={42} placeholder="0x..." dir="ltr" className="field num mt-2 text-left text-sm" />
        <span className="mt-1.5 block text-xs text-muted-foreground">تسميات يدوية لعناوين محافظ، لا يوجد أي تكامل مع Binance أو OKX. تحقق من دعم العنوان لـ USDT على Polygon.</span></label>
      <label className="block"><span className="text-sm text-muted-foreground">وصف التمويل (يراه العضو)</span>
        <textarea data-testid="input-funding-description" value={f.fundingDescription} onChange={(e) => setF({ ...f, fundingDescription: e.target.value })} maxLength={2000} rows={4} className="field mt-2 resize-y" /></label>
      <label className="block"><span className="text-sm text-muted-foreground">الشروط</span>
        <textarea data-testid="input-terms" value={f.terms} onChange={(e) => setF({ ...f, terms: e.target.value })} maxLength={5000} rows={6} className="field mt-2 resize-y" /></label>
      <label className="flex items-center justify-between rounded-xl border border-border p-3 text-sm">تفعيل الإيداع للأعضاء
        <Switch data-testid="switch-deposits-enabled" checked={f.depositsEnabled} onCheckedChange={(v) => setF({ ...f, depositsEnabled: v })} /></label>
      <p className="text-xs text-muted-foreground leading-relaxed">يمكن الحفظ بحقول فارغة والإيداع معطّل. صورة الإيصال لا تثبت وصول الأموال؛ يجب التحقق من المعاملة على الشبكة قبل كل اعتماد.</p>
      <div className="hairline" />
      <label className="block"><span className="text-sm text-muted-foreground">رابط دعم تيليجرام</span>
        <input data-testid="input-telegram-url" value={f.telegramUrl} onChange={(e) => setF({ ...f, telegramUrl: e.target.value })} maxLength={200} placeholder="https://t.me/..." dir="ltr" className="field mt-2 text-left" /></label>
      {err && <p className="text-sm text-[hsl(4_80%_76%)]">{err}</p>}
      <button data-testid="button-save-settings" disabled={m.isPending} className="btn-gold w-full py-3">{m.isPending ? "جارٍ الحفظ..." : "حفظ الإعدادات"}</button>
    </form>
  );
}
