"use client";

// Office: rentabiliteits-calculator. Maak scenario's (investering, kosten,
// prijzen, klantaantallen) en zie live break-even, winst en terugverdientijd.
// Overgezet uit de Streamlit Invoer + Analyse pagina's (models.py + calculator.py).
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { VerkoopTabs } from "@/components/verkoop-tabs";
import { isFirebaseConfigured } from "@/lib/firebase";
import { usd } from "@/lib/verkoop/offerte";
import {
  bereken,
  createScenario,
  deleteScenario,
  listScenarios,
  nieuwScenario,
  updateScenario,
  type Scenario,
} from "@/lib/verkoop/scenario";
import { FREQUENTIES } from "@/lib/data/prijzen";
import type { Frequentie, KlantType } from "@/lib/data/types";

const inputCls =
  "w-full rounded-lg border border-kliko-navy/20 bg-white px-2.5 py-1.5 text-sm tabular-nums text-kliko-navy focus:border-kliko-blue focus:outline-none focus:ring-2 focus:ring-kliko-blue/30";

const TYPE_LABEL: Record<KlantType, string> = {
  huishouden: "Huishouden",
  bedrijf: "Bedrijf",
};
const FREQ_LABEL: Record<Frequentie, string> = {
  1: "1x/mnd",
  2: "2x/mnd",
  4: "4x/mnd",
};

export default function CalculatorPage() {
  const { t } = useI18n();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [geladen, setGeladen] = useState(false);
  const [actief, setActief] = useState<Scenario | null>(null);
  const [busy, setBusy] = useState(false);
  const [vuil, setVuil] = useState(false); // niet-opgeslagen wijzigingen

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setGeladen(true);
      return;
    }
    listScenarios()
      .then((s) => {
        setScenarios(s);
        setActief(s[0] ?? null);
      })
      .finally(() => setGeladen(true));
  }, []);

  async function nieuw() {
    if (!isFirebaseConfigured()) return;
    const data = nieuwScenario(`Scenario ${scenarios.length + 1}`);
    setBusy(true);
    try {
      const id = await createScenario(data);
      const s: Scenario = { id, ...data };
      setScenarios((h) => [...h, s]);
      setActief(s);
      setVuil(false);
    } finally {
      setBusy(false);
    }
  }

  async function opslaan() {
    if (!actief || busy || !isFirebaseConfigured()) return;
    setBusy(true);
    try {
      const { id, ...rest } = actief;
      await updateScenario(id, rest);
      setScenarios((h) => h.map((s) => (s.id === id ? actief : s)));
      setVuil(false);
    } catch {
      window.alert(t("verkoop.calc.fout"));
    } finally {
      setBusy(false);
    }
  }

  async function verwijder() {
    if (!actief || !isFirebaseConfigured()) return;
    const id = actief.id;
    const rest = scenarios.filter((s) => s.id !== id);
    setScenarios(rest);
    setActief(rest[0] ?? null);
    setVuil(false);
    await deleteScenario(id).catch(() => {});
  }

  function patch(p: Partial<Scenario>) {
    setActief((s) => (s ? { ...s, ...p } : s));
    setVuil(true);
  }
  function patchPrijs(type: KlantType, f: Frequentie, waarde: number) {
    setActief((s) =>
      s
        ? {
            ...s,
            prijzen: {
              ...s.prijzen,
              [type]: { ...s.prijzen[type], [f]: waarde },
            },
          }
        : s
    );
    setVuil(true);
  }
  function patchKlant(type: KlantType, f: Frequentie, waarde: number) {
    setActief((s) =>
      s
        ? {
            ...s,
            klanten: {
              ...s.klanten,
              [type]: { ...s.klanten[type], [f]: waarde },
            },
          }
        : s
    );
    setVuil(true);
  }

  const r = actief ? bereken(actief) : null;
  const num = (v: string) => (v === "" ? 0 : Number(v));

  return (
    <div>
      <VerkoopTabs />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-kliko-navy sm:text-3xl">
            {t("verkoop.calc.title")}
          </h1>
          <p className="mt-1 text-sm text-kliko-navy/60">{t("verkoop.calc.sub")}</p>
        </div>
        <button
          onClick={nieuw}
          disabled={busy}
          className="rounded-full bg-kliko-navy px-4 py-2 text-sm font-bold text-white hover:bg-kliko-navy/90 disabled:opacity-50"
        >
          {t("verkoop.calc.nieuw")}
        </button>
      </div>

      {/* Scenario-kiezer */}
      {scenarios.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {scenarios.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setActief(s);
                setVuil(false);
              }}
              className={
                actief?.id === s.id
                  ? "rounded-full bg-kliko-blue px-3.5 py-1.5 text-xs font-bold text-white"
                  : "rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-kliko-navy/70 ring-1 ring-kliko-navy/10 hover:text-kliko-navy"
              }
            >
              {s.naam}
            </button>
          ))}
        </div>
      )}

      {!geladen ? (
        <p className="py-10 text-center text-sm font-semibold text-kliko-navy/40">
          {t("verkoop.calc.laden")}
        </p>
      ) : !actief || !r ? (
        <p className="mt-8 rounded-2xl border border-dashed border-kliko-navy/20 bg-white p-8 text-center text-sm font-semibold text-kliko-navy/50">
          {t("verkoop.calc.geen")}
        </p>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          {/* INVOER */}
          <div className="flex flex-col gap-4">
            <section className="rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm">
              <input
                className="w-full rounded-lg border border-kliko-navy/20 px-3 py-2 text-lg font-bold text-kliko-navy focus:border-kliko-blue focus:outline-none"
                value={actief.naam}
                onChange={(e) => patch({ naam: e.target.value })}
              />
              <input
                className="mt-2 w-full rounded-lg border border-kliko-navy/20 px-3 py-1.5 text-sm text-kliko-navy focus:border-kliko-blue focus:outline-none"
                placeholder={t("verkoop.calc.omschrijving")}
                value={actief.omschrijving}
                onChange={(e) => patch({ omschrijving: e.target.value })}
              />
            </section>

            {/* Investering + kosten */}
            <section className="rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wider text-kliko-blue">
                {t("verkoop.calc.kosten")}
              </h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Veld label={t("verkoop.calc.investering")} prefix="$">
                  <input
                    type="number"
                    className={inputCls}
                    value={actief.investeringTotaal}
                    onChange={(e) => patch({ investeringTotaal: num(e.target.value) })}
                  />
                </Veld>
                <Veld label={t("verkoop.calc.personeel")} prefix="$">
                  <input
                    type="number"
                    className={inputCls}
                    value={actief.personeelPerMaand}
                    onChange={(e) => patch({ personeelPerMaand: num(e.target.value) })}
                  />
                </Veld>
                <Veld label={t("verkoop.calc.vastekosten")} prefix="$">
                  <input
                    type="number"
                    className={inputCls}
                    value={actief.vasteKostenPerMaand}
                    onChange={(e) => patch({ vasteKostenPerMaand: num(e.target.value) })}
                  />
                </Veld>
                <Veld label={t("verkoop.calc.water")} prefix="$">
                  <input
                    type="number"
                    step="0.05"
                    className={inputCls}
                    value={actief.waterPerReiniging}
                    onChange={(e) => patch({ waterPerReiniging: num(e.target.value) })}
                  />
                </Veld>
                <Veld label={t("verkoop.calc.overig")} prefix="$">
                  <input
                    type="number"
                    step="0.05"
                    className={inputCls}
                    value={actief.overigPerReiniging}
                    onChange={(e) => patch({ overigPerReiniging: num(e.target.value) })}
                  />
                </Veld>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Veld label={t("verkoop.calc.perdag")}>
                  <input
                    type="number"
                    className={inputCls}
                    value={actief.containersPerDag}
                    onChange={(e) => patch({ containersPerDag: num(e.target.value) })}
                  />
                </Veld>
                <Veld label={t("verkoop.calc.werkdagen")}>
                  <input
                    type="number"
                    className={inputCls}
                    value={actief.werkdagenPerMaand}
                    onChange={(e) => patch({ werkdagenPerMaand: num(e.target.value) })}
                  />
                </Veld>
              </div>
            </section>

            {/* Prijzen + klanten */}
            {(["huishouden", "bedrijf"] as KlantType[]).map((type) => (
              <section
                key={type}
                className="rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm"
              >
                <h2 className="text-sm font-bold uppercase tracking-wider text-kliko-blue">
                  {TYPE_LABEL[type]}
                </h2>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  {FREQUENTIES.map((f) => (
                    <div key={f}>
                      <div className="mb-1 text-xs font-bold text-kliko-navy/60">
                        {FREQ_LABEL[f]}
                      </div>
                      <label className="mb-1 block text-[11px] text-kliko-navy/50">
                        {t("verkoop.calc.prijs")}
                      </label>
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-bold text-kliko-navy/40">$</span>
                        <input
                          type="number"
                          className={inputCls}
                          value={actief.prijzen[type][f]}
                          onChange={(e) => patchPrijs(type, f, num(e.target.value))}
                        />
                      </div>
                      <label className="mb-1 mt-2 block text-[11px] text-kliko-navy/50">
                        {t("verkoop.calc.klanten")}
                      </label>
                      <input
                        type="number"
                        className={inputCls}
                        value={actief.klanten[type][f]}
                        onChange={(e) => patchKlant(type, f, num(e.target.value))}
                      />
                    </div>
                  ))}
                </div>
              </section>
            ))}

            <div className="flex gap-2">
              <button
                onClick={opslaan}
                disabled={busy || !vuil}
                className="rounded-full bg-kliko-blue px-6 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? t("verkoop.calc.bezig") : vuil ? t("verkoop.calc.opslaan") : t("verkoop.calc.opgeslagen")}
              </button>
              <button
                onClick={verwijder}
                className="rounded-full border border-kliko-red/30 px-5 py-2.5 text-sm font-bold text-kliko-red hover:bg-kliko-red/10"
              >
                {t("verkoop.calc.verwijder")}
              </button>
            </div>
          </div>

          {/* RESULTAAT */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
            <section className="rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wider text-kliko-blue">
                {t("verkoop.calc.resultaat")}
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Uitkomst label={t("verkoop.calc.omzet")} waarde={usd(r.totaalOmzet)} />
                <Uitkomst label={t("verkoop.calc.totaalkosten")} waarde={usd(r.totaalKosten)} />
                <Uitkomst
                  label={t("verkoop.calc.winst")}
                  waarde={usd(r.nettoWinst)}
                  kleur={r.nettoWinst >= 0 ? "groen" : "rood"}
                  groot
                />
                <Uitkomst
                  label={t("verkoop.calc.terugverdien")}
                  waarde={
                    r.terugverdienMaanden === null
                      ? "-"
                      : `${r.terugverdienMaanden.toFixed(1)} ${t("verkoop.calc.mnd")}`
                  }
                />
              </div>
            </section>

            <section className="rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-bold uppercase tracking-wider text-kliko-blue">
                {t("verkoop.calc.details")}
              </h2>
              <dl className="mt-3 flex flex-col gap-2 text-sm">
                <Regel label={t("verkoop.calc.klantentotaal")} waarde={String(r.totaalKlanten)} />
                <Regel label={t("verkoop.calc.reinigingen")} waarde={String(r.reinigingen)} />
                <Regel
                  label={t("verkoop.calc.capaciteit")}
                  waarde={`${r.reinigingen} / ${r.capaciteitPerMaand} (${Math.round(
                    r.capaciteitBenut * 100
                  )}%)`}
                  waarschuw={r.capaciteitBenut > 1}
                />
                <Regel label={t("verkoop.calc.variabel")} waarde={usd(r.variabeleKosten)} />
                <Regel label={t("verkoop.calc.personeelkosten")} waarde={usd(r.personeelKosten)} />
                <Regel label={t("verkoop.calc.vastekostenr")} waarde={usd(r.vasteKosten)} />
                <Regel
                  label={t("verkoop.calc.gemopbrengst")}
                  waarde={usd(r.gemOpbrengstPerReiniging)}
                />
                <Regel
                  label={t("verkoop.calc.breakeven")}
                  waarde={
                    r.breakEvenKlanten === null
                      ? "-"
                      : `${r.breakEvenKlanten} ${t("verkoop.calc.klantenlabel")}`
                  }
                  nadruk
                />
              </dl>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

function Veld({
  label,
  prefix,
  children,
}: {
  label: string;
  prefix?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold text-kliko-navy/60">
        {label}
      </label>
      <div className="flex items-center gap-1.5">
        {prefix && <span className="text-xs font-bold text-kliko-navy/40">{prefix}</span>}
        {children}
      </div>
    </div>
  );
}

function Uitkomst({
  label,
  waarde,
  kleur,
  groot,
}: {
  label: string;
  waarde: string;
  kleur?: "groen" | "rood";
  groot?: boolean;
}) {
  const kleurCls =
    kleur === "groen" ? "text-green-600" : kleur === "rood" ? "text-kliko-red" : "text-kliko-navy";
  return (
    <div className="rounded-xl bg-kliko-navy/[0.03] p-3">
      <div className="text-xs font-semibold text-kliko-navy/50">{label}</div>
      <div
        className={`mt-0.5 font-black tabular-nums ${kleurCls} ${
          groot ? "text-xl" : "text-base"
        }`}
      >
        {waarde}
      </div>
    </div>
  );
}

function Regel({
  label,
  waarde,
  nadruk,
  waarschuw,
}: {
  label: string;
  waarde: string;
  nadruk?: boolean;
  waarschuw?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-kliko-navy/60">{label}</dt>
      <dd
        className={`tabular-nums ${
          waarschuw
            ? "font-bold text-kliko-red"
            : nadruk
              ? "font-black text-kliko-navy"
              : "font-semibold text-kliko-navy"
        }`}
      >
        {waarde}
      </dd>
    </div>
  );
}
