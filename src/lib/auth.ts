import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { checkRateLimit } from "./rateLimit";

// Intentos de login permitidos por cuenta antes de frenar — cuenta TODOS los
// intentos (acierten o no), no solo los fallidos, para que no haga falta
// esperar a que alguien falle mucho para activarse. 8 en 15 minutos deja
// margen de sobra a quien simplemente se equivoca de contraseña una o dos
// veces, pero corta un script de fuerza bruta bastante rápido.
const LOGIN_ATTEMPT_LIMIT = 8;
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credenciales",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const normalizedEmail = credentials.email.toLowerCase().trim();

        // Igual que con EMAIL_NOT_VERIFIED más abajo: lanzar el error (en vez
        // de "return null") es lo que permite que el mensaje concreto
        // "RATE_LIMITED" llegue tal cual al cliente en signIn(...).error,
        // para mostrar "espera unos minutos" en vez del genérico
        // "credenciales incorrectas".
        const limit = checkRateLimit(`login:${normalizedEmail}`, LOGIN_ATTEMPT_LIMIT, LOGIN_ATTEMPT_WINDOW_MS);
        if (!limit.allowed) {
          throw new Error("RATE_LIMITED");
        }

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });
        if (!user) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        // Bloquea el login hasta que confirme el email (ver
        // EmailVerificationToken en el schema y /api/auth/verify-email).
        // Lanzar el error (en vez de "return null") es lo que permite que el
        // mensaje concreto "EMAIL_NOT_VERIFIED" llegue tal cual al cliente
        // en signIn(...).error, para poder mostrar un botón de "reenviar
        // email" en vez del genérico "credenciales incorrectas".
        if (!user.emailVerified) {
          throw new Error("EMAIL_NOT_VERIFIED");
        }

        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
};
