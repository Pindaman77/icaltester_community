import { IcsEvent } from "./types.ts";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function isoToIcsDate(iso: string): string {
  // YYYY-MM-DD -> YYYYMMDD
  return iso.replaceAll("-", "");
}

export function nowDtstamp(): string {
  const d = new Date();
  return (
    d.getUTCFullYear() +
    pad2(d.getUTCMonth() + 1) +
    pad2(d.getUTCDate()) +
    "T" +
    pad2(d.getUTCHours()) +
    pad2(d.getUTCMinutes()) +
    pad2(d.getUTCSeconds()) +
    "Z"
  );
}

export function escapeIcsText(s: string): string {
  return String(s)
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

export function buildIcsCalendar(args: {
  name: string;
  prodId?: string;
  events: Array<{ uid: string; start: string; end: string; summary: string; status?: string }>;
}): string {
  const prodId = args.prodId ?? "-//StayManager ICS Mock//EN";
  const dtstamp = nowDtstamp();

  const lines: string[] = [];
  lines.push("BEGIN:VCALENDAR");
  lines.push("VERSION:2.0");
  lines.push(`PRODID:${prodId}`);
  lines.push("CALSCALE:GREGORIAN");
  lines.push("METHOD:PUBLISH");
  lines.push(`X-WR-CALNAME:${escapeIcsText(args.name)}`);

  for (const ev of args.events) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${ev.uid}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART;VALUE=DATE:${isoToIcsDate(ev.start)}`);
    lines.push(`DTEND;VALUE=DATE:${isoToIcsDate(ev.end)}`); // end-exclusive
    lines.push(`SUMMARY:${escapeIcsText(ev.summary || "Blocked")}`);
    // Map status to ICS STATUS values: CONFIRMED, TENTATIVE, CANCELLED
    const statusLower = (ev.status ?? "confirmed").toLowerCase();
    if (statusLower === "cancelled") {
      lines.push("STATUS:CANCELLED");
    } else if (statusLower === "tentative" || statusLower === "pending") {
      lines.push("STATUS:TENTATIVE");
    } else {
      lines.push("STATUS:CONFIRMED");
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

/**
 * Minimal ICS parser for VEVENT:
 * - Handles folded lines
 * - Extracts UID, DTSTART, DTEND, SUMMARY, STATUS
 * - Converts datetime to date (UTC day)
 * - Ensures end-exclusive (end missing/<=start => start+1 day)
 */
export function parseIcs(text: string): IcsEvent[] {
  const unfolded = unfoldIcs(text);
  const lines = unfolded.split(/\r?\n/);

  const events: IcsEvent[] = [];
  let cur: Partial<IcsEvent> | null = null;
  let dtstartRaw: string | null = null;
  let dtendRaw: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line) continue;

    if (line === "BEGIN:VEVENT") {
      cur = {};
      dtstartRaw = null;
      dtendRaw = null;
      continue;
    }
    if (line === "END:VEVENT") {
      if (cur?.uid && dtstartRaw) {
        const start = parseToIsoDate(dtstartRaw);
        let end = dtendRaw ? parseToIsoDate(dtendRaw) : addDays(start, 1);

        if (end <= start) end = addDays(start, 1);

        events.push({
          uid: cur.uid,
          start,
          end,
          summary: cur.summary ?? "Imported",
          status: cur.status ?? "CONFIRMED",
        });
      }
      cur = null;
      dtstartRaw = null;
      dtendRaw = null;
      continue;
    }
    if (!cur) continue;

    const { key, value } = splitIcsLine(line);
    if (!key) continue;

    if (key === "UID") cur.uid = value;
    if (key === "SUMMARY") cur.summary = value;
    if (key === "STATUS") cur.status = value.toUpperCase() === "CANCELLED" ? "CANCELLED" : "CONFIRMED";
    if (key === "DTSTART") dtstartRaw = value;
    if (key === "DTEND") dtendRaw = value;
  }

  return events;
}

function unfoldIcs(text: string): string {
  // RFC5545 line folding: lines starting with space or tab are continuation
  return text.replace(/\r?\n[ \t]/g, "");
}

function splitIcsLine(line: string): { key: string | null; value: string } {
  const idx = line.indexOf(":");
  if (idx === -1) return { key: null, value: "" };

  const left = line.slice(0, idx);
  const value = line.slice(idx + 1);

  const key = left.split(";")[0].toUpperCase(); // drop params
  return { key, value };
}

function parseToIsoDate(v: string): string {
  // v examples:
  // - 20260110
  // - 20260110T120000Z
  // - 20260110T120000
  // Convert to UTC date YYYY-MM-DD

  if (/^\d{8}$/.test(v)) return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;

  if (/^\d{8}T\d{6}Z$/.test(v)) {
    const d = new Date(
      Date.UTC(
        Number(v.slice(0, 4)),
        Number(v.slice(4, 6)) - 1,
        Number(v.slice(6, 8)),
        Number(v.slice(9, 11)),
        Number(v.slice(11, 13)),
        Number(v.slice(13, 15)),
      ),
    );
    return toIsoDateUtc(d);
  }

  if (/^\d{8}T\d{6}$/.test(v)) {
    // treat as UTC for test purposes
    const d = new Date(
      Date.UTC(
        Number(v.slice(0, 4)),
        Number(v.slice(4, 6)) - 1,
        Number(v.slice(6, 8)),
        Number(v.slice(9, 11)),
        Number(v.slice(11, 13)),
        Number(v.slice(13, 15)),
      ),
    );
    return toIsoDateUtc(d);
  }

  // fallback: take first 8 digits if present
  const m = v.match(/(\d{8})/);
  if (m) {
    const s = m[1];
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }

  // last resort: today
  return toIsoDateUtc(new Date());
}

function toIsoDateUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}
