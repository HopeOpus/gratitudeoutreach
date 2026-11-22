"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ScanLine, ShieldCheck, ArrowLeft } from "lucide-react";
import { checkStation, completeJoin, joinErrorText } from "@/lib/offline/join";
import { getSession } from "@/lib/offline/session";
import { whoSchema } from "@/lib/schemas/join";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { AlertBanner, Checkbox } from "@/components/ui/misc";
import { StationIcon } from "@/components/station/bits";
import { DESIGNATIONS } from "@/lib/schemas/service";
import { errorMessage, cn } from "@/lib/utils";

const Scanner = dynamic(() => import("@/components/station/scanner"), { ssr: false });

type Station = { id: string; name: string; kind: string };

function PinBoxes({ value, onChange, disabled, label }: { value: string; onChange: (v: string) => void; disabled?: boolean; label: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="relative" onClick={() => ref.current?.focus()}>
      <input ref={ref} aria-label={label} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={value} disabled={disabled} autoFocus
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))} className="absolute inset-0 opacity-0" />
      <div className="flex justify-center gap-2" aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className={cn("grid h-16 w-12 place-items-center rounded-md border-2 bg-white text-h1 font-medium text-forest tabular", i === value.length ? "border-fresh" : "border-forest-300")}>
            {value[i] ? "•" : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

export function JoinFlow({ token: initialToken, ended }: { token?: string; ended?: string }) {
  const [token, setToken] = useState(initialToken);
  const [step, setStep] = useState<"pin" | "who" | "role">(initialToken ? "who" : "pin");
  const [pin, setPin] = useState("");
  const [station, setStation] = useState<Station | null>(null);
  const [needsRole, setNeedsRole] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [rolePin, setRolePin] = useState("");
  const [designation, setDesignation] = useState<string>("Nurse");
  const [ack, setAck] = useState(false);
  const [leadMode, setLeadMode] = useState(false);
  const [err, setErr] = useState<string | null>(ended ? (ended === "revoked" ? "Your session was ended by the coordinator. Join again if needed." : "Your session expired. Join again to continue.") : null);
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState(false);
  const [fieldErr, setFieldErr] = useState<{ name?: string; phone?: string }>({});

  const cred = token ? { token } : { pin };

  // Already joined on this phone? Go straight to the station.
  useEffect(() => {
    void getSession().then((s) => { if (s && new Date(s.session.expires_at) > new Date() && !ended) window.location.replace("/s"); });
  }, [ended]);

  // Token links: check the station up front.
  useEffect(() => {
    if (!token) return;
    void (async () => {
      setBusy(true);
      try {
        const r = await checkStation({ token });
        if (r.ok) { setStation(r.station); setNeedsRole(r.needsRolePin); setStep("who"); }
        else { setErr(joinErrorText(r.error)); setToken(undefined); setStep("pin"); }
      } catch (e) { setErr(errorMessage(e)); }
      setBusy(false);
    })();
  }, [token]);

  useEffect(() => {
    if (step !== "pin" || pin.length !== 6) return;
    void (async () => {
      setBusy(true); setErr(null);
      try {
        const r = await checkStation({ pin });
        if (r.ok) { setStation(r.station); setNeedsRole(r.needsRolePin); setStep("who"); }
        else { setErr(joinErrorText(r.error)); setPin(""); }
      } catch (e) { setErr(navigator.onLine ? errorMessage(e) : "You need internet to join a station the first time."); setPin(""); }
      setBusy(false);
    })();
  }, [pin, step]);

  const submitWho = async () => {
    const parsed = whoSchema.safeParse({ name, phone });
    if (!parsed.success) {
      const f: { name?: string; phone?: string } = {};
      parsed.error.issues.forEach((i) => { f[i.path[0] as "name" | "phone"] = i.message; });
      setFieldErr(f);
      return;
    }
    setFieldErr({});
    if (needsRole) { setStep("role"); return; }
    await finish();
  };

  const finish = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await completeJoin(cred, { name, phone, rolePin: rolePin || undefined, designation: needsRole ? designation : undefined, ack });
      if (r.ok) { window.location.replace("/s"); return; }
      setErr(joinErrorText(r.error));
      if (r.error === "invalid_pin" || r.error === "invalid_token") setStep("pin");
    } catch (e) { setErr(errorMessage(e)); }
    setBusy(false);
  };

  return (
    <main className="flex min-h-dvh flex-col bg-forest text-white">
      <div className="relative flex flex-col items-center gap-3 px-6 pb-6 pt-12">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/gratitude-logo-white.svg" alt="Gratitude Outreach" className="w-60" />
        <p className="text-body text-forest-100">Station sign-in for volunteers</p>
      </div>
      <div className="flex flex-1 flex-col gap-5 rounded-t-xl bg-neutral-25 px-5 pb-10 pt-6 text-ink">
        {err && <AlertBanner tone="danger">{err}</AlertBanner>}

        {step === "pin" && (
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="text-h2 font-medium text-forest">Enter station PIN</h1>
              <p className="text-body text-neutral-700">The 6-digit PIN is on your station poster.</p>
            </div>
            <PinBoxes value={pin} onChange={setPin} disabled={busy} label="Station PIN" />
            {busy && <p className="text-center text-body text-neutral-500" role="status">Checking…</p>}
            <Button variant="secondary" size="lg" block onClick={() => setScan(true)}><ScanLine className="size-5" /> Scan station QR instead</Button>
          </div>
        )}

        {step === "who" && station && (
          <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); void submitWho(); }}>
            <div className="flex items-center gap-3 rounded-lg bg-white p-3 ring-1 ring-neutral-100">
              <StationIcon kind={station.kind} />
              <div><p className="text-caption text-neutral-500">You are joining</p><p className="text-h3 font-medium text-forest">{station.name}</p></div>
            </div>
            <h1 className="text-h2 font-medium text-forest">Who are you?</h1>
            <Field label="First name" htmlFor="j-name" required error={fieldErr.name}>
              <Input id="j-name" autoCapitalize="words" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sis. Ngozi" />
            </Field>
            <Field label="Phone (optional)" htmlFor="j-phone" error={fieldErr.phone} hint="So your coordinator can reach you today">
              <Input id="j-phone" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0803 123 4567" />
            </Field>
            {!needsRole && (
              leadMode ? (
                <Field label="Lead PIN (Station Leads only)" htmlFor="j-lead">
                  <Input id="j-lead" inputMode="numeric" type="password" maxLength={6} value={rolePin} onChange={(e) => setRolePin(e.target.value.replace(/\D/g, ""))} />
                </Field>
              ) : (
                <button type="button" className="self-start text-label font-medium text-leaf-700 underline cursor-pointer min-h-11" onClick={() => setLeadMode(true)}>I&apos;m the Station Lead</button>
              )
            )}
            <Button type="submit" size="lg" block loading={busy}>{needsRole ? "Next" : "Start serving"}</Button>
            <Button type="button" variant="ghost" onClick={() => { setStep("pin"); setPin(""); setStation(null); setToken(undefined); }}><ArrowLeft className="size-5" /> Different station</Button>
          </form>
        )}

        {step === "role" && station && (
          <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); void finish(); }}>
            <div className="flex items-center gap-3"><ShieldCheck className="size-8 text-confidential" aria-hidden /><h1 className="text-h2 font-medium text-forest">Private information</h1></div>
            <AlertBanner tone="confidential">You&apos;ll see private {station.kind === "counselling" ? "counselling notes" : station.kind === "pharmacy" ? "prescriptions and medical notes" : "medical notes"}. Keep them private. Don&apos;t share or screenshot them.</AlertBanner>
            <Field label="Role PIN from your Station Lead" htmlFor="j-role" required>
              <Input id="j-role" inputMode="numeric" type="password" maxLength={6} value={rolePin} onChange={(e) => setRolePin(e.target.value.replace(/\D/g, ""))} />
            </Field>
            {(station.kind === "medical" || station.kind === "pharmacy") && (
              <Field label="Designation">
                <Segmented label="Designation" value={designation} onChange={setDesignation} options={DESIGNATIONS.map((d) => ({ value: d, label: d }))} />
              </Field>
            )}
            <Checkbox id="j-ack" checked={ack} onChange={setAck} required label="I agree to keep information confidential" />
            <Button type="submit" size="lg" block loading={busy} disabled={rolePin.length !== 6 || !ack}>Start serving</Button>
            <Button type="button" variant="ghost" onClick={() => setStep("who")}><ArrowLeft className="size-5" /> Back</Button>
          </form>
        )}
      </div>
      {scan && (
        <Scanner title="Scan station QR" accept={joinTokenFromQr} rejectHint="That is not a station join QR."
          onClose={() => setScan(false)} onTypeCode={() => setScan(false)}
          onCode={(t) => { setScan(false); setErr(null); setToken(t); }} />
      )}
    </main>
  );
}

/** Join-QR posters encode a URL ending in /join/<token>. */
function joinTokenFromQr(raw: string): string | null {
  return raw.match(/\/join\/([A-Za-z0-9_-]{16,})/)?.[1] ?? null;
}
