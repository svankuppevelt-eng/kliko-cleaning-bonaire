// Office-bewerkbare teksten van de publieke landingspagina, in Firestore-doc
// `siteContent/landing`. Per bewerkbare i18n-key staan daar de drie talen:
// { "hero.title": { pap: "...", nl: "...", en: "..." }, ... }
// Alleen ingevulde overrides worden opgeslagen; ontbrekende keys of talen
// vallen op de landingspagina terug op de i18n-standaardteksten.
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getDb, isFirebaseConfigured } from "@/lib/firebase";
import type { Lang } from "@/lib/i18n";

/** Per i18n-key de office-overrides per taal (alleen ingevulde talen). */
export type LandingOverrides = Record<string, Partial<Record<Lang, string>>>;

const TALEN: Lang[] = ["pap", "nl", "en"];

const LANDING_DOC = () => doc(getDb(), "siteContent", "landing");

/**
 * Lees de landingspagina-overrides. Bestaat het doc niet, is Firebase nog
 * niet geconfigureerd of gaat het lezen mis, dan komt er gewoon {} terug:
 * de pagina toont dan de i18n-standaardteksten (geen crash, geen lege pagina).
 */
export async function getLandingContent(): Promise<LandingOverrides> {
  if (!isFirebaseConfigured()) return {};
  try {
    const snap = await getDoc(LANDING_DOC());
    if (!snap.exists()) return {};
    const data = snap.data() as Record<string, unknown>;
    const overrides: LandingOverrides = {};
    for (const [key, waarde] of Object.entries(data)) {
      if (!waarde || typeof waarde !== "object") continue;
      const talen: Partial<Record<Lang, string>> = {};
      for (const lang of TALEN) {
        const tekst = (waarde as Record<string, unknown>)[lang];
        if (typeof tekst === "string" && tekst.trim() !== "") {
          talen[lang] = tekst;
        }
      }
      if (Object.keys(talen).length > 0) overrides[key] = talen;
    }
    return overrides;
  } catch {
    // Firestore onbereikbaar of rules blokkeren lezen: standaardteksten gelden.
    return {};
  }
}

/**
 * Schrijf de volledige set overrides weg (setDoc zonder merge: het doc wordt
 * vervangen). Zo verdwijnt een leeggemaakt veld echt uit het doc en valt de
 * landingspagina voor die key/taal weer terug op de standaardtekst.
 * De aanroeper geeft alleen ingevulde waarden mee (zie /beheer/website).
 */
export async function saveLandingContent(map: LandingOverrides): Promise<void> {
  await setDoc(LANDING_DOC(), map);
}
