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
 * Het hoeveelste voorkomen van deze weekdag binnen de maand valt op deze datum?
 * 1 t/m 5. (Dag 1-7 = 1e keer, 8-14 = 2e, ... 29-31 = 5e keer.)
 */
export function weekdagVoorkomenInMaand(datum: Date): number {
  return Math.floor((datum.getDate() - 1) / 7) + 1;
}

/**
 * Is dit abonnement vandaag aan de beurt?
 * - alleen actieve abonnementen met een vasteDag gelijk aan vandaag;
 * - de frequentie bepaalt op welke voorkomens van die vaste weekdag we komen:
 *   frequentie 1 = alleen het 1e voorkomen van de maand,
 *   frequentie 2 = het 1e en 3e voorkomen,
 *   frequentie 4 = het 1e t/m 4e voorkomen.
 * We houden strikt aan 4x per maand: in een maand met 5 van die weekdag slaan
 * we het 5e voorkomen over (dus 4x per maand is bewust NIET hetzelfde als
 * wekelijks). De inplanning is puur op de kalender, niet op laatsteReiniging.
 */
export function isVandaagDue(abonnement: Abonnement, vandaag: Date): boolean {
  if (abonnement.status !== "actief") return false;
  if (!abonnement.vasteDag) return false;
  if (abonnement.vasteDag !== weekdagVanDatum(vandaag)) return false;
  const voorkomen = weekdagVoorkomenInMaand(vandaag);
  if (abonnement.frequentie === 1) return voorkomen === 1;
  if (abonnement.frequentie === 2) return voorkomen === 1 || voorkomen === 3;
  // frequentie 4: eerste vier voorkomens; het 5e slaan we over.
  return voorkomen <= 4;
}
