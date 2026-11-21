"use client";
import { useMemo } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import Fuse from "fuse.js";
import { db, type LocalVisit } from "./db";

/** Local fuzzy search (FR-4.2): name (typo-tolerant), card code, phone last 4. */
export function useLocalSearch(query: string): LocalVisit[] | undefined {
  const visits = useLiveQuery(() => db().visits.toArray(), []);
  const fuse = useMemo(
    () => (visits ? new Fuse(visits.filter((v) => !v.deleted), {
      keys: [{ name: "full_name", weight: 0.7 }, { name: "card_code", weight: 0.2 }, { name: "community", weight: 0.1 }],
      threshold: 0.35, ignoreLocation: true, minMatchCharLength: 2,
    }) : null),
    [visits],
  );
  return useMemo(() => {
    if (!visits || !fuse) return undefined;
    const q = query.trim();
    if (q.length < 2) return [];
    const digits = q.replace(/\D/g, "");
    const exact: LocalVisit[] = [];
    if (digits.length >= 2) {
      for (const v of visits) {
        if (v.deleted) continue;
        if (v.card_code && v.card_code.replace(/\D/g, "").endsWith(digits)) exact.push(v);
        else if (digits.length >= 4 && v.phone_last4 === digits.slice(-4)) exact.push(v);
      }
    }
    const fuzzy = /[a-z]/i.test(q) ? fuse.search(q, { limit: 30 }).map((r) => r.item) : [];
    const seen = new Set<string>();
    return [...exact, ...fuzzy].filter((v) => (seen.has(v.id) ? false : (seen.add(v.id), true))).slice(0, 30);
  }, [visits, fuse, query]);
}

