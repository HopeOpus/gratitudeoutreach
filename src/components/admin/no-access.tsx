"use client";
import { adminClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export function NoAccess() {
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <EmptyState title="You don't have access to the admin console" body="Ask a Super Admin to add your email to the organisation."
        action={<Button variant="secondary" onClick={async () => { await adminClient().auth.signOut(); window.location.href = "/admin/login"; }}>Sign out</Button>} />
    </main>
  );
}
