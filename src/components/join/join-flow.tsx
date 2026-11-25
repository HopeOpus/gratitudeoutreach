"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ScanLine, ShieldCheck, ArrowLeft, LogIn, UserPlus } from "lucide-react";
import { checkStation, completeJoin, joinErrorText, signIn } from "@/lib/offline/join";
import { getSession } from "@/lib/offline/session";
import { whoSchema, signInSchema } from "@/lib/schemas/join";
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
  // Join-QR links mean "register at this station"; otherwise most people are signing in.
  const [mode, setMode] = useState<"signin" | "register">(initialToken ? "register" : "signin");
  const [step, setStep] = useState<"signin" | "pin" | "who" | "role">(initialToken ? "who" : "signin");
  const [pin, setPin] = useState("");
  const [station, setStation] = useState<Station | null>(null);
  const [needsRole, setNeedsRole] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [rolePin, setRolePin] = useState("");
  const [designation, setDesignation] = useState<string>("Nurse");
  const [ack, setAck] = useState(false);
  const [leadMode, setLeadMode] = useState(false);
  const [errCode, setErrCode] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(ended ? (ended === "revoked" ? "Your session was ended by the coordinator. Join again if needed." : "Your session expired. Join again to continue.") : null);
  const [busy, setBusy] = useState(false);
  const [scan, setScan] = useState(false);
  const [fieldErr, setFieldErr] = useState<{ name?: string; phone?: string }>({});

  const cred = token ? { token } : { pin };

  const showError = (code: string) => { setErrCode(code); setErr(joinErrorText(code)); };
  const clearError = () => { setErrCode(null); setErr(null); };

  const switchMode = (m: "signin" | "register") => {
    clearError(); setFieldErr({}); setRolePin(""); setAck(false); setLeadMode(false);
    setMode(m);
    if (m === "signin") { setStep("signin"); setStation(null); setToken(undefined); setPin(""); }
    else setStep(station ? "who" : "pin");
  };

  const validate = (schema: typeof whoSchema | typeof signInSchema) => {
    const parsed = schema.safeParse({ name, phone });
    if (parsed.success) { setFieldErr({}); return true; }
    const f: { name?: string; phone?: string } = {};
    parsed.error.issues.forEach((i) => { const k = i.path[0] as "name" | "phone"; f[k] ??= i.message; });
    setFieldErr(f);
    return false;
  };

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
        else { showError(r.error); setToken(undefined); setStep("pin"); }
      } catch (e) { setErr(errorMessage(e)); }
      setBusy(false);
    })();
  }, [token]);

  useEffect(() => {
    if (step !== "pin" || pin.length !== 6) return;
    void (async () => {
      setBusy(true); clearError();
      try {
        const r = await checkStation({ pin });
        if (r.ok) { setStation(r.station); setNeedsRole(r.needsRolePin); setStep("who"); }
        else { showError(r.error); setPin(""); }
      } catch (e) { setErr(navigator.onLine ? errorMessage(e) : "You need internet to join a station the first time."); setPin(""); }
      setBusy(false);
    })();
  }, [pin, step]);

  const submitWho = async () => {
    if (!validate(whoSchema)) return;
    if (needsRole) { setStep("role"); return; }
    await finish();
  };

  const submitSignIn = async () => {
    if (!validate(signInSchema)) return;
    await finish();
  };

  const finish = async () => {
    setBusy(true); clearError();
    try {
      if (mode === "signin") {
        const r = await signIn({ name, phone, rolePin: rolePin || undefined, ack });
        if (r.ok) { window.location.replace("/s"); return; }
        if ("station" in r) { setStation(r.station); setNeedsRole(true); setStep("role"); }
        else {
          showError(r.error);
          if (r.error === "account_not_found" || r.error === "locked") { setRolePin(""); setStep("signin"); }
        }
      } else {
        const r = await completeJoin(cred, { name, phone, rolePin: rolePin || undefined, designation: needsRole ? designation : undefined, ack });
        if (r.ok) { window.location.replace("/s"); return; }
        showError(r.error);
        if (r.error === "invalid_pin" || r.error === "invalid_token") setStep("pin");
        if (r.error === "already_registered" || r.error === "phone_required" || r.error === "invalid_phone") setStep("who");
      }
    } catch (e) { setErr(navigator.onLine ? errorMessage(e) : "You need internet to sign in on a new phone."); }
    setBusy(false);
  };

  const errorAction =
    errCode === "account_not_found" ? (
      <Button size="sm" variant="secondary" onClick={() => switchMode("register")}>Register</Button>
    ) : errCode === "already_registered" ? (
      <Button size="sm" variant="secondary" onClick={() => switchMode("signin")}>Sign in</Button>
    ) : undefined;

  return (
    <main className="flex min-h-dvh flex-col bg-forest text-white">
      <div className="relative flex flex-col items-center gap-3 px-6 pb-6 pt-12">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/gratitude-logo-white.svg" alt="Gratitude Outreach" className="w-60" />
        <p className="text-body text-forest-100">Volunteer sign-in</p>
      </div>
      <div className="flex flex-1 flex-col gap-5 rounded-t-xl bg-neutral-25 px-5 pb-10 pt-6 text-ink">
        {(step === "signin" || step === "pin") && (
          <Segmented label="Sign in or register" value={mode} onChange={switchMode}
            options={[{ value: "signin", label: "Sign in" }, { value: "register", label: "Register" }]} />
        )}
        {err && <AlertBanner tone="danger" action={errorAction}>{err}</AlertBanner>}

        {step === "signin" && (
          <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); void submitSignIn(); }}>
            <div>
              <h1 className="text-h2 font-medium text-forest">Welcome back</h1>
              <p className="text-body text-neutral-700">Use the name and phone number you registered with. You can sign in on more than one phone.</p>
            </div>
            <Field label="Name" htmlFor="s-name" required error={fieldErr.name}>
              <Input id="s-name" autoCapitalize="words" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sis. Ngozi" />
            </Field>
            <Field label="Phone number" htmlFor="s-phone" required error={fieldErr.phone} hint="Your phone number is your password">
              <Input id="s-phone" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0803 123 4567" />
            </Field>
            {leadMode ? (
              <Field label="Lead PIN (Station Leads only)" htmlFor="s-lead">
                <Input id="s-lead" inputMode="numeric" type="password" maxLength={6} value={rolePin} onChange={(e) => setRolePin(e.target.value.replace(/\D/g, ""))} />
              </Field>
            ) : (
              <button type="button" className="self-start text-label font-medium text-leaf-700 underline cursor-pointer min-h-11" onClick={() => setLeadMode(true)}>I&apos;m the Station Lead</button>
            )}
            <Button type="submit" size="lg" block loading={busy}><LogIn className="size-5" /> Sign in</Button>
            <p className="text-center text-body text-neutral-700">
              New volunteer?{" "}
              <button type="button" className="font-medium text-leaf-700 underline cursor-pointer min-h-11" onClick={() => switchMode("register")}>Register</button>
            </p>
          </form>
        )}

        {step === "pin" && (
          <div className="flex flex-col gap-5">
            <div>
              <h1 className="text-h2 font-medium text-forest">Register: enter station PIN</h1>
              <p className="text-body text-neutral-700">The 6-digit PIN for your service point (Registration, Medical, Food…) is on your station poster.</p>
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
              <div><p className="text-caption text-neutral-500">You are registering at</p><p className="text-h3 font-medium text-forest">{station.name}</p></div>
            </div>
            <h1 className="text-h2 font-medium text-forest">Who are you?</h1>
            <Field label="Name" htmlFor="j-name" required error={fieldErr.name} hint="Remember how you write it: you sign in with it">
              <Input id="j-name" autoCapitalize="words" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sis. Ngozi" />
            </Field>
            <Field label="Phone number" htmlFor="j-phone" required error={fieldErr.phone} hint="This is your password for signing in on any phone">
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
            <Button type="submit" size="lg" block loading={busy}>{needsRole ? "Next" : <><UserPlus className="size-5" /> Register and start</>}</Button>
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
            {mode === "register" && (station.kind === "medical" || station.kind === "pharmacy") && (
              <Field label="Designation">
                <Segmented label="Designation" value={designation} onChange={setDesignation} options={DESIGNATIONS.filter((d) => d !== "Optician" && d !== "Lab").map((d) => ({ value: d, label: d }))} />
              </Field>
            )}
            <Checkbox id="j-ack" checked={ack} onChange={setAck} required label="I agree to keep information confidential" />
            <Button type="submit" size="lg" block loading={busy} disabled={rolePin.length !== 6 || !ack}>Start serving</Button>
            <Button type="button" variant="ghost" onClick={() => { clearError(); setStep(mode === "signin" ? "signin" : "who"); }}><ArrowLeft className="size-5" /> Back</Button>
          </form>
        )}
      </div>
      {scan && (
        <Scanner title="Scan station QR" accept={joinTokenFromQr} rejectHint="That is not a station join QR."
          onClose={() => setScan(false)} onTypeCode={() => setScan(false)}
          onCode={(t) => { setScan(false); clearError(); setToken(t); }} />
      )}
    </main>
  );
}

/** Join-QR posters encode a URL ending in /join/<token>. */
function joinTokenFromQr(raw: string): string | null {
  return raw.match(/\/join\/([A-Za-z0-9_-]{16,})/)?.[1] ?? null;
}
