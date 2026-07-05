"use client";

// Registreert de service worker (public/sw.js) voor de PWA-installatie.
// Alleen in productie-builds: in dev zou een SW verse HMR-updates kunnen
// maskeren. Faalt stil op browsers zonder serviceWorker-ondersteuning.
import { useEffect } from "react";

export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registratie mislukt (bv. geen HTTPS): de app blijft gewoon werken.
    });
  }, []);

  return null;
}
