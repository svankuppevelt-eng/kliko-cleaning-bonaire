"use client";

// Hook voor de publieke landingspagina: teksten met office-overrides.
// Laadt `siteContent/landing` eenmalig en geeft tt(key) terug: de
// office-tekst voor de huidige taal als die bestaat en niet leeg is,
// anders de i18n-standaard t(key). Zolang het doc laadt of Firestore
// onbereikbaar is geldt altijd t(key), dus nooit een lege of
// flikkerende pagina.
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  getLandingContent,
  type LandingOverrides,
} from "@/lib/data/site-content";

export function useLandingText(): {
  /** Office-override voor de huidige taal, met t(key) als vangnet. */
  tt: (key: string) => string;
  /** De gewone i18n-vertaler, voor niet-bewerkbare teksten. */
  t: (key: string) => string;
} {
  const { t, lang } = useI18n();
  const [overrides, setOverrides] = useState<LandingOverrides>({});

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    let actief = true;
    // getLandingContent vangt fouten zelf af en geeft dan {} terug.
    getLandingContent().then((map) => {
      if (actief) setOverrides(map);
    });
    return () => {
      actief = false;
    };
  }, []);

  const tt = (key: string) => {
    const eigen = overrides[key]?.[lang];
    return eigen && eigen.trim() !== "" ? eigen : t(key);
  };

  return { tt, t };
}
