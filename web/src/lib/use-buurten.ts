"use client";

// Hook: actieve buurten uit Firestore, voor dropdowns en filters.
// Bij fout of ontbrekende configuratie: lege lijst + geladen=true, zodat
// de UI terugvalt op een vrij tekstveld (geen crash, geen blokkade).
import { useEffect, useState } from "react";
import { isFirebaseConfigured } from "@/lib/firebase";
import { listActieveBuurten, type Buurt } from "@/lib/data/buurten";

export function useActieveBuurten(): { buurten: Buurt[]; geladen: boolean } {
  const [buurten, setBuurten] = useState<Buurt[]>([]);
  // Zonder Firebase-config is er niets te laden: meteen "geladen" (lazy
  // initializer, dus geen setState in de effect-body nodig).
  const [geladen, setGeladen] = useState(() => !isFirebaseConfigured());

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    let actief = true;
    listActieveBuurten()
      .then((b) => {
        if (!actief) return;
        setBuurten(b);
        setGeladen(true);
      })
      .catch(() => {
        if (!actief) return;
        setGeladen(true);
      });
    return () => {
      actief = false;
    };
  }, []);

  return { buurten, geladen };
}
