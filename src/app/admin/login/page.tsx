"use client";
import { useState } from "react";
import Link from "next/link";
import { adminClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { AlertBanner } from "@/components/ui/misc";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    const { error } = await adminClient().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) { setErr("Email or password is not right."); return; }
    window.location.href = "/admin";
  };
  const magic = async () => {
    if (!email.trim()) { setErr("Enter your email first."); return; }
    setBusy(true); setErr(null);
    const { error } = await adminClient().auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/admin` } });
    setBusy(false);
    if (error) setErr("Could not send the link. Check the email address."); else setSent(true);
  };

  return (
    <main className="grid min-h-dvh md:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-forest p-12 text-white md:flex">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/gratitude-logo-white.svg" alt="Gratitude Outreach" className="w-64" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/gratitude-mark-transparent.svg" alt="" aria-hidden className="pointer-events-none absolute -bottom-32 -right-32 w-[520px] opacity-[0.06]" />
        <div>
          <p className="text-h1 font-light text-fresh">Register once.</p>
          <p className="text-h1 font-light">Every station sees what happened before.</p>
        </div>
        <p className="text-caption text-forest-300">Gratitude Connect · admin console</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={signIn} className="flex w-full max-w-sm flex-col gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/gratitude-logo.svg" alt="Gratitude Outreach" className="mb-4 w-52 md:hidden" />
          <h1 className="text-h1 font-medium text-forest">Admin sign in</h1>
          {err && <AlertBanner tone="danger">{err}</AlertBanner>}
          {sent && <AlertBanner tone="success">Check your email for a sign-in link.</AlertBanner>}
          <Field label="Email" htmlFor="email"><Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
          <Field label="Password" htmlFor="pw"><Input id="pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <Button type="submit" size="lg" block loading={busy} disabled={!password}>Sign in</Button>
          <Button type="button" variant="ghost" onClick={() => void magic()} disabled={busy}>Email me a magic link instead</Button>
          <p className="text-caption text-neutral-500">Volunteers don&apos;t need an account: <Link className="text-leaf-700 underline" href="/join">join a station with a PIN</Link>.</p>
        </form>
      </div>
    </main>
  );
}
