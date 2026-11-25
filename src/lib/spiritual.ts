/** Plain-words summary of a Counselling record (confidential kind `spiritual`). */
const FAITH: Record<string, string> = { new_convert: "New Convert", born_again: "Already Born Again" };
const GHOST: Record<string, string> = { already: "Holy Ghost baptism: already", today: "Holy Ghost baptism: new, today" };

export function spiritualLine(p: Record<string, unknown>): string {
  return [FAITH[String(p.faith)], p.rededicated && "Rededicated", p.prayed && "Prayed for", p.healing && "Received healing", GHOST[String(p.holy_ghost)],
    p.tongues && "Speaks in tongues", p.wants_followup && "Wants follow-up", p.join_fellowship && "Wants fellowship", p.notes].filter(Boolean).join(" · ") || "No details";
}
