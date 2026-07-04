"use client";

// Office: offerte-tool. Stel tijdens een klantbezoek snel een aanbieding samen
// uit een of meer containers; prijzen komen live uit de instellingen, kortingen
// en cadeaus uit het prijsbeleid. Overgezet uit de Streamlit-offerte-tool.
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { VerkoopTabs } from "@/components/verkoop-tabs";
import { useInstellingen } from "@/lib/use-instellingen";
import {
  DEFAULT_PRIJSBELEID,
  getPrijsBeleid,
  type PrijsBeleid,
} from "@/lib/data/prijsbeleid";
import { FREQUENTIES } from "@/lib/data/prijzen";
import type { Frequentie, KlantType } from "@/lib/data/types";
import {
  berekenOfferte,
  usd,
  type Contractduur,
  type OfferteContainer,
} from "@/lib/verkoop/offerte";

const TYPE_LABEL: Record<KlantType, string> = {
  huishouden: "Kleine container (huishouden)",
  bedrijf: "Bedrijfscontainer",
};
const FREQ_LABEL: Record<Frequentie, string> = {
  1: "1x per maand",
  2: "2x per maand",
  4: "4x per maand (wekelijks)",
};

const selectCls =
  "w-full rounded-xl border border-kliko-navy/20 bg-white px-3 py-2 text-sm font-semibold text-kliko-navy focus:border-kliko-blue focus:outline-none focus:ring-2 focus:ring-kliko-blue/30";

export default function OffertesPage() {
  const { t } = useI18n();
  const { instellingen } = useInstellingen();
  const [beleid, setBeleid] = useState<PrijsBeleid>(DEFAULT_PRIJSBELEID);

  const [klantnaam, setKlantnaam] = useState("");
  const [contractduur, setContractduur] = useState<Contractduur>("maandelijks");
  const [containers, setContainers] = useState<OfferteContainer[]>([
    { type: "huishouden", frequentie: 4 },
  ]);

  useEffect(() => {
    getPrijsBeleid().then(setBeleid);
  }, []);

  const resultaat = berekenOfferte(
    containers,
    instellingen.prijzen,
    beleid,
    contractduur
  );

  function wijzigContainer(idx: number, patch: Partial<OfferteContainer>) {
    setContainers((huidig) =>
      huidig.map((c, i) => (i === idx ? { ...c, ...patch } : c))
    );
  }
  function voegToe() {
    setContainers((h) => [...h, { type: "huishouden", frequentie: 4 }]);
  }
  function verwijder(idx: number) {
    setContainers((h) => (h.length > 1 ? h.filter((_, i) => i !== idx) : h));
  }

  const naamWeergave = klantnaam.trim() || t("verkoop.off.naamplaceholder");

  return (
    <div>
      <VerkoopTabs />
      <h1 className="text-2xl font-black tracking-tight text-kliko-navy sm:text-3xl">
        {t("verkoop.off.title")}
      </h1>
      <p className="mt-1 text-sm text-kliko-navy/60">{t("verkoop.off.sub")}</p>

      {/* Klantgegevens */}
      <section className="mt-6 rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-kliko-blue">
          {t("verkoop.off.klant")}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold text-kliko-navy/60">
              {t("verkoop.off.naam")}
            </label>
            <input
              className={selectCls}
              placeholder="bv. Hotel Bonaire Breeze"
              value={klantnaam}
              onChange={(e) => setKlantnaam(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-kliko-navy/60">
              {t("verkoop.off.contract")}
            </label>
            <select
              className={selectCls}
              value={contractduur}
              onChange={(e) => setContractduur(e.target.value as Contractduur)}
            >
              <option value="maandelijks">{t("verkoop.off.maandelijks")}</option>
              <option value="jaar">{t("verkoop.off.jaar")}</option>
            </select>
          </div>
        </div>
      </section>

      {/* Containers */}
      <section className="mt-4 rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-kliko-blue">
            {t("verkoop.off.containers")}
          </h2>
          <button
            onClick={voegToe}
            className="rounded-full bg-kliko-navy px-3.5 py-1.5 text-xs font-bold text-white hover:bg-kliko-navy/90"
          >
            {t("verkoop.off.toevoegen")}
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {resultaat.regels.map((r, idx) => (
            <div
              key={idx}
              className="grid items-center gap-2 rounded-xl border border-kliko-navy/10 bg-kliko-navy/[0.02] p-3 sm:grid-cols-[auto_1fr_1fr_auto_auto]"
            >
              <span className="text-sm font-black text-kliko-navy/40">
                #{r.nummer}
              </span>
              <select
                className={selectCls}
                value={containers[idx].type}
                onChange={(e) =>
                  wijzigContainer(idx, { type: e.target.value as KlantType })
                }
              >
                {(["huishouden", "bedrijf"] as KlantType[]).map((tp) => (
                  <option key={tp} value={tp}>
                    {TYPE_LABEL[tp]}
                  </option>
                ))}
              </select>
              <select
                className={selectCls}
                value={containers[idx].frequentie}
                onChange={(e) =>
                  wijzigContainer(idx, {
                    frequentie: Number(e.target.value) as Frequentie,
                  })
                }
              >
                {FREQUENTIES.map((f) => (
                  <option key={f} value={f}>
                    {FREQ_LABEL[f]}
                  </option>
                ))}
              </select>
              <div className="text-right text-sm tabular-nums">
                {r.kortingPct > 0 ? (
                  <span>
                    <span className="text-kliko-navy/40 line-through">
                      {usd(r.basis)}
                    </span>{" "}
                    <span className="font-bold text-kliko-navy">
                      {usd(r.netto)}
                    </span>
                    <span className="ml-1 rounded bg-green-100 px-1.5 py-0.5 text-xs font-bold text-green-700">
                      -{r.kortingPct}%
                    </span>
                  </span>
                ) : (
                  <span className="font-bold text-kliko-navy">
                    {usd(r.basis)}
                  </span>
                )}
                <span className="text-xs text-kliko-navy/50">/mnd</span>
              </div>
              <button
                onClick={() => verwijder(idx)}
                disabled={containers.length === 1}
                aria-label={t("verkoop.off.verwijderen")}
                className="justify-self-end rounded-full px-2 py-1 text-sm font-bold text-kliko-red hover:bg-kliko-red/10 disabled:cursor-not-allowed disabled:text-kliko-navy/20"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Offerte-kaart */}
      <section className="mt-4 overflow-hidden rounded-2xl border border-kliko-navy/15 bg-white shadow-sm">
        <div className="border-b-2 border-kliko-navy bg-kliko-navy/[0.03] px-5 py-4 sm:px-6">
          <h2 className="text-lg font-black text-kliko-navy">
            {t("verkoop.off.aanbieding")} {naamWeergave}
          </h2>
        </div>
        <div className="flex flex-col gap-1.5 px-5 py-4 text-sm sm:px-6">
          {resultaat.regels.map((r) => (
            <div key={r.nummer}>
              <div className="flex justify-between">
                <span className="text-kliko-navy/70">
                  Container #{r.nummer}: {TYPE_LABEL[r.type]} - {FREQ_LABEL[r.frequentie]}
                </span>
                <span className="font-semibold tabular-nums text-kliko-navy">
                  {usd(r.basis)}/mnd
                </span>
              </div>
              {r.kortingPct > 0 && (
                <div className="flex justify-between pl-4 text-green-700">
                  <span>
                    Korting {r.nummer}e container (-{r.kortingPct}%)
                  </span>
                  <span className="tabular-nums">- {usd(r.kortingBedrag)}</span>
                </div>
              )}
            </div>
          ))}

          {resultaat.jaarKortingPct > 0 && (
            <div className="mt-2 border-t border-kliko-navy/10 pt-2">
              <div className="flex justify-between font-semibold text-kliko-navy">
                <span>{t("verkoop.off.subtotaal")}</span>
                <span className="tabular-nums">
                  {usd(resultaat.subtotaalPerMaand)}
                </span>
              </div>
              <div className="flex justify-between text-green-700">
                <span>
                  {t("verkoop.off.jaarkorting")} (-{resultaat.jaarKortingPct}%)
                </span>
                <span className="tabular-nums">
                  - {usd(resultaat.jaarKortingBedrag)}/mnd
                </span>
              </div>
            </div>
          )}

          <div className="mt-3 rounded-xl bg-kliko-navy px-4 py-3 font-bold text-white">
            {contractduur === "jaar" ? (
              <span>
                {t("verkoop.off.permaand")}: {usd(resultaat.nettoPerMaand)}
                {"  |  "}
                {t("verkoop.off.perjaar")}: {usd(resultaat.totaalJaar)}
              </span>
            ) : (
              <span>
                {t("verkoop.off.abo")}: {usd(resultaat.nettoPerMaand)}{" "}
                {t("verkoop.off.permaandkort")}
              </span>
            )}
          </div>

          {contractduur === "jaar" && resultaat.besparingPerJaar > 0 && (
            <div className="rounded-xl bg-green-50 px-4 py-2.5 font-semibold text-green-700">
              {t("verkoop.off.bespaart")} {usd(resultaat.besparingPerJaar)}{" "}
              {t("verkoop.off.perjaarvs")}
            </div>
          )}

          <div className="rounded-xl border-l-4 border-kliko-yellow bg-kliko-yellow/10 px-4 py-2.5">
            <span className="font-bold text-kliko-navy">
              {t("verkoop.off.welkomvoordeel")}:
            </span>{" "}
            <span className="text-kliko-navy/80">
              {resultaat.cadeaus.join(" | ")}
            </span>
          </div>
        </div>
      </section>

      {/* Snel overzicht */}
      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label={t("verkoop.off.kpi.containers")} waarde={String(resultaat.regels.length)} />
        <Kpi label={t("verkoop.off.kpi.permaand")} waarde={usd(resultaat.nettoPerMaand)} />
        <Kpi label={t("verkoop.off.kpi.perjaar")} waarde={usd(resultaat.totaalJaar)} />
        <Kpi
          label={t("verkoop.off.kpi.besparing")}
          waarde={usd(resultaat.besparingPerJaar)}
          groen={resultaat.besparingPerJaar > 0}
        />
      </section>
    </div>
  );
}

function Kpi({
  label,
  waarde,
  groen,
}: {
  label: string;
  waarde: string;
  groen?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-kliko-navy/10 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold text-kliko-navy/50">{label}</div>
      <div
        className={`mt-1 text-xl font-black tabular-nums ${
          groen ? "text-green-600" : "text-kliko-navy"
        }`}
      >
        {waarde}
      </div>
    </div>
  );
}
