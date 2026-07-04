// Finance-aggregaties voor het office-dashboard (/beheer/finance).
// Pure functies: ze krijgen de al geladen collecties (klanten, abonnementen,
// facturen, kosten) als parameters en rekenen daarop; geen Firestore-calls
// hier, zodat alles triviaal testbaar is en de pagina zelf het laden regelt.
//
// Geld-regels:
//  - Alle bedragen in HELE DOLLARCENTEN (integer), zie facturen-types.ts.
//  - Omzet = `subtotaalCentExcl` van de factuur. ABB is GEEN omzet: die wordt
//    geind bovenop het subtotaal en afgedragen aan de belastingdienst (BES).
import type { Abonnement, Frequentie, Klant, KlantType } from "./types";
import {
  effectieveStatus,
  type Cent,
  type Factuur,
  type FactuurStatus,
} from "./facturen-types";
import type { KostenCategorie, KostenPost } from "./kosten";

/** "yyyy-mm" van vandaag (lokale tijd van de browser). */
export function huidigeMaand(nu: Date = new Date()): string {
  return `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Reeks van `aantal` maanden ("yyyy-mm"), oplopend, eindigend op `eindMaand`.
 * Bv. maandenReeks("2026-07", 3) -> ["2026-05", "2026-06", "2026-07"].
 */
export function maandenReeks(eindMaand: string, aantal: number): string[] {
  const m = eindMaand.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!m || aantal < 1) return [];
  let jaar = Number(m[1]);
  let maand = Number(m[2]);
  const reeks: string[] = [];
  for (let i = 0; i < aantal; i++) {
    reeks.unshift(`${jaar}-${String(maand).padStart(2, "0")}`);
    maand--;
    if (maand === 0) {
      maand = 12;
      jaar--;
    }
  }
  return reeks;
}

/** Kort maandlabel voor as-labels, bv. "2026-07" -> "jul". */
export function kortMaandLabel(maand: string): string {
  const KORT = [
    "jan", "feb", "mrt", "apr", "mei", "jun",
    "jul", "aug", "sep", "okt", "nov", "dec",
  ];
  const m = maand.match(/^\d{4}-(0[1-9]|1[0-2])$/);
  return m ? KORT[Number(m[1]) - 1] : maand;
}

const alleenActief = (abos: Abonnement[]) =>
  abos.filter((a) => a.status === "actief");

/** MRR in centen: som van prijsPerMaand (hele dollars) van actieve abonnementen. */
export function berekenMrrCent(abonnementen: Abonnement[]): Cent {
  return alleenActief(abonnementen).reduce(
    (som, a) => som + Math.round(a.prijsPerMaand * 100),
    0
  );
}

/** Aantal actieve abonnementen. */
export function telActieveAbonnees(abonnementen: Abonnement[]): number {
  return alleenActief(abonnementen).length;
}

/** ARPU in centen: MRR gedeeld door aantal actieve abonnees (0 zonder abonnees). */
export function berekenArpuCent(abonnementen: Abonnement[]): Cent {
  const n = telActieveAbonnees(abonnementen);
  return n === 0 ? 0 : Math.round(berekenMrrCent(abonnementen) / n);
}

/** Omzet/betaal/kosten-cijfers van 1 maand, alles in centen. */
export interface MaandCijfers {
  maand: string;
  /** Gefactureerde omzet excl ABB (som subtotaalCentExcl). */
  omzetCent: Cent;
  /** Deel daarvan met status "betaald". */
  betaaldCent: Cent;
  /** Nog openstaand: verstuurd of te laat (concept telt ook als nog te innen). */
  openstaandCent: Cent;
  /** Af te dragen ABB (som abbCent van alle facturen van de maand). */
  abbCent: Cent;
  /** Ingevoerde kosten van de maand. */
  kostenCent: Cent;
  /** Winst = omzet excl ABB - kosten. Kan negatief zijn. */
  winstCent: Cent;
}

/**
 * Per maand uit `maanden`: gefactureerde omzet (excl ABB), betaald vs
 * openstaand, af te dragen ABB, kosten en winst. Facturen/kosten buiten de
 * opgegeven maanden tellen niet mee.
 */
export function berekenMaandCijfers(
  maanden: string[],
  facturen: Factuur[],
  kosten: KostenPost[]
): MaandCijfers[] {
  const perMaand = new Map<string, MaandCijfers>(
    maanden.map((m) => [
      m,
      {
        maand: m,
        omzetCent: 0,
        betaaldCent: 0,
        openstaandCent: 0,
        abbCent: 0,
        kostenCent: 0,
        winstCent: 0,
      },
    ])
  );
  for (const f of facturen) {
    const rij = perMaand.get(f.periode);
    if (!rij) continue;
    rij.omzetCent += f.subtotaalCentExcl;
    rij.abbCent += f.abbCent;
    if (f.status === "betaald") rij.betaaldCent += f.subtotaalCentExcl;
    else rij.openstaandCent += f.subtotaalCentExcl;
  }
  for (const k of kosten) {
    const rij = perMaand.get(k.maand);
    if (rij) rij.kostenCent += k.bedragCent;
  }
  for (const rij of perMaand.values()) {
    rij.winstCent = rij.omzetCent - rij.kostenCent;
  }
  return maanden.map((m) => perMaand.get(m)!);
}

/** Totalen over een set maandcijfers (voor de KPI-tegels). */
export function somMaandCijfers(rijen: MaandCijfers[]): Omit<MaandCijfers, "maand"> {
  const som = {
    omzetCent: 0,
    betaaldCent: 0,
    openstaandCent: 0,
    abbCent: 0,
    kostenCent: 0,
    winstCent: 0,
  };
  for (const r of rijen) {
    som.omzetCent += r.omzetCent;
    som.betaaldCent += r.betaaldCent;
    som.openstaandCent += r.openstaandCent;
    som.abbCent += r.abbCent;
    som.kostenCent += r.kostenCent;
    som.winstCent += r.winstCent;
  }
  return som;
}

/** Omzet (excl ABB) per klanttype, over de meegegeven facturen. */
export function omzetPerKlanttype(
  facturen: Factuur[],
  klanten: Klant[]
): Record<KlantType, Cent> {
  const typeByKlant = new Map(klanten.map((k) => [k.id, k.type]));
  const uit: Record<KlantType, Cent> = { huishouden: 0, bedrijf: 0 };
  for (const f of facturen) {
    // Klant intussen verwijderd: als huishouden tellen (verreweg de grootste
    // groep); de factuur zelf bewaart geen klanttype-snapshot.
    const type = typeByKlant.get(f.klantId) ?? "huishouden";
    uit[type] += f.subtotaalCentExcl;
  }
  return uit;
}

/** Omzet (excl ABB) per buurt, aflopend gesorteerd, maximaal `top` buurten. */
export function omzetPerBuurt(
  facturen: Factuur[],
  top: number = 8
): { buurt: string; omzetCent: Cent }[] {
  const perBuurt = new Map<string, Cent>();
  for (const f of facturen) {
    const buurt = f.buurt || "?";
    perBuurt.set(buurt, (perBuurt.get(buurt) ?? 0) + f.subtotaalCentExcl);
  }
  return Array.from(perBuurt, ([buurt, omzetCent]) => ({ buurt, omzetCent }))
    .sort((a, b) => b.omzetCent - a.omzetCent)
    .slice(0, top);
}

/**
 * Verdeling van facturen over statussen (met bedrag incl ABB, want dat is
 * wat er daadwerkelijk geind moet worden). Gebruikt effectieveStatus, dus
 * een verstuurde factuur voorbij de vervaldatum telt als "teLaat".
 */
export function statusVerdeling(
  facturen: Factuur[]
): { status: FactuurStatus; aantal: number; bedragCent: Cent }[] {
  const volgorde: FactuurStatus[] = ["betaald", "verstuurd", "teLaat", "concept"];
  const per = new Map<FactuurStatus, { aantal: number; bedragCent: Cent }>(
    volgorde.map((s) => [s, { aantal: 0, bedragCent: 0 }])
  );
  for (const f of facturen) {
    const rij = per.get(effectieveStatus(f))!;
    rij.aantal++;
    rij.bedragCent += f.totaalCentIncl;
  }
  return volgorde.map((status) => ({ status, ...per.get(status)! }));
}

/** Aantal actieve abonnementen per frequentie (1x / 2x / 4x per maand). */
export function abonnementenPerFrequentie(
  abonnementen: Abonnement[]
): { frequentie: Frequentie; aantal: number }[] {
  const freqs: Frequentie[] = [1, 2, 4];
  return freqs.map((frequentie) => ({
    frequentie,
    aantal: alleenActief(abonnementen).filter((a) => a.frequentie === frequentie)
      .length,
  }));
}

/**
 * Abonnees-ontwikkeling: per maand het aantal abonnementen dat toen (al)
 * liep. Benadering: een abonnement telt mee vanaf zijn startmaand; van
 * gestopte abonnementen is geen stopdatum bekend, dus die tellen alleen niet
 * mee (in plaats van tot hun echte stopmaand). Zodra er een stopdatum-veld
 * komt, kan dit exact.
 */
export function abonneesPerMaand(
  abonnementen: Abonnement[],
  maanden: string[]
): { maand: string; aantal: number }[] {
  const lopend = abonnementen.filter((a) => a.status !== "gestopt");
  return maanden.map((maand) => ({
    maand,
    aantal: lopend.filter((a) => (a.startdatum ?? "").slice(0, 7) <= maand)
      .length,
  }));
}

/** Kosten per categorie over de meegegeven kostenposten (voor de kosten-pagina). */
export function kostenPerCategorie(
  kosten: KostenPost[]
): Record<KostenCategorie, Cent> {
  const uit: Record<KostenCategorie, Cent> = {
    water: 0,
    materiaal: 0,
    personeel: 0,
    brandstof: 0,
    overig: 0,
  };
  for (const k of kosten) uit[k.categorie] += k.bedragCent;
  return uit;
}
