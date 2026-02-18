import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleOptions, withCors } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/supabase.ts";
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

    const supabase = createServiceClient();

    const provided = req.headers.get("x-cron-secret") ?? "";
    let cronSecret = Deno.env.get("ICS_CRON_SECRET") ?? "";
    const { data: secretRow, error: secretErr } = await supabase
      .from("ics_cron_settings")
      .select("cron_secret")
      .eq("id", 1)
      .maybeSingle();

    if (secretErr && secretErr.code !== "42P01") throw secretErr;
    if (!secretErr && secretRow?.cron_secret) {
      cronSecret = secretRow.cron_secret;
    }

    if (!cronSecret || provided !== cronSecret) return json({ error: "Forbidden" }, 403);

    const nowIso = new Date().toISOString();
    const { data: subs, error } = await supabase
      .from("subscriptions")
      .select("id,calendar_id,ical_url,poll_interval_sec,calendars!inner(user_id)")
      .eq("enabled", true)
      .lte("next_due_at", nowIso)
      .order("next_due_at", { ascending: true })
      .limit(25);

    if (error) throw error;
    if (!subs || subs.length === 0) return json({ ok: true, processed: 0 });

    let processed = 0;
    let ok = 0;
    let failed = 0;

    for (const sub of subs) {
      processed++;
      const startedAt = new Date().toISOString();

      let httpStatus: number | null = null;
      let bytes: number | null = null;
      let veventCount: number | null = null;
      let lastError: string | null = null;
      let added = 0;
      let updated = 0;
      let removed = 0;

      try {
        const cal = sub.calendars as unknown as { user_id: string } | null;
        const userId = cal?.user_id;
        if (!userId) throw new Error("Missing calendar owner");
        const urlCheck = validateOutboundUrl(sub.ical_url, { allowHttp, allowedPorts });
        if (!urlCheck.ok) throw new Error(`ical_url invalid: ${urlCheck.reason}`);

        const { data: existing, error: existingErr } = await supabase
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
          const { error: upErr } = await supabase
            .from("imported_events")
            .upsert(upserts, { onConflict: "subscription_id,source_uid" });
          if (upErr) throw upErr;
        }

        const newUids = new Set(normalized.map((e) => e.uid));
        const stale = [...existingUids].filter((uid) => !newUids.has(uid));
        removed = stale.length;
        if (stale.length > 0) {
          const { error: delErr } = await supabase
            .from("imported_events")
            .delete()
            .eq("subscription_id", sub.id)
            .in("source_uid", stale);
          if (delErr) throw delErr;
        }

        ok++;
      } catch (e) {
        failed++;
        lastError = e instanceof Error ? e.message : "sync failed";
      }

      await supabase.from("sync_logs").insert({
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
      await supabase.from("subscriptions").update({
        last_synced_at: new Date().toISOString(),
        last_status: httpStatus,
        last_error: lastError,
        next_due_at: nextDue,
      }).eq("id", sub.id);
    }

    return json({ ok: true, processed, ok_count: ok, failed_count: failed });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return json({ error: msg }, 500);
  }
});
