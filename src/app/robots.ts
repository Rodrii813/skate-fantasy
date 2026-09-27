import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXTAUTH_URL || "https://rollartfantasy.com";

// robots.txt generado dinámicamente (en vez de un public/robots.txt estático)
// para que apunte siempre al dominio real de cada entorno (NEXTAUTH_URL),
// sin tener que mantener un archivo aparte. Se bloquea /admin y /api porque
// no aportan nada indexable y /admin no debería aparecer en buscadores.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api"],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
