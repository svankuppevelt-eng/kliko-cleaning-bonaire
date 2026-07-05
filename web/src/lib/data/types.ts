// Domein-types Kliko Cleaning Bonaire - Fase 1.
// Alle bedragen in US dollars (USD).

export type KlantType = "huishouden" | "bedrijf";

/** Aantal schoonmaakbeurten per maand (1, 2 of 4). 4x per maand is bewust
 * niet hetzelfde als wekelijks: in maanden met 5 van de vaste weekdag blijft
 * het bij 4 beurten. */
export type Frequentie = 1 | 2 | 4;

export type AbonnementStatus = "actief" | "pauze" | "gestopt";

/** Vaste schoonmaakdag: 1 = maandag .. 6 = zaterdag (zondag wordt niet gereden). */
export type Weekdag = 1 | 2 | 3 | 4 | 5 | 6;

export type ReinigingStatus = "gedaan" | "overgeslagen";

/**
 * Taalvoorkeur van de klant voor mails (zelfde codes als de UI-talen).
 * Bewust hier gedefinieerd (en niet geimporteerd uit lib/i18n) zodat de
 * data-laag geen React-bestanden importeert.
 */
export type KlantTaal = "pap" | "nl" | "en";

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
  /**
   * Taalvoorkeur voor klant-mails (factuur, herinnering, ...).
   * Optioneel: bestaande docs zonder dit veld vallen terug op "nl".
   */
  taal?: KlantTaal;
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
 * Een fysieke kliko (container) van een klant (collectie `containers`).
 * Elke container krijgt een uniek klikonummer + QR-label op de bak, zodat
 * buurman-containers nooit verwisseld kunnen worden. De cleaner scant de QR
 * bij het wassen; `laatsteReiniging` is daarmee de waarheid per container.
 */
export interface Container {
  id: string;
  /** Uniek label-nummer op de bak, format "KLB-00001" (teller-doc `tellers/containers`). */
  klikonummer: string;
  klantId: string;
  /** Gedenormaliseerd zodat het label leesbaar blijft, ook als de klant wijzigt. */
  klantNaam: string;
  /** Volgnummer binnen de klant (kliko 1, 2, 3, ...). */
  volgnummer: number;
  /** False = label vervallen (bak weg/vervangen); scannen toont dan een melding. */
  actief: boolean;
  /** ISO-timestamp (new Date().toISOString()). */
  aangemaaktOp: string;
  /** ISO-datum (yyyy-mm-dd) van de laatst geregistreerde beurt van DEZE bak. */
  laatsteReiniging?: string;
}

/**
 * Een uitgevoerde of overgeslagen schoonmaakbeurt (collectie `reinigingen`).
 * Klantgegevens worden gedenormaliseerd meegeschreven zodat de historie
 * leesbaar blijft, ook als de klant later wijzigt.
 */
export interface Reiniging {
  id: string;
  klantId: string;
  /**
   * Leeg ("") bij een container-scan: daar is het abonnement niet relevant,
   * de beurt hangt aan de container zelf. Bestaat om backwards compatible
   * te blijven met de stop-flow die per abonnement afvinkt.
   */
  abonnementId: string;
  klantNaam: string;
  adres: string;
  wijk: string;
  /** ISO-datum (yyyy-mm-dd) waarop de beurt gepland/uitgevoerd is. */
  datum: string;
  status: ReinigingStatus;
  /** Gescande container (alleen bij container-niveau registratie via QR). */
  containerId?: string;
  /** Gedenormaliseerd klikonummer ("KLB-00001") voor leesbare historie. */
  klikonummer?: string;
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
