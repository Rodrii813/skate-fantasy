import type { MetadataRoute } from "next";

// Manifest de la PWA: permite instalar la web en la pantalla de inicio
// (Android/iPhone) y abrirla a pantalla completa como una app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rollart Fantasy — World Skate Games",
    short_name: "Rollart Fantasy",
    description: "Elige a tus patinadores para cada elemento y compite en el ranking global.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#020617",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
