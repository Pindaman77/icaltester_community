import { createClient } from "npm:@supabase/supabase-js@2";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
};

function mustEnv(name: keyof Env): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export function getEnv(): Env {
  return {
    SUPABASE_URL: mustEnv("SUPABASE_URL"),
    SUPABASE_ANON_KEY: mustEnv("SUPABASE_ANON_KEY"),
    SUPABASE_SERVICE_ROLE_KEY: mustEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

export function createServiceClient() {
  const env = getEnv();
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

export function createUserClient(req: Request) {
  const env = getEnv();
  const auth = req.headers.get("Authorization") ?? "";
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: auth } },
  });
}

export async function requireUserId(req: Request): Promise<string> {
  const supabase = createUserClient(req);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user?.id) throw new Error("Unauthorized");
  return data.user.id;
}
