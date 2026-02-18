import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleOptions, withCors } from "../_shared/cors.ts";
import { createServiceClient, createUserClient, requireUserId } from "../_shared/supabase.ts";
import { parseIcs } from "../_shared/ics.ts";
import { fetchTextWithLimits, validateOutboundUrl } from "../_shared/net.ts";

function json(data: unknown, status = 200) {
  return withCors(
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    }),
  );
}

function bad(msg: string, status = 400) {
  return json({ error: msg }, status);
}

serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return withCors(opt);

  try {
    const allowHttp = Deno.env.get("ALLOW_HTTP_ICAL_URLS") === "true";
    const allowedPorts = allowHttp ? [80, 443] : [443];
    const fetchLimits = {
      timeoutMs: 10_000,
      maxBytes: 2_000_000,
      maxRedirects: 3,
      allowHttp,
      allowedPorts,
    };

    const supabase = createUserClient(req);
    const userId = await requireUserId(req);
    const serviceClient = createServiceClient();

    const url = new URL(req.url);
    const body = req.method !== "GET" ? await req.json().catch(() => ({})) : {};
    const action = body.action || url.searchParams.get("action");

    if (action !== "sync-subscription") {
      return bad("Unknown action");
    }

    const subscription_id = String(body.subscription_id ?? "");
    if (!subscription_id) return bad("subscription_id required");

    const { data: sub, error: subError } = await supabase
      .from("subscriptions")
      .select("id,calendar_id,ical_url,poll_interval_sec")
      .eq("id", subscription_id)
      .single();

    if (subError || !sub) {
      return bad("Subscription not found", 404);
    }
    const urlCheck = validateOutboundUrl(sub.ical_url, { allowHttp, allowedPorts });
    if (!urlCheck.ok) return bad(`ical_url invalid: ${urlCheck.reason}`);

    const startedAt = new Date().toISOString();
    let httpStatus: number | null = null;
    let bytes: number | null = null;
    let veventCount: number | null = null;
    let lastError: string | null = null;
    let added = 0;
    let updated = 0;
    let removed = 0;

    try {
      const { data: existing, error: existingErr } = await serviceClient
        .from("imported_events")
        .select("source_uid")
        .eq("subscription_id", sub.id);

      if (existingErr) throw existingErr;
      const existingUids = new Set((existing ?? []).map((row) => row.source_uid));

      const fetched = await fetchTextWithLimits(sub.ical_url, fetchLimits);
      httpStatus = fetched.status;
      bytes = fetched.bytes;

      if (httpStatus < 200 || httpStatus >= 300) throw new Error(`Fetch failed: ${httpStatus}`);

      const evs = parseIcs(fetched.text);
      veventCount = evs.length;

      const normalized = evs.map((e) => ({
        uid: e.uid,
        start: e.start,
        end: e.end,
        summary: e.summary,
        status: e.status.toUpperCase() === "CANCELLED" ? "cancelled" : "confirmed",
      }));

      added = normalized.filter((e) => !existingUids.has(e.uid)).length;
      updated = normalized.length - added;

      const upserts = normalized.map((e) => ({
        user_id: userId,
        calendar_id: sub.calendar_id,
        subscription_id: sub.id,
        source_uid: e.uid,
        start_date: e.start,
        end_date: e.end,
        summary: e.summary,
        status: e.status,
        updated_at: new Date().toISOString(),
      }));

      if (upserts.length > 0) {
        const { error: upErr } = await serviceClient
          .from("imported_events")
          .upsert(upserts, { onConflict: "subscription_id,source_uid" });

        if (upErr) throw upErr;
      }

      const newUids = new Set(normalized.map((e) => e.uid));
      const stale = [...existingUids].filter((uid) => !newUids.has(uid));
      removed = stale.length;
      if (stale.length > 0) {
        const { error: delErr } = await serviceClient
          .from("imported_events")
          .delete()
          .eq("subscription_id", sub.id)
          .in("source_uid", stale);

        if (delErr) throw delErr;
      }
    } catch (e) {
      lastError = e instanceof Error ? e.message : "sync failed";
    }

    await serviceClient.from("sync_logs").insert({
      calendar_id: sub.calendar_id,
      subscription_id: sub.id,
      direction: "import",
      status: lastError ? "error" : "success",
      message: lastError,
      events_added: added,
      events_updated: updated,
      events_removed: removed,
      ran_at: startedAt,
      http_status: httpStatus,
      bytes,
      vevent_count: veventCount,
    });

    const nextDue = new Date(Date.now() + Number(sub.poll_interval_sec) * 1000).toISOString();
    await serviceClient.from("subscriptions").update({
      last_synced_at: new Date().toISOString(),
      last_status: httpStatus,
      last_error: lastError,
      next_due_at: nextDue,
    }).eq("id", sub.id);

    if (lastError) return json({ error: lastError }, 500);
    return json({ success: true, added, updated, removed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message === "Unauthorized" ? 401 : 500;
    return json({ error: message }, status);
  }
});
