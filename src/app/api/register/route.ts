import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { name, email, password } = await req.json();

  const trimmedName = typeof name === "string" ? name.trim() : "";

  if (!trimmedName || !email || !password || password.length < 8) {
    return NextResponse.json(
      { error: "Nickname, email y contraseña (mín. 8 caracteres) son obligatorios." },
      { status: 400 }
    );
  }
  if (trimmedName.length > 40) {
    return NextResponse.json(
      { error: "El nickname es demasiado largo (máx. 40 caracteres)." },
      { status: 400 }
    );
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const existingEmail = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existingEmail) {
    return NextResponse.json({ error: "Ya existe una cuenta con ese email." }, { status: 409 });
  }

  // El nickname es único (se muestra en todos los rankings): comprobamos
  // antes de crear para dar un error claro, y además dejamos el @unique de
  // la base de datos como red de seguridad ante una carrera entre dos
  // registros simultáneos con el mismo nickname.
  const existingName = await prisma.user.findUnique({ where: { name: trimmedName } });
  if (existingName) {
    return NextResponse.json(
      { error: "Ese nickname ya está en uso, elige otro." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const user = await prisma.user.create({
      data: { name: trimmedName, email: normalizedEmail, passwordHash },
    });
    return NextResponse.json({ id: user.id, name: user.name, email: user.email });
  } catch (err: any) {
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "Ese nickname o email ya está en uso." },
        { status: 409 }
      );
    }
    throw err;
  }
}
