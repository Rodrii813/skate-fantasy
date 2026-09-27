import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXTAUTH_URL || "https://rollartfantasy.com";

// Sitemap con las páginas públicas estables. Las páginas que dependen de
// sesión (fantasy, predictions, admin...) o de un id concreto (evento,
// liga...) no aportan como URL indexable genérica, así que se dejan fuera.
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    { path: "/", priority: 1, changeFrequency: "daily" as const },
    { path: "/competitions", priority: 0.8, changeFrequency: "daily" as const },
    { path: "/calendario", priority: 0.8, changeFrequency: "daily" as const },
    { path: "/fantasy", priority: 0.7, changeFrequency: "weekly" as const },
    { path: "/predictions", priority: 0.7, changeFrequency: "weekly" as const },
    { path: "/fantasy/normas", priority: 0.5, changeFrequency: "monthly" as const },
    { path: "/login", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/register", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/privacidad", priority: 0.2, changeFrequency: "yearly" as const },
    { path: "/terminos", priority: 0.2, changeFrequency: "yearly" as const },
    { path: "/contacto", priority: 0.2, changeFrequency: "yearly" as const },
  ];

  return routes.map((route) => ({
    url: `${BASE_URL}${route.path}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
