import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { handleOptions, withCors } from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/supabase.ts";
import { buildIcsCalendar } from "../_shared/ics.ts";

const RATE_LIMIT_PER_HOUR = 100;
const TOKEN_PREFIX_LENGTH = 8;

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getClientIp(req: Request): string | null {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return req.headers.get("cf-connecting-ip");
}

async function logAccess(args: {
  supabase: ReturnType<typeof createServiceClient>;
  tokenHash: string;
  statusCode: number;
  isRateLimited?: boolean;
  req: Request;
}) {
  try {
    await args.supabase.from("feed_access_audit").insert({
      token_hash_prefix: args.tokenHash.slice(0, TOKEN_PREFIX_LENGTH),
      ip: getClientIp(args.req),
      status_code: args.statusCode,
      is_rate_limited: args.isRateLimited ?? false,
    });
  } catch (error) {
    console.error("[ics-feed] audit log insert failed", error);
  }
}

serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return withCors(opt);

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);

    // Supabase prefixes paths with /functions/v1/{function-name}/
    // Expected path: /functions/v1/ics-feed/{feed_token}
    // Find the function name index and get the token after it
    const functionName = "ics-feed";
    const functionIndex = pathParts.indexOf(functionName);

    if (functionIndex === -1 || functionIndex === pathParts.length - 1) {
      return withCors(new Response("Feed token required", { status: 400 }));
    }

    // Token is the path segment after the function name
    const feedToken = pathParts[functionIndex + 1];

    if (!feedToken) {
      return withCors(new Response("Feed token required", { status: 400 }));
    }

    const tokenHash = await sha256(feedToken);
    const tokenPrefix = tokenHash.slice(0, TOKEN_PREFIX_LENGTH);

    console.log(`[ics-feed] Fetching feed for token hash prefix: ${tokenPrefix}`);

    const supabase = createServiceClient();

    const windowStart = new Date();
    windowStart.setMinutes(0, 0, 0);

    const { data: countData, error: rateError } = await supabase.rpc(
      "increment_feed_rate_limit",
      {
        p_token_hash: tokenHash,
        p_window_start: windowStart.toISOString(),
      }
    );

    if (rateError) {
      console.error("[ics-feed] Rate limit RPC error:", JSON.stringify(rateError, null, 2));
      console.error("[ics-feed] Rate limit RPC error details:", {
        message: rateError.message,
        details: rateError.details,
        hint: rateError.hint,
        code: rateError.code,
      });
      await logAccess({ supabase, tokenHash, statusCode: 500, req });
      return withCors(new Response(`Error checking rate limit: ${rateError.message || 'Unknown error'}`, { status: 500 }));
    }

    const count = typeof countData === "number" ? countData : 0;
    if (count > RATE_LIMIT_PER_HOUR) {
      await logAccess({
        supabase,
        tokenHash,
        statusCode: 429,
        isRateLimited: true,
        req,
      });
      return withCors(new Response("Rate limit exceeded", { status: 429 }));
    }

    // Find calendar by feed token hash
    const { data: calendar, error: calError } = await supabase
      .from("calendars")
      .select("id, name, include_imported_in_export")
      .eq("feed_token_hash", tokenHash)
      .maybeSingle();

    if (calError) {
      console.error("Calendar lookup error:", calError);
      await logAccess({ supabase, tokenHash, statusCode: 500, req });
      return withCors(new Response("Error fetching calendar", { status: 500 }));
    }

    if (!calendar) {
      return withCors(new Response("Calendar not found", { status: 404 }));
    }

    // Fetch manual bookings
    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("id,uid,start_date,end_date,summary,status")
      .eq("calendar_id", calendar.id)
      .eq("source", "manual")
      .order("start_date", { ascending: true });

    if (bookingsError) {
      console.error("Bookings fetch error:", bookingsError);
      await logAccess({ supabase, tokenHash, statusCode: 500, req });
      return withCors(new Response("Error fetching bookings", { status: 500 }));
    }

    let importedEvents: Array<{
      subscription_id: string;
      source_uid: string;
      start_date: string;
      end_date: string;
      summary: string;
      status: string;
    }> = [];

    if (calendar.include_imported_in_export) {
      const { data, error } = await supabase
        .from("imported_events")
        .select("subscription_id,source_uid,start_date,end_date,summary,status")
        .eq("calendar_id", calendar.id);

      if (error) {
        console.error("Imported events fetch error:", error);
        await logAccess({ supabase, tokenHash, statusCode: 500, req });
        return withCors(new Response("Error fetching imported events", { status: 500 }));
      }
      importedEvents = data ?? [];
    }

    const events = [
      ...(bookings ?? []).map((booking) => ({
        uid: booking.uid || `m-${booking.id}@icaltester`,
        start: booking.start_date,
        end: booking.end_date,
        summary: booking.summary,
        status: booking.status,
      })),
      ...importedEvents.map((event) => ({
        uid: `i-${event.subscription_id}-${event.source_uid}@icaltester`,
        start: event.start_date,
        end: event.end_date,
        summary: event.summary,
        status: event.status,
      })),
    ];

    const ical = buildIcsCalendar({ name: calendar.name, events });

    console.log(`[ics-feed] Generated iCal with ${events.length} events`);

    return withCors(new Response(ical, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${calendar.name}.ics"`,
        "Cache-Control": "no-store",
      },
    }));
  } catch (error) {
    console.error("Error generating feed:", error);
    return withCors(new Response("Internal server error", { status: 500 }));
  }
});
