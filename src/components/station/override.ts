"use client";
// One-shot Station Lead approvals, handed from the profile sheet to the serve form.
const approvals = new Map<string, string>();
export const setOverride = (visitId: string, token: string) => approvals.set(visitId, token);
export const takeOverride = (visitId: string) => {
  const t = approvals.get(visitId);
  approvals.delete(visitId);
  return t;
};
export const peekOverride = (visitId: string) => approvals.get(visitId);
