// Prijstabel Kliko Cleaning Bonaire - voorbeeldprijzen in USD per maand.
// Makkelijk aanpasbaar: pas alleen deze tabel aan, de rest van de app leest hem.
import type { Frequentie, KlantType } from "./types";

export const PRIJS_PER_MAAND: Record<KlantType, Record<Frequentie, number>> = {
  huishouden: { 1: 10, 2: 18, 4: 22 },
  bedrijf: { 1: 18, 2: 30, 4: 36 },
};

export const FREQUENTIES: Frequentie[] = [1, 2, 4];

export function prijsVoor(type: KlantType, frequentie: Frequentie): number {
  return PRIJS_PER_MAAND[type][frequentie];
}

/** Formatteer een USD-bedrag, bv. 10 -> "$10". */
export function formatUsd(bedrag: number): string {
  return `$${bedrag}`;
}
