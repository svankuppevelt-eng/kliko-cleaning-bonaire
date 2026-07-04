// Domein-types Kliko Cleaning Bonaire - Fase 1.
// Alle bedragen in US dollars (USD).

export type KlantType = "huishouden" | "bedrijf";

/** Aantal schoonmaakbeurten per maand. 4 = wekelijks. */
export type Frequentie = 1 | 2 | 4;

export type AbonnementStatus = "actief" | "pauze" | "gestopt";

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
}
