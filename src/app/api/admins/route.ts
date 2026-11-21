import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, bad, appUrl } from "@/lib/server/api-auth";
import { serviceClient } from "@/lib/supabase/service";

const body = z.object({
  email: z.string().email(),
  display_name: z.string().trim().min(1).max(80),
  role: z.enum(["super_admin", "coordinator", "followup", "viewer"]),
  password: z.string().max(200).optional(),
});

/** Super Admin adds an admin (FR-12.4): create with a temporary password, or invite by email. */
export async function POST(req: Request) {
  const g = await requireAdmin("super_admin");
  if (g instanceof NextResponse) return g;
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return bad("Check the email, name and role");
  const { email, display_name, role, password } = parsed.data;
  if (password && password.length < 10) return bad("Temporary password must be at least 10 characters");
  const svc = serviceClient();
  let userId: string | undefined;
  let invited = false;
  if (password) {
    const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name } });
    if (error) return bad(error.message);
    userId = data.user.id;
  } else {
    const { data, error } = await svc.auth.admin.inviteUserByEmail(email, { redirectTo: `${appUrl(req)}/admin`, data: { display_name } });
    if (error) return bad(error.message);
    userId = data.user.id;
    invited = true;
  }
  const { error } = await g.sb.from("org_members").insert({ org_id: g.ctx.orgId, user_id: userId, role, display_name });
  if (error) return bad(error.message);
  return NextResponse.json({ ok: true, invited });
}
