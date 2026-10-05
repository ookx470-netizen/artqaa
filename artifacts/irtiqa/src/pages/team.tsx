import { useState } from "react";
import { motion } from "framer-motion";
import { Copy, Check, Share2, Users, Link2 } from "lucide-react";
import { useGetTeam, getGetTeamQueryKey } from "@workspace/api-client-react";
import { PageHead, Skel, ErrorBox } from "@/components/brand";
import { dateAr } from "@/lib/helpers";

export function TeamPage() {
  const q = useGetTeam({ query: { queryKey: getGetTeamQueryKey(), refetchInterval: 30000 } });
  const [copied, setCopied] = useState("");
  const code = q.data?.referralCode ?? "";
  const link = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, "")}/register?ref=${encodeURIComponent(code)}`;
  const members = q.data?.members ?? [];

  const copy = async (v: string, k: string) => {
    try { await navigator.clipboard.writeText(v); setCopied(k); setTimeout(() => setCopied(""), 1800); } catch { /* ignore */ }
  };
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "دعوة إلى ارتقاء", text: "انضم إلى ارتقاء بدعوتي", url: link }); } catch { /* cancelled */ }
    } else copy(link, "link");
  };

  return (
    <div>
      <PageHead eyebrow="الفريق" title="فريقي" desc="العضوية في ارتقاء بالدعوة فقط. شارك رمزك مع من تثق بهم، وتابع من انضم عبرك مباشرة." />
      {q.isLoading ? (
        <div className="grid gap-4 md:grid-cols-3"><Skel className="h-40" /><Skel className="h-40 md:col-span-2" /><Skel className="h-64 md:col-span-3" /></div>
      ) : q.isError ? (
        <ErrorBox onRetry={() => q.refetch()} />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl p-4 sm:p-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4 text-accent" />الإحالات المباشرة</div>
            <p data-testid="text-team-count" className="font-display gold-text mt-4 text-6xl font-semibold">{members.length}</p>
            <p className="mt-2 text-xs text-muted-foreground">عضو انضم برمزك</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .08 }} className="glass-strong min-w-0 rounded-3xl p-4 sm:p-6 md:col-span-2">
            <p className="text-sm text-muted-foreground">رمز الدعوة</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span data-testid="text-referral-code" dir="ltr" className="font-display rounded-2xl border border-[hsl(40_60%_70%/.25)] bg-[hsl(40_40%_90%/.05)] px-4 py-3 text-xl tracking-[.2em] sm:px-5 sm:text-2xl sm:tracking-[.3em]">{code}</span>
              <button data-testid="button-copy-code" onClick={() => copy(code, "code")} className="btn-ghost flex items-center gap-2 px-4 py-2.5 text-sm">
                {copied === "code" ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}{copied === "code" ? "تم النسخ" : "نسخ الرمز"}
              </button>
            </div>
            <div className="hairline my-5" />
            <p className="text-sm text-muted-foreground flex items-center gap-2"><Link2 className="h-4 w-4" />رابط التسجيل</p>
            <p data-testid="text-referral-link" dir="ltr" className="mt-2 truncate rounded-xl bg-muted/40 px-3 py-2 text-left text-xs text-muted-foreground">{link}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button data-testid="button-copy-link" onClick={() => copy(link, "link")} className="btn-ghost flex items-center gap-2 px-4 py-2.5 text-sm">
                {copied === "link" ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}{copied === "link" ? "تم النسخ" : "نسخ الرابط"}
              </button>
              <button data-testid="button-share-link" onClick={share} className="btn-gold flex items-center gap-2 px-4 py-2.5 text-sm"><Share2 className="h-4 w-4" />مشاركة الدعوة</button>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .16 }} className="glass rounded-3xl p-4 sm:p-6 md:col-span-3">
            <p className="font-display text-lg font-medium">أعضاء فريقي</p>
            {members.length === 0 ? (
              <div data-testid="text-team-empty" className="py-14 text-center">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[hsl(168_42%_52%/.12)] text-accent"><Users className="h-6 w-6" /></div>
                <p className="mt-4 font-display">لم ينضم أحد بعد</p>
                <p className="mt-1 text-sm text-muted-foreground">شارك رابط الدعوة، وسيظهر هنا كل من يسجّل برمزك.</p>
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-border/50">
                {members.map((m, i) => (
                  <motion.li key={m.memberId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * .03 }}
                    data-testid={`row-member-${m.memberId}`} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[hsl(40_60%_70%/.25)] font-display text-primary">{m.name.trim().charAt(0)}</div>
                      <div className="min-w-0"><p className="truncate font-medium">{m.name}</p><p dir="ltr" className="text-right text-xs text-muted-foreground">#{m.memberId}</p></div>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{dateAr(m.createdAt)}</span>
                  </motion.li>
                ))}
              </ul>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
