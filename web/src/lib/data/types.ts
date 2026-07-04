// Domein-types Kliko Cleaning Bonaire - Fase 1.
// Alle bedragen in US dollars (USD).

export type KlantType = "huishouden" | "bedrijf";

/** Aantal schoonmaakbeurten per maand. 4 = wekelijks. */
export type Frequentie = 1 | 2 | 4;

export type AbonnementStatus = "actief" | "pauze" | "gestopt";

/** Vaste schoonmaakdag: 1 = maandag .. 6 = zaterdag (zondag wordt niet gereden). */
export type Weekdag = 1 | 2 | 3 | 4 | 5 | 6;

export type ReinigingStatus = "gedaan" | "overgeslagen";

export interface Klant {
  id: string;
  naam: string;
  email: string;
  /** Telefoon / WhatsApp-nummer. */
  telefoon: string;
  adres: string;
  wijk: string;
  aantalKlikos: number;
  type: KlantType;
  /** ISO-datum/tijd string (Firestore serverdata via new Date().toISOString()). */
  aangemaaktOp: string;
  notitie?: string;
}

export interface Abonnement {
  id: string;
  klantId: string;
  type: KlantType;
  frequentie: Frequentie;
  /** Prijs per maand in USD. */
  prijsPerMaand: number;
  status: AbonnementStatus;
  /** ISO-datum string (yyyy-mm-dd). */
  startdatum: string;
  /**
   * Vaste schoonmaakdag (1 = maandag .. 6 = zaterdag).
   * Optioneel/null zolang de klant nog niet is ingepland; bestaande docs
   * zonder dit veld blijven gewoon werken.
   */
  vasteDag?: Weekdag | null;
  /** ISO-datum (yyyy-mm-dd) van de laatst uitgevoerde reiniging. Optioneel. */
  laatsteReiniging?: string | null;
}

/**
 * Een uitgevoerde of overgeslagen schoonmaakbeurt (collectie `reinigingen`).
 * Klantgegevens worden gedenormaliseerd meegeschreven zodat de historie
 * leesbaar blijft, ook als de klant later wijzigt.
 */
export interface Reiniging {
  id: string;
  klantId: string;
  abonnementId: string;
  klantNaam: string;
  adres: string;
  wijk: string;
  /** ISO-datum (yyyy-mm-dd) waarop de beurt gepland/uitgevoerd is. */
  datum: string;
  status: ReinigingStatus;
  /** Download-URL van de bewijsfoto in Firebase Storage. */
  fotoUrl?: string;
  /** ISO-timestamp van het moment van afvinken. */
  uitgevoerdOp: string;
  uitgevoerdDoorUid: string;
  uitgevoerdDoorNaam: string;
  /** Alleen bij status "overgeslagen". */
  redenOverslaan?: string;
  /** Vrije notitie, bv. "foto-upload niet gelukt". */
  notitie?: string;
}
