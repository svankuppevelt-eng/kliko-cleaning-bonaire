"use client";

// Factuur-detail (office): regels + totalen, PDF-download (client-side via
// @react-pdf/renderer, dynamisch geimporteerd bij klik), markeer als
// verstuurd/betaald met optimistic update + rollback, en een uitgeschakelde
// "Betaallink"-knop tot de betaalprovider (Sentoo of Stripe) gekoppeld is.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  getFactuur,
  maandLabel,
  markeerBetaald,
  markeerVerstuurd,
} from "@/lib/data/facturen";
import {
  effectieveStatus,
  formatUsdCent,
  type Factuur,
  type FactuurStatus,
} from "@/lib/data/facturen-types";

const STATUS_STYLE: Record<FactuurStatus, string> = {
  concept: "bg-kliko-navy/10 text-kliko-navy",
  verstuurd: "bg-kliko-blue/10 text-kliko-blue",
  betaald: "bg-[#0d8a3e]/10 text-[#0d8a3e]",
  teLaat: "bg-kliko-red/10 text-kliko-red",
};

function formatDatum(iso: string, lang: string): string {
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(
    lang === "en" ? "en-GB" : "nl-NL"
  );
}

export default function FactuurDetailPage() {
  const { t, lang } = useI18n();
  const params = useParams<{ id: string }>();

  const [factuur, setFactuur] = useState<Factuur | null | undefined>(undefined);
  const [pdfBezig, setPdfBezig] = useState(false);
  const [statusBezig, setStatusBezig] = useState(false);
  const [foutKey, setFoutKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setFactuur(null);
      return;
    }
    getFactuur(params.id)
      .then(setFactuur)
      .catch(() => setFactuur(null));
  }, [params.id]);

  async function downloadPdf() {
    if (!factuur || pdfBezig) return;
    setPdfBezig(true);
    setFoutKey(null);
    try {
      // Dynamische import: @react-pdf/renderer pas laden bij de eerste download.
      const { downloadFactuurPdf } = await import("@/lib/facturen-pdf");
      await downloadFactuurPdf(factuur);
    } catch {
      setFoutKey("fact.err.pdf");
    } finally {
      setPdfBezig(false);
    }
  }

  async function zetStatus(doel: "verstuurd" | "betaald") {
    if (!factuur || statusBezig) return;
    setStatusBezig(true);
    setFoutKey(null);
    const vorige = factuur;
    const betaaldOp =
      doel === "betaald" ? new Date().toISOString().slice(0, 10) : undefined;
    // Optimistic update -> await write -> rollback bij fout.
    setFactuur({ ...factuur, status: doel, ...(betaaldOp ? { betaaldOp } : {}) });
    try {
      if (doel === "verstuurd") await markeerVerstuurd(factuur.id);
      else await markeerBetaald(factuur.id, betaaldOp);
    } catch {
      setFactuur(vorige);
      setFoutKey("fact.err.save");
    } finally {
      setStatusBezig(false);
    }
  }

  if (factuur === undefined) {
    return (
      <p className="py-10 text-center text-sm font-semibold text-kliko-navy/50">
        {t("fact.loading")}
      </p>
    );
  }

  if (factuur === null) {
    return (
      <div>
        <Link
          href="/beheer/facturen"
          className="text-sm font-semibold text-kliko-blue hover:underline"
        >
          &larr; {t("fact.detail.back")}
        </Link>
        <p className="mt-6 rounded-xl border border-kliko-red/30 bg-kliko-red/10 px-4 py-3 text-sm font-semibold text-kliko-red">
          {t("fact.detail.notfound")}
        </p>
      </div>
    );
  }

  const status = effectieveStatus(factuur);

  return (
    <div>
      <Link
        href="/beheer/facturen"
        className="text-sm font-semibold text-kliko-blue hover:underline"
      >
        &larr; {t("fact.detail.back")}
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black tracking-tight text-kliko-navy sm:text-3xl">
          {factuur.nummer}
        </h1>
        <span
          className={`rounded-full px-3 py-1 text-sm font-bold ${STATUS_STYLE[status]}`}
        >
          {t(`fact.status.${status}`)}
        </span>
      </div>

      {foutKey && (
        <p className="mt-4 rounded-xl border border-kliko-red/30 bg-kliko-red/10 px-4 py-3 text-sm font-semibold text-kliko-red">
          {t(foutKey)}
        </p>
      )}

      {/* Klant + factuurgegevens */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-kliko-navy/10 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-kliko-navy/50">
            {t("fact.klant")}
          </h2>
          <p className="mt-2 font-bold text-kliko-navy">
            <Link href={`/beheer/${factuur.klantId}`} className="hover:text-kliko-blue">
              {factuur.klantNaam}
            </Link>
          </p>
          <p className="text-sm text-kliko-navy/70">{factuur.adres}</p>
          <p className="text-sm text-kliko-navy/70">{factuur.buurt}</p>
        </div>
        <div className="rounded-2xl border border-kliko-navy/10 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-kliko-navy/50">
            {t("fact.periode")}
          </h2>
          <p className="mt-2 font-bold text-kliko-navy">{maandLabel(factuur.periode)}</p>
          <p className="mt-1 text-sm text-kliko-navy/70">
            {t("fact.uitgifte")}: {formatDatum(factuur.uitgiftedatum, lang)}
          </p>
          <p className="text-sm text-kliko-navy/70">
            {t("fact.verval")}: {formatDatum(factuur.vervaldatum, lang)}
          </p>
          {factuur.betaaldOp && (
            <p className="text-sm font-semibold text-[#0d8a3e]">
              {t("fact.betaaldop")}: {formatDatum(factuur.betaaldOp, lang)}
            </p>
          )}
        </div>
      </div>

      {/* Regels + totalen */}
      <div className="mt-3 rounded-2xl border border-kliko-navy/10 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-kliko-navy/50">
          {t("fact.spec")}
        </h2>
        <ul className="mt-2 divide-y divide-kliko-navy/10">
          {factuur.regels.map((regel, idx) => (
            <li key={idx} className="flex items-start justify-between gap-3 py-2.5">
              <span className="text-sm text-kliko-navy">
                {regel.aantal} &times; {regel.omschrijving}
              </span>
              <span className="text-sm font-semibold text-kliko-navy">
                {formatUsdCent(regel.totaalCentExcl)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-2 space-y-1 border-t border-kliko-navy/10 pt-3 text-sm">
          <div className="flex justify-between text-kliko-navy/70">
            <span>{t("fact.subtotaal")}</span>
            <span>{formatUsdCent(factuur.subtotaalCentExcl)}</span>
          </div>
          <div className="flex justify-between text-kliko-navy/70">
            <span>ABB {factuur.abbPct}%</span>
            <span>{formatUsdCent(factuur.abbCent)}</span>
          </div>
          <div className="flex justify-between text-base font-bold text-kliko-navy">
            <span>{t("fact.totaal")}</span>
            <span>{formatUsdCent(factuur.totaalCentIncl)}</span>
          </div>
        </div>
      </div>

      {/* Acties */}
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={downloadPdf}
          disabled={pdfBezig}
          className="rounded-full bg-kliko-blue px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {pdfBezig ? t("fact.download.busy") : t("fact.download")}
        </button>
        {factuur.status === "concept" && (
          <button
            onClick={() => zetStatus("verstuurd")}
            disabled={statusBezig}
            className="rounded-full bg-kliko-navy px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {t("fact.markeer.verstuurd")}
          </button>
        )}
        {factuur.status !== "betaald" && (
          <button
            onClick={() => zetStatus("betaald")}
            disabled={statusBezig}
            className="rounded-full bg-[#0d8a3e] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {t("fact.markeer.betaald")}
          </button>
        )}
        {/* Uitgeschakeld tot de betaalprovider (Sentoo of Stripe) gekoppeld is. */}
        <button
          disabled
          title={t("fact.betaallink.note")}
          className="cursor-not-allowed rounded-full border border-kliko-navy/20 px-5 py-2.5 text-sm font-bold text-kliko-navy/40"
        >
          {t("fact.betaallink")}
        </button>
      </div>
      <p className="mt-2 text-xs text-kliko-navy/50">{t("fact.betaallink.note")}</p>
    </div>
  );
}
