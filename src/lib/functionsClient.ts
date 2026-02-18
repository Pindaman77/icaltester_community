import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from "@/integrations/supabase/client";

const defaultBase = `${SUPABASE_URL}/functions/v1`;
const functionsBase = (import.meta.env.VITE_SUPABASE_FUNCTIONS_URL as string) || defaultBase;
const defaultPublicFeedBase = "https://icaltester.com";
const publicFeedBase = (import.meta.env.VITE_PUBLIC_FEED_BASE_URL as string) || defaultPublicFeedBase;
if (import.meta.env.PROD && !/^https:\/\//i.test(publicFeedBase)) {
  throw new Error("VITE_PUBLIC_FEED_BASE_URL must be https in production");
}
const normalizedPublicFeedBase = publicFeedBase.replace(/\/+$/, "");

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not authenticated");

  return {
    Authorization: `Bearer ${token}`,
    apikey: SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
  };
}

export async function fnGet<T>(path: string): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${functionsBase}/ics_api${path}`, { headers, method: "GET" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json as T;
}

export async function fnPost<T>(path: string, body?: unknown): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${functionsBase}/ics_api${path}`, {
    headers,
    method: "POST",
    body: body ? JSON.stringify(body) : "{}",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json as T;
}

export async function fnPatch<T>(path: string, body?: unknown): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${functionsBase}/ics_api${path}`, {
    headers,
    method: "PATCH",
    body: body ? JSON.stringify(body) : "{}",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json as T;
}

export async function fnDelete<T>(path: string): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${functionsBase}/ics_api${path}`, { headers, method: "DELETE" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json as T;
}

export function publicIcsUrl(feed_token: string): string {
  return `${normalizedPublicFeedBase}${publicIcsPath(feed_token)}`;
}

export function publicIcsPath(feed_token: string): string {
  return `/ics-feed/${feed_token}`;
}
