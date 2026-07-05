// React-PDF factuur-sjabloon + client-side download-helper.
//
// Volledig client-side: pdf(<FactuurTemplate/>).toBlob() in de browser,
// geen server-route of Admin SDK. Dit bestand wordt door de factuur-
// detailpagina DYNAMISCH geimporteerd (pas bij klik op "Download PDF"),
// zodat @react-pdf/renderer buiten de gewone pagina-bundle blijft.
//
// De PDF is bewust eentalig Nederlands: een factuur is een zakelijk document
// met 1 vaste taal (de office-UI eromheen is wel drietalig).
import * as React from "react";
import {
  Document,
  Image,
  Page,
  pdf,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { formatUsdCent, type Factuur } from "@/lib/data/facturen-types";
import { maandLabel } from "@/lib/data/facturen";

// Kliko-huisstijl (zelfde waarden als de Tailwind-tokens in globals.css).
const kleuren = {
  navy: "#0d2b6a",
  blue: "#0077cc",
  yellow: "#ffc20e",
  muted: "#6b7280",
  border: "#d8dce6",
  paidGreen: "#0d8a3e",
};

const PAGE_MARGIN = 54;
const COL_AANTAL = 46;
const COL_DESC = 260;
const COL_STUK = 90;
const COL_TOTAAL = 90;

const styles = StyleSheet.create({
  page: {
    paddingTop: PAGE_MARGIN,
    paddingBottom: PAGE_MARGIN,
    paddingHorizontal: PAGE_MARGIN,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: kleuren.navy,
    lineHeight: 1.35,
  },

  headerRow: { flexDirection: "row", alignItems: "flex-start" },
  headerLeft: { width: "45%", flexDirection: "column" },
  headerRight: { width: "55%", flexDirection: "column", alignItems: "flex-end" },
  logo: { width: 150, height: 66, objectFit: "contain" },
  issuerNaam: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: kleuren.navy,
    textAlign: "right",
  },
  issuerLegal: {
    fontSize: 8,
    color: kleuren.muted,
    marginBottom: 4,
    textAlign: "right",
  },
  issuerLine: { fontSize: 9, lineHeight: 1.4, textAlign: "right" },

  accentBalk: {
    marginTop: 14,
    height: 3,
    backgroundColor: kleuren.yellow,
    borderRadius: 2,
  },

  klantBlok: { marginTop: 18, flexDirection: "column" },
  klantBold: { fontSize: 10, fontFamily: "Helvetica-Bold", lineHeight: 1.4 },
  klantLine: { fontSize: 10, lineHeight: 1.4 },

  titelRow: { marginTop: 18, flexDirection: "row", alignItems: "flex-end" },
  titel: { fontSize: 16, fontFamily: "Helvetica-Bold", color: kleuren.navy },
  titelInfo: { flex: 1, flexDirection: "column", alignItems: "flex-end" },
  infoLine: { fontSize: 10, lineHeight: 1.4, textAlign: "right" },

  betreft: { marginTop: 10, fontSize: 10 },

  tabel: {
    marginTop: 12,
    flexDirection: "column",
    borderTopWidth: 0.5,
    borderLeftWidth: 0.5,
    borderTopColor: kleuren.border,
    borderLeftColor: kleuren.border,
  },
  rij: { flexDirection: "row" },
  cel: {
    borderBottomWidth: 0.5,
    borderRightWidth: 0.5,
    borderBottomColor: kleuren.border,
    borderRightColor: kleuren.border,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  celAantal: { width: COL_AANTAL },
  celDesc: { width: COL_DESC },
  celStuk: { width: COL_STUK },
  celTotaal: { width: COL_TOTAAL },
  kop: { fontSize: 9, color: kleuren.muted },
  kopRechts: { fontSize: 9, color: kleuren.muted, textAlign: "right" },
  celTekst: { fontSize: 10 },
  celTekstRechts: { fontSize: 10, textAlign: "right" },

  totalen: { marginTop: 8, flexDirection: "column" },
  totaalRij: { flexDirection: "row", paddingVertical: 1 },
  totaalSpacer: { flex: 1 },
  totaalLabel: { fontSize: 10, textAlign: "right", paddingRight: 16 },
  totaalLabelVet: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
    paddingRight: 16,
  },
  totaalWaarde: { fontSize: 10, textAlign: "right", width: COL_TOTAAL },
  totaalWaardeVet: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textAlign: "right",
    width: COL_TOTAAL,
  },

  voet: { marginTop: 22, fontSize: 10, lineHeight: 1.5 },
  voetBetaald: {
    marginTop: 22,
    fontSize: 10,
    lineHeight: 1.5,
    color: kleuren.paidGreen,
    fontFamily: "Helvetica-Bold",
  },
  voetKlein: { marginTop: 10, fontSize: 8, color: kleuren.muted, lineHeight: 1.4 },
});

export interface FactuurTemplateProps {
  factuur: Factuur;
  /** PNG als data-URL; weggelaten = geen logo (PDF blijft geldig). */
  logoDataUrl?: string;
}

export function FactuurTemplate({
  factuur,
  logoDataUrl,
}: FactuurTemplateProps): React.ReactElement {
  const { issuer } = factuur;
  const isBetaald = factuur.status === "betaald";

  return (
    <Document
      title={`Factuur ${factuur.nummer}`}
      author={issuer.naam}
      subject={`Factuur voor ${factuur.klantNaam}`}
    >
      <Page size="A4" style={styles.page}>
        {/* 1. Header: logo links, issuer-blok rechts */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            {logoDataUrl ? <Image style={styles.logo} src={logoDataUrl} /> : null}
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.issuerNaam}>{issuer.naam}</Text>
            {issuer.legalSuffix ? (
              <Text style={styles.issuerLegal}>{issuer.legalSuffix}</Text>
            ) : null}
            <Text style={styles.issuerLine}>{issuer.adres}</Text>
            <Text style={styles.issuerLine}>{issuer.plaats}</Text>
            <Text style={styles.issuerLine}>{issuer.land}</Text>
            {issuer.email ? <Text style={styles.issuerLine}>{issuer.email}</Text> : null}
            {issuer.telefoon && issuer.telefoon.trim() ? (
              <Text style={styles.issuerLine}>{issuer.telefoon}</Text>
            ) : null}
            <Text style={styles.issuerLine}>KvK: {issuer.kvk}</Text>
            {issuer.crib && issuer.crib.trim() ? (
              <Text style={styles.issuerLine}>CRIB: {issuer.crib}</Text>
            ) : null}
          </View>
        </View>

        <View style={styles.accentBalk} />

        {/* 2. Klantblok */}
        <View style={styles.klantBlok}>
          <Text style={styles.klantBold}>{factuur.klantNaam}</Text>
          <Text style={styles.klantLine}>{factuur.adres}</Text>
          <Text style={styles.klantLine}>{factuur.buurt}</Text>
        </View>

        {/* 3. Factuurnummer + datums */}
        <View style={styles.titelRow}>
          <Text style={styles.titel}>Factuur {factuur.nummer}</Text>
          <View style={styles.titelInfo}>
            <Text style={styles.infoLine}>
              Factuurdatum: {formatDatum(factuur.uitgiftedatum)}
            </Text>
            <Text style={styles.infoLine}>
              Vervaldatum: {formatDatum(factuur.vervaldatum)}
            </Text>
          </View>
        </View>

        {/* 4. Betreft */}
        <Text style={styles.betreft}>
          Betreft: kliko-reiniging {maandLabel(factuur.periode)}
        </Text>

        {/* 5. Regels */}
        <View style={styles.tabel}>
          <View style={styles.rij}>
            <View style={[styles.cel, styles.celAantal]}>
              <Text style={styles.kop}>Aantal</Text>
            </View>
            <View style={[styles.cel, styles.celDesc]}>
              <Text style={styles.kop}>Omschrijving</Text>
            </View>
            <View style={[styles.cel, styles.celStuk]}>
              <Text style={styles.kopRechts}>Per stuk</Text>
              <Text style={styles.kopRechts}>excl. ABB</Text>
            </View>
            <View style={[styles.cel, styles.celTotaal]}>
              <Text style={styles.kopRechts}>Totaal</Text>
              <Text style={styles.kopRechts}>excl. ABB</Text>
            </View>
          </View>
          {factuur.regels.map((regel, idx) => (
            <View key={idx} style={styles.rij}>
              <View style={[styles.cel, styles.celAantal]}>
                <Text style={styles.celTekst}>{regel.aantal}</Text>
              </View>
              <View style={[styles.cel, styles.celDesc]}>
                <Text style={styles.celTekst}>{regel.omschrijving}</Text>
              </View>
              <View style={[styles.cel, styles.celStuk]}>
                <Text style={styles.celTekstRechts}>
                  {formatUsdCent(regel.bedragCentExcl)}
                </Text>
              </View>
              <View style={[styles.cel, styles.celTotaal]}>
                <Text style={styles.celTekstRechts}>
                  {formatUsdCent(regel.totaalCentExcl)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* 6. Totalen: subtotaal excl + ABB erbovenop = totaal */}
        <View style={styles.totalen}>
          <View style={styles.totaalRij}>
            <View style={styles.totaalSpacer} />
            <Text style={styles.totaalLabel}>Subtotaal excl. ABB</Text>
            <Text style={styles.totaalWaarde}>
              {formatUsdCent(factuur.subtotaalCentExcl)}
            </Text>
          </View>
          <View style={styles.totaalRij}>
            <View style={styles.totaalSpacer} />
            <Text style={styles.totaalLabel}>ABB {factuur.abbPct}%</Text>
            <Text style={styles.totaalWaarde}>{formatUsdCent(factuur.abbCent)}</Text>
          </View>
          <View style={styles.totaalRij}>
            <View style={styles.totaalSpacer} />
            <Text style={styles.totaalLabelVet}>Totaal (USD)</Text>
            <Text style={styles.totaalWaardeVet}>
              {formatUsdCent(factuur.totaalCentIncl)}
            </Text>
          </View>
        </View>

        {/* 7. Voet: betaalinstructie-placeholder tot de bank/BV rond is */}
        {isBetaald ? (
          <Text style={styles.voetBetaald}>
            Deze factuur is voldaan
            {factuur.betaaldOp ? ` op ${formatDatum(factuur.betaaldOp)}` : ""}. Geen
            actie nodig.
          </Text>
        ) : (
          <Text style={styles.voet}>
            Gelieve het bedrag van {formatUsdCent(factuur.totaalCentIncl)} voor{" "}
            {formatDatum(factuur.vervaldatum)} over te maken naar {issuer.bankrekening}
            {issuer.bankNaam ? ` (${issuer.bankNaam})` : ""} t.n.v. {issuer.naam},
            o.v.v. &quot;Factuur {factuur.nummer}&quot;.
          </Text>
        )}
        <Text style={styles.voetKlein}>
          Alle bedragen in US dollars. ABB {factuur.abbPct}% berekend over het
          subtotaal (dienstverlening op Bonaire).
        </Text>
      </Page>
    </Document>
  );
}

/** "2026-07-04" -> "04-07-2026". */
function formatDatum(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}-${m}-${y}`;
}

/** Haal het logo op als data-URL; mislukt dat, dan PDF zonder logo. */
async function haalLogoDataUrl(): Promise<string | undefined> {
  try {
    const res = await fetch("/primary.png");
    if (!res.ok) return undefined;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

/** Render de factuur-PDF client-side naar een Blob (gedeeld door download + mail). */
async function maakFactuurPdfBlob(factuur: Factuur): Promise<Blob> {
  const logoDataUrl = await haalLogoDataUrl();
  return pdf(
    <FactuurTemplate factuur={factuur} logoDataUrl={logoDataUrl} />
  ).toBlob();
}

/**
 * Factuur-PDF als mail-bijlage: zelfde template als de download, maar dan
 * base64-gecodeerd voor de Resend-API (via /api/mail).
 */
export async function factuurPdfBijlage(
  factuur: Factuur
): Promise<{ filename: string; base64: string }> {
  const blob = await maakFactuurPdfBlob(factuur);
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  // readAsDataURL geeft "data:application/pdf;base64,<...>"; alleen het
  // base64-deel is nodig voor de attachment.
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return { filename: `${factuur.nummer}.pdf`, base64 };
}

/** Genereer de PDF client-side en start een download (<nummer>.pdf). */
export async function downloadFactuurPdf(factuur: Factuur): Promise<void> {
  const blob = await maakFactuurPdfBlob(factuur);
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${factuur.nummer}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Kleine vertraging zodat de browser de download kan starten.
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}
