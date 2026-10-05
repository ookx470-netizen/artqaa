import { useState, type ReactNode } from "react";
import { Link, useLocation, Redirect } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, ArrowDownToLine, Gem, Wallet, UserRound, Info, ShieldCheck, LogOut, Send, X, LogIn, Users,
} from "lucide-react";
import { useGetSession, getGetSessionQueryKey, useLogout, useGetSettings, getGetSettingsQueryKey, type User } from "@workspace/api-client-react";
import { Backdrop, Logo, Skel } from "./brand";

export function useSessionUser() {
  const q = useGetSession({ query: { queryKey: getGetSessionQueryKey(), refetchOnWindowFocus: true, staleTime: 15000 } });
  return { user: q.data?.user ?? null, isLoading: q.isLoading };
}

const memberNav = [
  { href: "/dashboard", label: "لوحتي", icon: LayoutDashboard },
  { href: "/deposits", label: "الإيداع", icon: ArrowDownToLine },
  { href: "/wallet", label: "المحفظة", icon: Wallet },
  { href: "/team", label: "فريقي", icon: Users },
  { href: "/profile", label: "الملف", icon: UserRound },
  { href: "/about", label: "عن ارتقاء", icon: Info },
];

function Nav({ user }: { user: User | null }) {
  const [loc, setLoc] = useLocation();
  const qc = useQueryClient();
  const logout = useLogout({
    mutation: {
      onSettled: () => {
        qc.clear();
        qc.setQueryData(getGetSessionQueryKey(), { user: null });
        setLoc("/");
      },
    },
  });
  const items = user ? [...memberNav, ...(user.role === "admin" ? [{ href: "/admin", label: "الإدارة", icon: ShieldCheck }] : [])]
    : [{ href: "/plans", label: "الخطط", icon: Gem }, { href: "/about", label: "عن ارتقاء", icon: Info }];

  return (
    <>
      <header className="sticky top-0 z-30 px-3 pt-3 sm:px-4 sm:pt-4">
        <div className="glass mx-auto flex max-w-6xl min-w-0 items-center justify-between gap-2 rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3">
          <Link href={user ? "/dashboard" : "/"} data-testid="link-home" className="shrink-0"><Logo size={32} /></Link>
          <nav className="hidden lg:flex items-center gap-1">
            {items.map((i) => {
              const active = loc === i.href;
              return (
                <Link key={i.href} href={i.href} data-testid={`link-nav-${i.href.slice(1)}`}
                  className={`relative rounded-xl px-3 py-2 text-sm transition-colors ${active ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {active && <motion.span layoutId="navpill" className="absolute inset-0 rounded-xl bg-[hsl(40_40%_90%/.07)] border border-[hsl(40_60%_70%/.2)]" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                  <span className="relative">{i.label}</span>
                </Link>
              );
            })}
          </nav>
          {user ? (
            <>
            {user.role === "admin" && <Link href="/admin" className="lg:hidden shrink-0 text-sm text-primary px-2">الإدارة</Link>}
            <button data-testid="button-logout" onClick={() => logout.mutate()} disabled={logout.isPending}
              className="btn-ghost flex shrink-0 items-center gap-2 px-2.5 py-2 text-sm text-muted-foreground sm:px-3">
              <LogOut className="h-4 w-4" /><span className="hidden sm:inline">خروج</span>
            </button></>
          ) : (
            <Link href="/" data-testid="link-login" className="btn-gold flex items-center gap-2 px-4 py-2 text-sm"><LogIn className="h-4 w-4" />دخول</Link>
          )}
        </div>
      </header>
      {user && (
        <nav className="lg:hidden fixed bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] inset-x-3 z-30 glass-strong rounded-2xl flex justify-around gap-1 px-1 py-2">
          {items.filter((i) => i.href !== "/about" && i.href !== "/admin").slice(0, 6).map((i) => {
            const active = loc === i.href;
            return (
              <Link key={i.href} href={i.href} data-testid={`link-mnav-${i.href.slice(1)}`}
                className={`flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-0.5 py-1 text-[9px] whitespace-nowrap sm:px-1 sm:text-[11px] ${active ? "text-primary" : "text-muted-foreground"}`}>
                <i.icon className="h-5 w-5 shrink-0" /><span>{i.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </>
  );
}

export function TelegramButton() {
  const [open, setOpen] = useState(false);
  const { data } = useGetSettings({ query: { queryKey: getGetSettingsQueryKey(), staleTime: 60000 } });
  const url = data?.telegramUrl?.trim();
  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+6rem)] lg:bottom-6 left-4 sm:left-5 z-40">
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 10, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }}
            className="glass-strong absolute bottom-16 left-0 w-[calc(100vw-2.5rem)] max-w-72 rounded-2xl p-4 text-sm sm:p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="font-display font-medium">الدعم عبر تيليجرام</p>
              <button data-testid="button-close-support" onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
            {url ? (
              <>
                <p className="text-muted-foreground mb-4 leading-relaxed">تواصل مع فريق الدعم مباشرة عبر القناة الرسمية التي حددتها الإدارة.</p>
                <a data-testid="link-telegram" href={url} target="_blank" rel="noopener noreferrer" className="btn-gold block text-center py-2.5">فتح المحادثة</a>
              </>
            ) : (
              <p data-testid="text-support-unavailable" className="text-muted-foreground leading-relaxed">
                قناة الدعم غير مفعّلة حاليًا. ستظهر هنا فور إضافة رابط رسمي من الإدارة. لا تتواصل مع أي حساب يدّعي تمثيل ارتقاء خارج هذا الزر.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <button data-testid="button-support" onClick={() => setOpen((o) => !o)} aria-label="الدعم"
        className="group relative grid h-[52px] w-[52px] place-items-center rounded-full glass-strong transition-transform hover:scale-105">
        <span className="absolute inset-0 rounded-full border border-[hsl(168_42%_52%/.4)] animate-ping opacity-30" />
        <Send className="h-5 w-5 text-accent -scale-x-100" />
      </button>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const { user } = useSessionUser();
  return (
    <div className="grain relative min-h-[100dvh]">
      <Backdrop />
      <Nav user={user} />
      <motion.main initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 mx-auto max-w-6xl px-3 pt-7 pb-[calc(env(safe-area-inset-bottom)+7rem)] sm:px-4 sm:pt-10 lg:px-6 lg:pb-16">
        {children}
      </motion.main>
      <TelegramButton />
    </div>
  );
}

export function Protected({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, isLoading } = useSessionUser();
  if (isLoading) {
    return (
      <Shell>
        <Skel className="h-10 w-60 mb-6" />
        <div className="grid gap-4 md:grid-cols-3"><Skel className="h-40 md:col-span-2" /><Skel className="h-40" /></div>
      </Shell>
    );
  }
  if (!user) return <Redirect to="/" />;
  if (admin && user.role !== "admin") return <Redirect to="/dashboard" />;
  return <Shell>{children}</Shell>;
}
