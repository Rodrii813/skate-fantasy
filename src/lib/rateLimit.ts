// Limitador de peticiones simple, en memoria — pensado como primera barrera
// contra spam y fuerza bruta antes del lanzamiento, no como solución
// definitiva para siempre.
//
// OJO con esto si la web corre en varias instancias serverless a la vez
// (p.ej. varias funciones de Vercel bajo carga real): cada instancia lleva
// su propio contador en memoria, así que el límite efectivo puede ser más
// alto que el número configurado aquí (si hay 3 instancias activas, en la
// práctica se permite hasta 3x). Para un límite estricto de verdad con
// tráfico serio haría falta un almacén compartido (p.ej. Upstash Redis, que
// tiene plan gratuito). Para el volumen esperado al lanzar (pocas instancias
// activas a la vez) esto ya frena los intentos automatizados obvios.
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Limpieza periódica para no acumular memoria indefinidamente con claves
// (IPs, emails) que ya caducaron hace rato.
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
let lastCleanup = Date.now();
function cleanupIfDue() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  // Segundos que hay que esperar hasta que se libere de nuevo esta clave.
  // Solo tiene sentido cuando allowed === false.
  retryAfterSeconds: number;
}

// `key` debe identificar ya la ruta + el origen concreto (p.ej.
// `"login:" + email` o `"register:" + ip`), para que los límites de rutas
// distintas no se mezclen entre sí sin querer.
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  cleanupIfDue();
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

type HeaderSource = Headers | Record<string, string | string[] | undefined> | null | undefined;

// IP del cliente tal como la ve el servidor. Vercel (y la mayoría de
// proxies/CDNs) rellenan x-forwarded-for con la IP real del visitante
// primero en la lista, seguida de las IPs de los saltos intermedios.
export function getClientIp(req: { headers: HeaderSource }): string {
  const headers = req.headers;
  const get = (name: string): string | null => {
    if (!headers) return null;
    if (headers instanceof Headers) return headers.get(name);
    const value = (headers as Record<string, string | string[] | undefined>)[name];
    return Array.isArray(value) ? value[0] ?? null : value ?? null;
  };
  const forwarded = get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = get("x-real-ip");
  if (real) return real;
  return "unknown";
}

// Respuesta 429 lista para devolver desde una API route cuando
// checkRateLimit dice que no toca todavía.
export function rateLimitResponse(result: RateLimitResult, message = "Demasiados intentos. Prueba de nuevo en unos minutos.") {
  return new Response(JSON.stringify({ error: message }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(result.retryAfterSeconds),
    },
  });
}
