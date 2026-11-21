"use client";
import { useEffect, useState } from "react";
import { Search as SearchIcon, CloudDownload } from "lucide-react";
import type { VolunteerSession } from "@/lib/offline/session";
import { useLocalSearch } from "@/lib/offline/search";
import { pullDelta } from "@/lib/offline/sync";
import { volunteerClient } from "@/lib/supabase/volunteer";
import { navigate } from "../nav";
import { PersonRow } from "../bits";
import { Input } from "@/components/ui/input";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/offline/db";

type Remote = { visit_id: string; full_name: string; card_code: string | null; community: string | null };

export function SearchView({ session, initialQuery }: { session: VolunteerSession; initialQuery: string }) {
  const [q, setQ] = useState(initialQuery);
  const local = useLocalSearch(q);
  const [remote, setRemote] = useState<Remote[]>([]);

  // Server results merge in when online (people registered on other devices not yet synced here).
  useEffect(() => {
    setRemote([]);
    if (q.trim().length < 2 || !navigator.onLine) return;
    const t = setTimeout(async () => {
      const { data } = await (await volunteerClient()).rpc("search_beneficiaries", { p_edition: session.edition.id, p_q: q.trim(), p_limit: 10 });
      if (data) setRemote((data as Remote[]).filter((r) => !(local ?? []).some((l) => l.id === r.visit_id)));
    }, 350);
    return () => clearTimeout(t);
  }, [q, session.edition.id, local]);

  const openRemote = async (id: string) => {
    await pullDelta();
    if (await db().visits.get(id)) navigate(`/s/p/${id}`);
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <label htmlFor="q" className="sr-only">Search by name, phone or card code</label>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-neutral-500" aria-hidden />
        <Input id="q" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, phone (last 4) or code" className="pl-12" inputMode="search" autoComplete="off" />
      </div>
      {q.trim().length < 2 ? (
        <p className="px-1 text-body text-neutral-500">Type at least 2 letters. Confirm the person using age range and community.</p>
      ) : local === undefined ? <Skeleton className="h-48" /> : local.length === 0 && remote.length === 0 ? (
        <EmptyState title="Not registered yet?" body="Check the spelling or try the phone number. If the person is new, send them to the Registration desk." />
      ) : (
        <>
          <ul className="divide-y divide-neutral-50 rounded-lg border border-neutral-100 bg-white" aria-label="Results">
            {local.map((v) => <PersonRow key={v.id} visit={v} onClick={() => navigate(`/s/p/${v.id}`)} />)}
          </ul>
          {remote.length > 0 && (
            <section aria-label="More results from the server">
              <p className="mb-1 text-caption text-neutral-500">From other devices</p>
              <ul className="flex flex-col gap-2">
                {remote.map((r) => (
                  <li key={r.visit_id}>
                    <Button variant="secondary" block className="h-auto min-h-14 justify-between py-2" onClick={() => void openRemote(r.visit_id)}>
                      <span className="text-left"><span className="block text-body font-medium text-forest">{r.full_name}</span><span className="text-caption text-neutral-500">{r.card_code ?? "No card"} · {r.community ?? ""}</span></span>
                      <CloudDownload className="size-5" aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
