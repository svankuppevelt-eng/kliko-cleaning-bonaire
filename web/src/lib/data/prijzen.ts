// Prijstabel Kliko Cleaning Bonaire - echte tarieven in USD (hele dollars).
// Per klanttype x frequentie een maandprijs en een jaarprijs (12 maanden in
// 1 betaling, met korting). Makkelijk aanpasbaar: pas alleen deze tabel aan,
// de rest van de app leest hem. Office kan de waarden overschrijven via
// /beheer/instellingen (Firestore-doc instellingen/algemeen).
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
 * Pas de container-korting toe op een maandprijs. Geeft de prijs afgerond
 * op hele centen terug; zonder toepasselijke regel gewoon de basisprijs.
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

/** Formatteer een USD-bedrag, bv. 10 -> "$10" en 12.5 -> "$12.50". */
export function formatUsd(bedrag: number): string {
  return Number.isInteger(bedrag) ? `$${bedrag}` : `$${bedrag.toFixed(2)}`;
}
