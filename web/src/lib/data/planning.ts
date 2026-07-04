// Planning-logica: capaciteit per dag + wanneer een abonnement "due" is.
// Puur (geen Firebase-imports), dus makkelijk te testen en overal bruikbaar.
import type { Abonnement, Weekdag } from "./types";

/**
 * Maximaal aantal kliko's dat het team op 1 dag kan reinigen.
 * Config-constante: pas dit getal aan als de capaciteit verandert.
 */
export const CONTAINERS_PER_DAG = 60;

/** Werkdagen voor de planning: maandag (1) t/m zaterdag (6). */
export const WERKDAGEN: Weekdag[] = [1, 2, 3, 4, 5, 6];

/**
 * Weekdag van een datum in ons schema: 1 = maandag .. 6 = zaterdag, 0 = zondag.
 * (JS Date.getDay() gebruikt toevallig hetzelfde nummer voor ma..za.)
 */
export function weekdagVanDatum(datum: Date): number {
  return datum.getDay();
}

/** Lokale datum als ISO-string yyyy-mm-dd (apparaat-tijdzone, dus Bonaire-tijd op locatie). */
export function isoDatum(datum: Date): string {
  const j = datum.getFullYear();
  const m = String(datum.getMonth() + 1).padStart(2, "0");
  const d = String(datum.getDate()).padStart(2, "0");
  return `${j}-${m}-${d}`;
}

/** Aantal hele dagen tussen twee ISO-datums (yyyy-mm-dd). Positief als `tot` later is. */
export function dagenTussen(vanIso: string, totIso: string): number {
  const van = new Date(`${vanIso}T00:00:00`);
  const tot = new Date(`${totIso}T00:00:00`);
  return Math.round((tot.getTime() - van.getTime()) / 86_400_000);
}

/**
 * Is dit abonnement vandaag aan de beurt?
 * - alleen actieve abonnementen met een vasteDag gelijk aan vandaag;
 * - en op basis van de frequentie genoeg dagen sinds laatsteReiniging:
 *   frequentie 4 = wekelijks (>= 6 dagen, zodat dezelfde weekdag elke week matcht),
 *   frequentie 2 = om de ~2 weken (>= 13 dagen),
 *   frequentie 1 = maandelijks (>= 27 dagen).
 * - geen laatsteReiniging = nog nooit gereinigd = due.
 */
export function isVandaagDue(abonnement: Abonnement, vandaag: Date): boolean {
  if (abonnement.status !== "actief") return false;
  if (!abonnement.vasteDag) return false;
  if (abonnement.vasteDag !== weekdagVanDatum(vandaag)) return false;
  if (!abonnement.laatsteReiniging) return true;
  const dagen = dagenTussen(abonnement.laatsteReiniging, isoDatum(vandaag));
  const minimaal =
    abonnement.frequentie === 4 ? 6 : abonnement.frequentie === 2 ? 13 : 27;
  return dagen >= minimaal;
}
