"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminClient } from "@/lib/supabase/browser";
import type { Database } from "@/lib/supabase/types";

export type Edition = Database["public"]["Tables"]["editions"]["Row"];
export type AdminInfo = { role: Database["public"]["Enums"]["org_role"]; displayName: string; orgId: string; userId: string };

type Ctx = { admin: AdminInfo; editions: Edition[]; edition: Edition | null; setEditionId: (id: string) => void; loading: boolean; refetch: () => void };
const EditionCtx = createContext<Ctx | null>(null);

const RANK = { viewer: 1, followup: 2, coordinator: 3, super_admin: 4 } as const;
export const atLeast = (admin: AdminInfo, role: keyof typeof RANK) => RANK[admin.role] >= RANK[role];

export function EditionProvider({ admin, children }: { admin: AdminInfo; children: React.ReactNode }) {
  const q = useQuery({
    queryKey: ["editions"],
    queryFn: async () => {
      const { data, error } = await adminClient().from("editions").select("*").is("archived_at", null).order("starts_on", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    try { setId(localStorage.getItem("gc-admin-edition")); } catch { /* ignore */ }
  }, []);
  const editions = useMemo(() => q.data ?? [], [q.data]);
  const edition = useMemo(() => {
    if (!editions.length) return null;
    return editions.find((e) => e.id === id)
      ?? editions.find((e) => e.status === "live" && !e.is_training)
      ?? editions.find((e) => !e.is_training)
      ?? editions[0]!;
  }, [editions, id]);
  const setEditionId = (v: string) => {
    setId(v);
    try { localStorage.setItem("gc-admin-edition", v); } catch { /* ignore */ }
  };
  return <EditionCtx.Provider value={{ admin, editions, edition, setEditionId, loading: q.isLoading, refetch: () => void q.refetch() }}>{children}</EditionCtx.Provider>;
}

export function useEditionCtx() {
  const c = useContext(EditionCtx);
  if (!c) throw new Error("EditionProvider missing");
  return c;
}
