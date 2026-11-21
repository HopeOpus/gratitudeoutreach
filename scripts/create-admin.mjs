// Create (or update) an admin login. Uses the service-role key from .env.local
// (or env vars). Usage:
//   node scripts/create-admin.mjs <email> <role> "<Display name>" [password]
// role: super_admin | coordinator | followup | viewer. A strong password is generated if omitted.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";

const env = { ...process.env };
if (existsSync(".env.local")) {
  for (const l of readFileSync(".env.local", "utf8").split("\n")) {
    const i = l.indexOf("=");
    if (i > 0 && !l.startsWith("#") && !env[l.slice(0, i)]) env[l.slice(0, i)] = l.slice(i + 1);
  }
}
const [email, role = "super_admin", name = "Admin", given] = process.argv.slice(2);
if (!email || !["super_admin", "coordinator", "followup", "viewer"].includes(role)) {
  console.error('Usage: node scripts/create-admin.mjs <email> <super_admin|coordinator|followup|viewer> "<Name>" [password]');
  process.exit(1);
}
const password = given ?? `Gc-${randomBytes(9).toString("base64url")}`;
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: orgs, error: orgErr } = await sb.from("organizations").select("id, name").order("created_at").limit(1);
if (orgErr || !orgs?.length) { console.error("No organisation found. Create one first (see README → Deployment)."); process.exit(1); }

let userId;
const { data: created, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: name } });
if (error) {
  // Already exists: reset the password instead.
  const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!existing) { console.error(error.message); process.exit(1); }
  await sb.auth.admin.updateUserById(existing.id, { password });
  userId = existing.id;
} else {
  userId = created.user.id;
}
const { error: mErr } = await sb.from("org_members").upsert({ org_id: orgs[0].id, user_id: userId, role, display_name: name });
if (mErr) { console.error(mErr.message); process.exit(1); }
console.log(JSON.stringify({ org: orgs[0].name, email, password, role }, null, 2));
