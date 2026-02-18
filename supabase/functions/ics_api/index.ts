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

function routeParts(req: Request, functionName: string): string[] {
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const idx = parts.indexOf(functionName);
  if (idx >= 0) return parts.slice(idx + 1);
  return parts;
}

function generateUid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeStatus(status: string | null | undefined): "confirmed" | "cancelled" | "tentative" | "pending" {
  const value = String(status ?? "").toLowerCase();
  if (value === "cancelled") return "cancelled";
  if (value === "tentative") return "tentative";
  if (value === "pending") return "pending";
  return "confirmed";
}

function normalizeDefaultStatus(
  status: unknown,
): "pending" | "tentative" | "confirmed" | null {
  const value = String(status ?? "").toLowerCase();
  if (value === "pending" || value === "tentative" || value === "confirmed") {
    return value;
  }
  return null;
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

    const parts = routeParts(req, "ics_api");
    const supabase = createUserClient(req);

    // Auth gate
    const userId = await requireUserId(req);

    // ROUTES:
    // GET   /calendars
    // POST  /calendars
    // PATCH /calendars/:id
    // GET   /manual-events?calendar_id=...
    // POST  /manual-events
    // PATCH /manual-events/:id
    // DELETE /manual-events/:id
    // GET   /subscriptions?calendar_id=...
    // POST  /subscriptions
    // PATCH /subscriptions/:id
    // POST  /subscriptions/:id/sync
    // GET   /imported-events?subscription_id=...
    // GET   /sync-logs?subscription_id=...
    // DELETE /account

    // --- Calendars ---
    if (req.method === "GET" && parts[0] === "calendars") {
      const { data, error } = await supabase
        .from("calendars")
        .select(
          "id,name,feed_token,include_imported_in_export,default_booking_status,created_at,updated_at,poll_interval_minutes",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return json({ calendars: data ?? [] });
    }

    if (req.method === "POST" && parts[0] === "calendars") {
      const body = await req.json().catch(() => ({}));
      const name = String(body.name ?? "").trim();
      if (!name) return bad("name required");

      const { data, error } = await supabase
        .from("calendars")
        .insert({
          user_id: userId,
          name,
          include_imported_in_export: false,
        })
        .select(
          "id,name,feed_token,include_imported_in_export,default_booking_status,created_at,updated_at,poll_interval_minutes",
        )
        .single();

      if (error) throw error;
      return json({ calendar: data }, 201);
    }

    if (parts[0] === "calendars" && parts[1]) {
      const id = parts[1];

      if (req.method === "PATCH") {
        const body = await req.json().catch(() => ({}));
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

        if (body.name !== undefined) {
          const name = String(body.name ?? "").trim();
          if (!name) return bad("name required");
          patch.name = name;
        }

        if (body.poll_interval_minutes !== undefined) {
          const poll = Number(body.poll_interval_minutes);
          if (!Number.isFinite(poll) || poll <= 0) return bad("poll_interval_minutes must be positive");
          patch.poll_interval_minutes = poll;
        }

        if (body.include_imported_in_export !== undefined) {
          patch.include_imported_in_export = Boolean(body.include_imported_in_export);
        }

        if (body.default_booking_status !== undefined) {
          const normalized = normalizeDefaultStatus(body.default_booking_status);
          if (!normalized) {
            return bad("default_booking_status must be pending, tentative, or confirmed");
          }
          patch.default_booking_status = normalized;
        }

        const { data, error } = await supabase
          .from("calendars")
          .update(patch)
          .eq("id", id)
          .eq("user_id", userId)
          .select(
            "id,name,feed_token,include_imported_in_export,default_booking_status,created_at,updated_at,poll_interval_minutes",
          )
          .single();

        if (error) throw error;
        return json({ calendar: data });
      }

      if (req.method === "DELETE") {
        const { error } = await supabase.from("calendars").delete().eq("id", id).eq("user_id", userId);
        if (error) throw error;
        return json({ ok: true });
      }
    }

    // --- Manual events ---
    if (req.method === "GET" && parts[0] === "manual-events") {
      const url = new URL(req.url);
      const calendar_id = url.searchParams.get("calendar_id") ?? "";
      if (!calendar_id) return bad("calendar_id required");

      const { data, error } = await supabase
        .from("bookings")
        .select("id,calendar_id,uid,start_date,end_date,summary,status,source,updated_at")
        .eq("calendar_id", calendar_id)
        .eq("source", "manual")
        .order("start_date", { ascending: true });

      if (error) throw error;
      return json({ events: data ?? [] });
    }

    if (req.method === "POST" && parts[0] === "manual-events") {
      const body = await req.json().catch(() => ({}));
      const calendar_id = String(body.calendar_id ?? "");
      const start_date = String(body.start_date ?? "");
      const end_date = String(body.end_date ?? "");
      const summary = String(body.summary ?? "Blocked");
      if (!calendar_id || !start_date || !end_date) return bad("calendar_id/start_date/end_date required");
      if (end_date <= start_date) return bad("end_date must be after start_date (exclusive)");

      const { data, error } = await supabase
        .from("bookings")
        .insert({
          calendar_id,
          uid: body.uid ? String(body.uid) : generateUid(),
          start_date,
          end_date,
          summary,
          status: normalizeStatus(body.status),
          source: "manual",
        })
        .select("id,calendar_id,uid,start_date,end_date,summary,status,source,updated_at")
        .single();

      if (error) throw error;
      return json({ event: data }, 201);
    }

    if (parts[0] === "manual-events" && parts[1]) {
      const id = parts[1];

      if (req.method === "PATCH") {
        const body = await req.json().catch(() => ({}));
        
        // Build update object with only provided fields
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (body.status !== undefined) updates.status = normalizeStatus(body.status);
        if (body.summary !== undefined) updates.summary = String(body.summary);
        if (body.start_date !== undefined) updates.start_date = String(body.start_date);
        if (body.end_date !== undefined) updates.end_date = String(body.end_date);
        
        // Validate dates if both are provided
        if (updates.start_date && updates.end_date && updates.end_date <= updates.start_date) {
          return bad("end_date must be after start_date");
        }

        const { data, error } = await supabase
          .from("bookings")
          .update(updates)
          .eq("id", id)
          .eq("source", "manual")
          .select("id,calendar_id,uid,start_date,end_date,summary,status,source,updated_at")
          .single();

        if (error) throw error;
        return json({ event: data });
      }

      if (req.method === "DELETE") {
        const { error } = await supabase.from("bookings").delete().eq("id", id).eq("source", "manual");
        if (error) throw error;
        return json({ ok: true });
      }
    }

    // --- Subscriptions ---
    if (req.method === "GET" && parts[0] === "subscriptions") {
      const url = new URL(req.url);
      const calendar_id = url.searchParams.get("calendar_id") ?? "";
      if (!calendar_id) return bad("calendar_id required");

      const { data, error } = await supabase
        .from("subscriptions")
        .select(
          "id,calendar_id,name,ical_url,enabled,poll_interval_sec,next_due_at,last_synced_at,last_status,last_error,created_at",
        )
        .eq("calendar_id", calendar_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return json({ subscriptions: data ?? [] });
    }

    if (req.method === "POST" && parts[0] === "subscriptions") {
      const body = await req.json().catch(() => ({}));
      const calendar_id = String(body.calendar_id ?? "");
      const name = String(body.name ?? "").trim();
      const ical_url = String(body.ical_url ?? "");
      const poll_interval_sec = Math.max(60, Number(body.poll_interval_sec ?? 300));
      if (!calendar_id || !ical_url || !name) return bad("calendar_id/name/ical_url required");
      if (!Number.isFinite(poll_interval_sec)) return bad("poll_interval_sec must be a number");
      const urlCheck = validateOutboundUrl(ical_url, { allowHttp, allowedPorts });
      if (!urlCheck.ok) return bad(`ical_url invalid: ${urlCheck.reason}`);

      const { data, error } = await supabase
        .from("subscriptions")
        .insert({
          calendar_id,
          name,
          ical_url,
          enabled: true,
          poll_interval_sec,
          next_due_at: new Date().toISOString(),
        })
        .select(
          "id,calendar_id,name,ical_url,enabled,poll_interval_sec,next_due_at,last_synced_at,last_status,last_error,created_at",
        )
        .single();

      if (error) throw error;
      return json({ subscription: data }, 201);
    }

    if (parts[0] === "subscriptions" && parts[1]) {
      const subId = parts[1];

      if (req.method === "PATCH") {
        const body = await req.json().catch(() => ({}));
        const patch: Record<string, unknown> = {};

        if (body.enabled !== undefined) {
          patch.enabled = Boolean(body.enabled);
        }
        if (body.poll_interval_sec !== undefined) {
          const poll = Number(body.poll_interval_sec);
          if (!Number.isFinite(poll) || poll < 0) {
            return bad("poll_interval_sec must be a non-negative number");
          }
          patch.poll_interval_sec = poll === 0 ? 0 : Math.max(60, poll);
        }
        if (body.name !== undefined) {
          const name = String(body.name).trim();
          if (!name) return bad("name cannot be empty");
          patch.name = name;
        }
        if (body.ical_url !== undefined) {
          const ical_url = String(body.ical_url).trim();
          if (!ical_url) return bad("ical_url cannot be empty");
          const urlCheck = validateOutboundUrl(ical_url, { allowHttp, allowedPorts });
          if (!urlCheck.ok) return bad(`ical_url invalid: ${urlCheck.reason}`);
          patch.ical_url = ical_url;
        }

        if (Object.keys(patch).length === 0) {
          return bad("No valid fields to update");
        }

        const { data, error } = await supabase
          .from("subscriptions")
          .update(patch)
          .eq("id", subId)
          .select(
            "id,calendar_id,name,ical_url,enabled,poll_interval_sec,next_due_at,last_synced_at,last_status,last_error,created_at",
          )
          .single();

        if (error) throw error;
        return json({ subscription: data });
      }

      if (req.method === "DELETE") {
        const { error } = await supabase.from("subscriptions").delete().eq("id", subId);
        if (error) throw error;
        return json({ ok: true });
      }

      if (req.method === "POST" && parts[2] === "sync") {
        const { data: sub, error: subErr } = await supabase
          .from("subscriptions")
          .select("id,calendar_id,ical_url,poll_interval_sec")
          .eq("id", subId)
          .single();

        if (subErr) throw subErr;

        const startedAt = new Date().toISOString();
        let httpStatus: number | null = null;
        let bytes: number | null = null;
        let veventCount: number | null = null;
        let lastError: string | null = null;
        let added = 0;
        let updated = 0;
        let removed = 0;

        try {
          const existingRows = await supabase
            .from("imported_events")
            .select("source_uid")
            .eq("subscription_id", sub.id);

          if (existingRows.error) throw existingRows.error;
          const existingUids = new Set((existingRows.data ?? []).map((row) => row.source_uid));

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
        } catch (e) {
          lastError = e instanceof Error ? e.message : "sync failed";
        }

        await supabase.from("sync_logs").insert({
          calendar_id: sub.calendar_id,
          subscription_id: subId,
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
        }).eq("id", subId);

        if (lastError) return json({ ok: false, error: lastError }, 500);
        return json({ ok: true, http_status: httpStatus, bytes, vevent_count: veventCount });
      }
    }

    // --- Imported events ---
    if (req.method === "GET" && parts[0] === "imported-events") {
      const url = new URL(req.url);
      const subscription_id = url.searchParams.get("subscription_id") ?? "";
      const calendar_id = url.searchParams.get("calendar_id") ?? "";
      if (!subscription_id && !calendar_id) return bad("subscription_id or calendar_id required");

      const query = supabase
        .from("imported_events")
        .select("id,subscription_id,calendar_id,source_uid,start_date,end_date,summary,status,updated_at")
        .order("start_date", { ascending: true });

      const { data, error } = subscription_id
        ? await query.eq("subscription_id", subscription_id)
        : await query.eq("calendar_id", calendar_id);

      if (error) throw error;
      return json({ events: data ?? [] });
    }

    // --- Sync logs ---
    if (req.method === "GET" && parts[0] === "sync-logs") {
      const url = new URL(req.url);
      const subscription_id = url.searchParams.get("subscription_id") ?? "";
      const calendar_id = url.searchParams.get("calendar_id") ?? "";
      if (!subscription_id && !calendar_id) return bad("subscription_id or calendar_id required");

      const base = supabase
        .from("sync_logs")
        .select(
          "id,subscription_id,calendar_id,direction,ran_at,http_status,bytes,vevent_count,message,status,events_added,events_updated,events_removed",
        )
        .order("ran_at", { ascending: false })
        .limit(50);

      const { data, error } = subscription_id
        ? await base.eq("subscription_id", subscription_id)
        : await base.eq("calendar_id", calendar_id);

      if (error) throw error;
      return json({ logs: data ?? [] });
    }

    // --- Account deletion (hard delete) ---
    if (req.method === "DELETE" && parts[0] === "account") {
      const serviceClient = createServiceClient();

      // Delete in leaf -> root order for explicit, predictable cleanup.
      const cleanupTables: Array<{ table: string; column: string }> = [
        { table: "sync_logs", column: "user_id" },
        { table: "imported_events", column: "user_id" },
        { table: "subscriptions", column: "user_id" },
        { table: "bookings", column: "user_id" },
        { table: "calendars", column: "user_id" },
        { table: "user_roles", column: "user_id" },
        { table: "profiles", column: "id" },
      ];

      for (const step of cleanupTables) {
        const { error } = await serviceClient.from(step.table).delete().eq(step.column, userId);
        if (error) throw new Error(error.message || "Account cleanup failed");
      }

      const { error: deleteAuthError } = await serviceClient.auth.admin.deleteUser(userId);
      if (deleteAuthError) throw deleteAuthError;

      return json({ ok: true });
    }

    return withCors(new Response("Not Found", { status: 404 }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    const status = msg === "Unauthorized" ? 401 : 500;
    return json({ error: msg }, status);
  }
});
