export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

export function withCors(resp: Response): Response {
  const h = new Headers(resp.headers);
  for (const [k, v] of Object.entries(corsHeaders)) h.set(k, v);
  return new Response(resp.body, { status: resp.status, headers: h });
}

export function handleOptions(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return null;
}
