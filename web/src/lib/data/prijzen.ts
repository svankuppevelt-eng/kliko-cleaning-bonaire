// Prijstabel Kliko Cleaning Bonaire - echte tarieven in USD (hele dollars).
// Per klanttype x frequentie een maandprijs en een jaarprijs (12 maanden in
// 1 betaling, met korting). LET OP: deze tier-prijzen zijn PER CONTAINER;
// de totaalprijs van een abonnement (alle containers van de klant samen, met
// container-korting) reken je met totaalMaandPrijs / totaalJaarPrijs onderaan.
// Makkelijk aanpasbaar: pas alleen deze tabel aan, de rest van de app leest
// hem. Office kan de waarden overschrijven via /beheer/instellingen
// (Firestore-doc instellingen/algemeen).
import type { Frequentie, KlantType } from "./types";

/** Prijs voor 1 tier: per maand en per jaar (12 maanden vooruit, met korting). */
export interface TierPrijs {
  maand: number;
  jaar: number;
}

/**
 * De echte tarieven (standaardwaarden). "Maand x 12" is puur informatief en
 * wordt nergens opgeslagen; de jaarprijs hieronder is de kortingsprijs.
 */
export const STANDAARD_PRIJZEN: Record<
  KlantType,
  Record<Frequentie, TierPrijs>
> = {
  huishouden: {
    1: { maand: 20, jaar: 200 },
    2: { maand: 35, jaar: 350 },
    4: { maand: 40, jaar: 400 },
  },
  bedrijf: {
    1: { maand: 50, jaar: 500 },
    2: { maand: 90, jaar: 900 },
    4: { maand: 120, jaar: 1200 },
  },
};

/** Alleen de maandprijzen (backwards compatible vorm, o.a. voor scenario's). */
export const PRIJS_PER_MAAND: Record<KlantType, Record<Frequentie, number>> = {
  huishouden: {
    1: STANDAARD_PRIJZEN.huishouden[1].maand,
    2: STANDAARD_PRIJZEN.huishouden[2].maand,
    4: STANDAARD_PRIJZEN.huishouden[4].maand,
  },
  bedrijf: {
    1: STANDAARD_PRIJZEN.bedrijf[1].maand,
    2: STANDAARD_PRIJZEN.bedrijf[2].maand,
    4: STANDAARD_PRIJZEN.bedrijf[4].maand,
  },
};

export const FREQUENTIES: Frequentie[] = [1, 2, 4];
export const KLANT_TYPES: KlantType[] = ["huishouden", "bedrijf"];

/** Standaard MAANDprijs voor een tier (bestaand gedrag, ongewijzigd). */
export function prijsVoor(type: KlantType, frequentie: Frequentie): number {
  return STANDAARD_PRIJZEN[type][frequentie].maand;
}

/** Standaard JAARprijs voor een tier (12 maanden vooruit, met korting). */
export function jaarPrijsVoor(type: KlantType, frequentie: Frequentie): number {
  return STANDAARD_PRIJZEN[type][frequentie].jaar;
}

// ── Container-korting ────────────────────────────────────────────────────────
// Instelbare korting bij meerdere containers: een lijst drempels, bv.
// [{ vanafAantal: 2, kortingPct: 10 }, { vanafAantal: 4, kortingPct: 15 }].
// Standaard leeg = geen korting. Office beheert de lijst via /beheer/instellingen.

export interface ContainerKortingRegel {
  /** Vanaf dit aantal containers geldt de korting (2 of hoger). */
  vanafAantal: number;
  /** Korting in procenten (0-100). */
  kortingPct: number;
}

/** Standaard: geen container-korting. */
export const STANDAARD_CONTAINER_KORTING: ContainerKortingRegel[] = [];

/**
 * Hoogste toepasselijke kortingspercentage voor een aantal containers.
 * Geen regel van toepassing (of aantal <= 1) -> 0.
 */
export function kortingPctVoorAantal(
  regels: ContainerKortingRegel[],
  aantal: number
): number {
  let pct = 0;
  for (const regel of regels) {
    if (aantal >= regel.vanafAantal && regel.kortingPct > pct) {
      pct = regel.kortingPct;
    }
  }
  return pct;
}

/**
 * Pas de container-korting toe op een maandprijs PER CONTAINER. Geeft de
 * prijs afgerond op hele centen terug; zonder toepasselijke regel gewoon de
 * basisprijs. LET OP: dit vermenigvuldigt NIET met het aantal containers.
 * Voor de totaalprijs van een abonnement (alle containers samen) gebruik je
 * totaalMaandPrijs / totaalJaarPrijs hieronder; dit blijft alleen bestaan
 * voor backwards-compat.
 */
export function prijsMetKorting(
  basisMaandPrijs: number,
  aantalContainers: number,
  regels: ContainerKortingRegel[]
): number {
  const pct = kortingPctVoorAantal(regels, aantalContainers);
  if (pct <= 0) return basisMaandPrijs;
  return Math.round(basisMaandPrijs * (100 - pct)) / 100;
}

// ── Totaalprijs per abonnement (canoniek pad) ────────────────────────────────
// Alle containers van een klant zitten op 1 abonnement: 1 type + 1 frequentie
// + een aantal containers (`aantalKlikos` op de klant). De tier-prijs
// { maand, jaar } bovenaan dit bestand is PER CONTAINER; `prijsPerMaand` op
// een abonnement is het TOTAAL voor alle containers samen, met de
// container-korting er al in verrekend. Nieuwe code rekent daarom via deze
// totaal-helpers; facturen en finance lezen gewoon het opgeslagen
// `prijsPerMaand` (bestaande abonnementen blijven ongewijzigd).

/** Rond een dollarbedrag af op hele centen. */
function rondOpCenten(bedrag: number): number {
  return Math.round(bedrag * 100) / 100;
}

/** Prijstabel-vorm zoals in de office-instellingen. */
export type PrijsTabel = Record<KlantType, Record<Frequentie, TierPrijs>>;

/**
 * TOTALE maandprijs voor een abonnement met `aantalContainers` containers:
 * aantal x maandprijs-per-container, min de container-korting, afgerond op
 * hele centen. Zonder expliciete tabel/regels gelden de standaardwaarden;
 * geef de office-instellingen mee (`instellingen.prijzen` +
 * `instellingen.containerKorting`) voor de actuele tarieven.
 */
export function totaalMaandPrijs(
  type: KlantType,
  frequentie: Frequentie,
  aantalContainers: number,
  prijzen: PrijsTabel = STANDAARD_PRIJZEN,
  korting: ContainerKortingRegel[] = STANDAARD_CONTAINER_KORTING
): number {
  const aantal = Math.max(1, Math.floor(aantalContainers) || 1);
  const basis = (prijzen[type]?.[frequentie] ?? STANDAARD_PRIJZEN[type][frequentie])
    .maand;
  const pct = kortingPctVoorAantal(korting, aantal);
  return rondOpCenten((aantal * basis * (100 - pct)) / 100);
}

/**
 * TOTALE jaarprijs (12 maanden in 1 betaling) voor een abonnement met
 * `aantalContainers` containers, met dezelfde container-korting als de
 * maandprijs. Zelfde regels als totaalMaandPrijs.
 */
export function totaalJaarPrijs(
  type: KlantType,
  frequentie: Frequentie,
  aantalContainers: number,
  prijzen: PrijsTabel = STANDAARD_PRIJZEN,
  korting: ContainerKortingRegel[] = STANDAARD_CONTAINER_KORTING
): number {
  const aantal = Math.max(1, Math.floor(aantalContainers) || 1);
  const basis = (prijzen[type]?.[frequentie] ?? STANDAARD_PRIJZEN[type][frequentie])
    .jaar;
  const pct = kortingPctVoorAantal(korting, aantal);
  return rondOpCenten((aantal * basis * (100 - pct)) / 100);
}

/** Formatteer een USD-bedrag, bv. 10 -> "$10" en 12.5 -> "$12.50". */
export function formatUsd(bedrag: number): string {
  return Number.isInteger(bedrag) ? `$${bedrag}` : `$${bedrag.toFixed(2)}`;
}
