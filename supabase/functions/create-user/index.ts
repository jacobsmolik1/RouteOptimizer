// create-user — admin-only direct account creation for CCBCU Route Optimizer.
// Caller authorization is enforced via PostgREST RPCs called with the caller's
// JWT (forwarded verbatim via fetch). The service key is used only for the
// GoTrue admin createUser. Creates a confirmed account (no email/confirmation).
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url     = Deno.env.get('SUPABASE_URL')!;
    const anon    = Deno.env.get('SUPABASE_ANON_KEY')!;
    // Prefer a legacy service_role JWT if provided (the injected new-format secret
    // key is rejected by GoTrue admin on projects mid JWT-key migration).
    const service = Deno.env.get('SERVICE_ROLE_JWT') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';

    // Call a PostgREST RPC as the CALLER (their JWT forwarded verbatim).
    const callerRpc = async (fn: string, args: Record<string, unknown>) => {
      const r = await fetch(`${url}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: { 'Authorization': authHeader, 'apikey': anon, 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
      });
      const text = await r.text();
      let data: unknown = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      return { ok: r.ok, status: r.status, data };
    };

    // Create a confirmed user via the GoTrue admin REST endpoint (service key).
    const adminCreateUser = async (em: string, pw: string) => {
      const r = await fetch(`${url}/auth/v1/admin/users`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${service}`, 'apikey': service, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: em, password: pw, email_confirm: true }),
      });
      const t = await r.text(); let b: unknown = null; try { b = t ? JSON.parse(t) : null; } catch { b = t; }
      return { ok: r.ok, status: r.status, body: b };
    };

    const { email, password, role = 'dispatcher', dc_slug } = await req.json();
    if (!email || !password || !dc_slug) return json({ error: 'email, password, and dc_slug are required' }, 400);
    if (String(password).length < 6) return json({ error: 'Password must be at least 6 characters' }, 400);
    if (!['dispatcher', 'admin'].includes(role)) return json({ error: 'Invalid role' }, 400);

    // 1) Authorize — caller must be an admin of this DC (before creating anything).
    const chk = await callerRpc('am_i_dc_admin', { p_dc_slug: dc_slug });
    if (!chk.ok) return json({ error: 'Authorization check failed', detail: chk.data }, chk.status || 401);
    if (chk.data !== true) return json({ error: 'Admin access required for this DC' }, 403);

    // 2) Create the confirmed account (GoTrue admin REST, service key). Reuse if it exists.
    const cu = await adminCreateUser(email, password);
    let existed = false;
    if (!cu.ok) {
      const msg = JSON.stringify(cu.body || '');
      if (/already|exist|registered/i.test(msg)) existed = true;
      else return json({ error: 'Create user failed', detail: cu.body }, cu.status || 400);
    }

    // 3) Grant this DC's access via the existing admin-gated RPC (as the caller).
    const grant = await callerRpc('grant_dc_access', { p_dc_slug: dc_slug, p_email: email, p_role: role });
    if (!grant.ok) return json({ error: 'Grant failed', detail: grant.data }, grant.status || 403);

    return json({ ok: true, email, role, existed, grant: grant.data });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
