"use client";

// Hook: office-instellingen (prijstabel + dagcapaciteit) uit Firestore, met
// de constanten als directe startwaarde. De UI rendert dus meteen met de
// defaults en wisselt naar de office-waarden zodra die binnen zijn.
import { useEffect, useState } from "react";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  DEFAULT_INSTELLINGEN,
  getInstellingen,
  type Instellingen,
} from "@/lib/data/instellingen";

export function useInstellingen(): {
  instellingen: Instellingen;
  geladen: boolean;
} {
  const [instellingen, setInstellingen] =
    useState<Instellingen>(DEFAULT_INSTELLINGEN);
  // Zonder Firebase-config blijven de defaults gelden: meteen "geladen"
  // (lazy initializer, dus geen setState in de effect-body nodig).
  const [geladen, setGeladen] = useState(() => !isFirebaseConfigured());

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    let actief = true;
    getInstellingen().then((inst) => {
      // getInstellingen vangt fouten zelf af en geeft dan de defaults terug.
      if (!actief) return;
      setInstellingen(inst);
      setGeladen(true);
    });
    return () => {
      actief = false;
    };
  }, []);

  return { instellingen, geladen };
}
