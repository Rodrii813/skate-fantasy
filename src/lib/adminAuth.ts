import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Comprobación de admin compartida por TODAS las rutas de /api/admin/**.
// Antes cada route.ts repetía (o, en varios casos, se olvidaba de repetir)
// el mismo par de comprobaciones: 1) hay sesión, 2) el usuario de esa sesión
// tiene role === "ADMIN" en la base de datos (nunca fiarse de session.user
// a secas: el JWT lo rellena auth.ts, pero comprobarlo aquí contra la BD es
// la fuente de verdad). Tenerlo en un solo sitio evita que una ruta nueva
// se cree copiando otra que ya se le había olvidado el paso 2 — que es
// justo como habían quedado admin/competitions y la de registrations.
export async function requireAdmin(): Promise<
  | { ok: true; user: { id: string; email: string; role: string } }
  | { ok: false; response: NextResponse }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { ok: false, response: NextResponse.json({ error: "No autorizado" }, { status: 401 }) };
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 }) };
  }
  if (user.role !== "ADMIN") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Acceso denegado: solo administradores" }, { status: 403 }),
    };
  }

  return { ok: true, user: { id: user.id, email: user.email, role: user.role } };
}
