import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const localUsage = new Map<string, number[]>();

function consumeLocalRateLimit(options: RateLimitOptions) {
  const now = Date.now();
  const key = `${options.endpoint}:${requestAddress(options.request)}:${options.userId || "anonymous"}`;
  const threshold = now - options.windowSeconds * 1_000;
  const recent = (localUsage.get(key) || []).filter(timestamp => timestamp >= threshold);
  if (recent.length >= options.maxRequests) return false;
  recent.push(now);
  localUsage.set(key, recent);
  return true;
}

interface RateLimitOptions {
  endpoint: string;
  request: Request;
  userId?: string | null;
  maxRequests: number;
  windowSeconds: number;
}

const requestAddress = (request: Request) =>
  request.headers.get("cf-connecting-ip")
  || request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
  || request.headers.get("x-real-ip")
  || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  || "unknown";

export function requestActorHash(request: Request, userId?: string | null): string {
  const salt = process.env.RATE_LIMIT_SALT?.trim();
  if (!salt || salt.length < 32) throw new Error('RATE_LIMIT_SALT deve ter pelo menos 32 caracteres.');
  const actor = userId ? `user:${userId}` : `ip:${requestAddress(request)}`;
  return createHash("sha256").update(`${salt}:${actor}`).digest("hex");
}

export async function enforceRateLimit(options: RateLimitOptions): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const adminKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
  const salt = process.env.RATE_LIMIT_SALT?.trim();
  const hasServerConfiguration = Boolean(
    supabaseUrl
    && adminKey
    && salt
    && salt.length >= 32,
  );

  // O teste local não deve exigir credenciais administrativas de produção.
  // Em produção, a ausência desses segredos continua sendo um erro de configuração.
  if (!hasServerConfiguration) {
    if (process.env.NODE_ENV !== "production") return consumeLocalRateLimit(options);
    throw new Error("Limitador de uso não configurado no servidor.");
  }

  const supabase = getSupabaseAdmin();
  const actorHash = requestActorHash(options.request, options.userId);
  const { data, error } = await supabase.rpc("consume_api_rate_limit", {
    p_endpoint: options.endpoint,
    p_actor_hash: actorHash,
    p_user_id: options.userId || null,
    p_max_requests: options.maxRequests,
    p_window_seconds: options.windowSeconds,
  });

  if (error) {
    if (process.env.NODE_ENV !== "production") return consumeLocalRateLimit(options);
    console.warn("Falha ao verificar limite de uso:", error);
    return false;
  }
  return data === true;
}
