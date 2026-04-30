"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // No registrar visitas del panel admin
    if (pathname.startsWith("/admin")) return;

    // Registrar una sola visita por sesión de navegación (por pestaña)
    const sessionKey = "motaxi_pv_" + new Date().toISOString().slice(0, 10);
    if (sessionStorage.getItem(sessionKey)) return;
    sessionStorage.setItem(sessionKey, "1");

    fetch("/api/page-views", { method: "POST" }).catch(() => {});
  }, []);

  return null;
}
