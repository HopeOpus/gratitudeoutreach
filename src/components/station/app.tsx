"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useSearchParams } from "next/navigation";
import { Home, ListChecks, Search, UserRound, WifiOff, Lock } from "lucide-react";
import { useSession } from "@/lib/offline/hooks";
import { getMeta } from "@/lib/offline/db";
import { sessionExpired } from "@/lib/offline/session";
import { endSession, startSyncEngine, pullDelta } from "@/lib/offline/sync";
import { useSyncState } from "@/lib/offline/sync-state";
import { findVisitByCode } from "@/lib/offline/hooks";
import { AppHeader } from "@/components/ui/app-header";
import { SyncIndicator } from "@/components/ui/sync-indicator";
import { Toaster, toast } from "@/components/ui/toast";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { AlertBanner, Skeleton } from "@/components/ui/misc";
import { CodeKeypad } from "./code-keypad";
import { navigate } from "./nav";
import { cn } from "@/lib/utils";
import { HomeView } from "./views/home";
import { ScanContext } from "./scan-context";
import { installGlobalErrorHandlers } from "@/lib/monitoring";

const Scanner = dynamic(() => import("./scanner"), { ssr: false });
const ServeView = dynamic(() => import("./views/serve").then((m) => m.ServeView), { ssr: false, loading: () => <ViewSkeleton /> });
const PendingView = dynamic(() => import("./views/pending").then((m) => m.PendingView), { ssr: false, loading: () => <ViewSkeleton /> });
const ProfileView = dynamic(() => import("./views/profile").then((m) => m.ProfileView), { ssr: false, loading: () => <ViewSkeleton /> });
const SettingsView = dynamic(() => import("./views/settings").then((m) => m.SettingsView), { ssr: false, loading: () => <ViewSkeleton /> });
const PrepareView = dynamic(() => import("./views/prepare").then((m) => m.PrepareView), { ssr: false, loading: () => <ViewSkeleton /> });
const SearchView = dynamic(() => import("./views/search").then((m) => m.SearchView), { ssr: false, loading: () => <ViewSkeleton /> });
const RegisterView = dynamic(() => import("./views/register").then((m) => m.RegisterView), { ssr: false, loading: () => <ViewSkeleton /> });

function ViewSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <Skeleton className="h-8 w-2/3" /><Skeleton className="h-24 w-full" /><Skeleton className="h-14 w-full" />
    </div>
  );
}

export default function VolunteerApp() {
  const pathname = usePathname() ?? "/s";
  const search = useSearchParams();
  const session = useSession();
  const sync = useSyncState();
  const [prepared, setPrepared] = useState<boolean | null>(null);
  const [scanOpen, setScanOpen] = useState<null | { purpose: "lookup" | "register" }>(null);
  const [keypadOpen, setKeypadOpen] = useState<null | { purpose: "lookup" | "register" }>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [offlineBanner, setOfflineBanner] = useState(false);
  const [registerCard, setRegisterCard] = useState<string | null>(null);

  useEffect(() => installGlobalErrorHandlers("station"), []);

  // Guard: no session -> join. Expired > 48h -> purge.
  useEffect(() => {
    if (session === undefined) return;
    if (session === null) { window.location.replace("/join"); return; }
    if (sessionExpired(session, 48)) { void endSession().then(() => window.location.replace("/join")); return; }
    void getMeta<string>("snapshot_at").then((v) => setPrepared(!!v));
  }, [session]);

  const handleEnd = useCallback((why: "revoked" | "expired") => {
    void endSession().then(() => window.location.replace(`/join?ended=${why}`));
  }, []);

  useEffect(() => {
    if (session && prepared) startSyncEngine(session.edition.id, handleEnd);
  }, [session, prepared, handleEnd]);

  // First offline moment: show a friendly banner (DesignFlow §3).
  useEffect(() => {
    if (!sync.online) setOfflineBanner(true);
  }, [sync.online]);

  const segments = useMemo(() => pathname.replace(/^\/s\/?/, "").split("/").filter(Boolean), [pathname]);
  const view = segments[0] ?? "home";

  const openScanner = useCallback((purpose: "lookup" | "register" = "lookup") => setScanOpen({ purpose }), []);
  const openKeypad = useCallback((purpose: "lookup" | "register" = "lookup") => setKeypadOpen({ purpose }), []);

  const lookupCode = useCallback(async (code: string, purpose: "lookup" | "register") => {
    setScanOpen(null);
    setKeypadOpen(null);
    if (!session) return;
    if (purpose === "register") { setRegisterCard(code); navigate("/s/register"); return; }
    let visit = await findVisitByCode(code);
    if (!visit && navigator.onLine) { await pullDelta(); visit = await findVisitByCode(code); }
    if (visit) { navigate(`/s/p/${visit.id}`); return; }
    if (session.station.kind === "registration") { setRegisterCard(code); navigate("/s/register"); return; }
    setNotFound(code);
  }, [session]);

  useEffect(() => {
    if (view === "scan") { navigate("/s", { replace: true }); openScanner("lookup"); }
  }, [view, openScanner]);

  if (session === undefined || (session && prepared === null)) return <div className="min-h-dvh bg-neutral-25"><AppHeader title="Gratitude" /><ViewSkeleton /></div>;
  if (!session) return null;
  if (!prepared) return <PrepareView session={session} onDone={() => setPrepared(true)} />;

  const readOnly = session.edition.status === "closed";
  const kind = session.station.kind;

  let body: React.ReactNode;
  if (view === "p" && segments[1] && segments[2] === "serve") body = <ServeView visitId={segments[1]} session={session} />;
  else if (view === "p" && segments[1]) body = <ProfileView visitId={segments[1]} session={session} />;
  else if (view === "pending") body = <PendingView session={session} />;
  else if (view === "search") body = <SearchView session={session} initialQuery={search?.get("q") ?? ""} />;
  else if (view === "settings") body = <SettingsView session={session} />;
  else if (view === "register" && kind === "registration") body = <RegisterView session={session} initialCard={registerCard} onCardUsed={() => setRegisterCard(null)} />;
  else body = <HomeView session={session} />;

  const navItems = [
    { href: "/s", label: "Home", icon: Home, active: view === "home" },
    { href: "/s/pending", label: "Pending", icon: ListChecks, active: view === "pending" },
    { href: "/s/search", label: "Search", icon: Search, active: view === "search" },
    { href: "/s/settings", label: "Me", icon: UserRound, active: view === "settings" },
  ];
  const hideNav = view === "p" || view === "register";

  return (
    <ScanContext.Provider value={{ openScanner, openKeypad, readOnly }}>
      <div className="mx-auto flex min-h-dvh max-w-lg flex-col bg-neutral-25">
        {session.edition.is_training && (
          <div role="status" className="sticky top-0 z-40 bg-warning-bg px-4 py-1.5 text-center text-caption font-medium text-warning">
            TRAINING: data won&apos;t be saved to the real event
          </div>
        )}
        <AppHeader
          title={session.station.name}
          className={session.edition.is_training ? "top-7" : undefined}
          right={<SyncIndicator state={sync} onClick={() => navigate("/s/settings")} />}
        />
        {readOnly && (
          <AlertBanner tone="warning" className="m-3 mb-0"><Lock className="mr-1 inline size-4" aria-hidden />This edition is closed. You can view records but not change them.</AlertBanner>
        )}
        {offlineBanner && !sync.online && (
          <AlertBanner tone="info" className="m-3 mb-0" action={<button className="text-label font-medium underline cursor-pointer" onClick={() => setOfflineBanner(false)}>OK</button>}>
            <WifiOff className="mr-1 inline size-4" aria-hidden />You&apos;re offline. Keep serving. We&apos;ll sync later.
          </AlertBanner>
        )}
        <main className={cn("flex-1", !hideNav && "pb-24")}>{body}</main>
        {!hideNav && (
          <nav aria-label="Station" className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-lg border-t border-neutral-100 bg-white safe-bottom">
            {navItems.map((n) => (
              <button key={n.href} type="button" onClick={() => navigate(n.href)} aria-current={n.active ? "page" : undefined}
                className={cn("flex h-16 flex-1 flex-col items-center justify-center gap-0.5 text-caption font-medium cursor-pointer", n.active ? "text-leaf-700" : "text-neutral-500")}>
                <n.icon className="size-6" strokeWidth={1.75} aria-hidden />
                {n.label}
              </button>
            ))}
          </nav>
        )}
      </div>

      {scanOpen && (
        <Scanner
          title={scanOpen.purpose === "register" ? "Scan pre-printed card" : "Scan QR code"}
          onClose={() => setScanOpen(null)}
          onTypeCode={() => { const p = scanOpen.purpose; setScanOpen(null); setKeypadOpen({ purpose: p }); }}
          onSearch={scanOpen.purpose === "lookup" ? () => { setScanOpen(null); navigate("/s/search"); } : undefined}
          onCode={(c) => void lookupCode(c, scanOpen.purpose)}
        />
      )}
      <BottomSheet open={!!keypadOpen} onOpenChange={(o) => !o && setKeypadOpen(null)} title="Type the number">
        <CodeKeypad prefix={session.edition.code_prefix} onSubmit={(c) => void lookupCode(c, keypadOpen?.purpose ?? "lookup")} submitLabel={keypadOpen?.purpose === "register" ? "Use" : "Open"} />
        {keypadOpen?.purpose !== "register" && (
          <Button variant="ghost" size="lg" block className="mt-2" onClick={() => { setKeypadOpen(null); navigate("/s/search"); }}>No number? Search by name</Button>
        )}
      </BottomSheet>
      <BottomSheet open={!!notFound} onOpenChange={(o) => !o && setNotFound(null)} title="Not registered yet"
        description={`Card ${notFound ?? ""} is not linked to anyone. Please send the person to the Registration desk.`}>
        <div className="flex flex-col gap-2">
          <Button size="lg" block onClick={() => { setNotFound(null); navigate("/s/search"); }}>Search by name instead</Button>
          <Button variant="secondary" size="lg" block onClick={() => { setNotFound(null); openScanner("lookup"); }}>Scan another card</Button>
        </div>
      </BottomSheet>
      <Toaster />
    </ScanContext.Provider>
  );
}

export { toast };
