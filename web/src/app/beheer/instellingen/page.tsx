"use client";

// Office: ALLE prijsafspraken op 1 plek (Firestore-doc instellingen/algemeen):
// per tier de maand- en jaarprijs, de container-korting (drempels + percentage),
// de offerte-cadeaus en de dagcapaciteit. Het oude aparte "Prijsbeleid" onder
// Verkoop is hierin opgegaan. Alleen rol "eigenaar" mag wijzigen; rol
// "kantoor" ziet de waarden read-only.
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { isFirebaseConfigured } from "@/lib/firebase";
import { useOfficeUser } from "@/lib/use-office-user";
import {
  getInstellingen,
  saveInstellingen,
  type Instellingen,
} from "@/lib/data/instellingen";
import {
  FREQUENTIES,
  formatUsd,
  kortingPctVoorAantal,
  totaalJaarPrijs,
  totaalMaandPrijs,
  type ContainerKortingRegel,
  type PrijsTabel,
} from "@/lib/data/prijzen";
import type { Frequentie, KlantType } from "@/lib/data/types";

const FREQ_LABEL: Record<Frequentie, string> = {
  1: "price.f1",
  2: "price.f2",
  4: "price.f4",
};

const TYPES: { type: KlantType; label: string }[] = [
  { type: "huishouden", label: "price.home" },
  { type: "bedrijf", label: "price.biz" },
];

const inputCls =
  "w-full rounded-xl border border-kliko-navy/20 bg-white px-3 py-2.5 text-base tabular-nums text-kliko-navy focus:border-kliko-blue focus:outline-none focus:ring-2 focus:ring-kliko-blue/30 disabled:bg-kliko-navy/5 disabled:text-kliko-navy/60";
const smallInputCls =
  "w-full rounded-xl border border-kliko-navy/20 bg-white px-3 py-2 text-sm tabular-nums text-kliko-navy focus:border-kliko-blue focus:outline-none focus:ring-2 focus:ring-kliko-blue/30 disabled:bg-kliko-navy/5 disabled:text-kliko-navy/60";

/** Formulier-state als strings, zodat tussenstanden tijdens typen niet breken. */
interface KortingRij {
  vanafAantal: string;
  kortingPct: string;
}

interface FormState {
  prijzen: Record<KlantType, Record<Frequentie, { maand: string; jaar: string }>>;
  containerKorting: KortingRij[];
  cadeauWelkom: string;
  cadeauJaarcontract: string;
  containersPerDag: string;
}

function naarForm(inst: Instellingen): FormState {
  const prijzen = {} as FormState["prijzen"];
  for (const { type } of TYPES) {
    prijzen[type] = {} as FormState["prijzen"][KlantType];
    for (const f of FREQUENTIES) {
      prijzen[type][f] = {
        maand: String(inst.prijzen[type][f].maand),
        jaar: String(inst.prijzen[type][f].jaar),
      };
    }
  }
  return {
    prijzen,
    containerKorting: inst.containerKorting.map((r) => ({
      vanafAantal: String(r.vanafAantal),
      kortingPct: String(r.kortingPct),
    })),
    cadeauWelkom: inst.cadeauWelkom,
    cadeauJaarcontract: inst.cadeauJaarcontract,
    containersPerDag: String(inst.containersPerDag),
  };
}

// Kolommen van de live voorbeeld-matrix: totaalprijs bij 1, 2 en 3 containers.
const MATRIX_AANTALLEN = [1, 2, 3] as const;

/**
 * Parse de HUIDIGE (nog niet opgeslagen) formulier-prijzen naar een
 * prijstabel. Ongeldige invoer wordt NaN; de matrix toont dan "-" in plaats
 * van een bedrag, zodat het voorbeeld live meebeweegt tijdens het typen.
 */
function formNaarPrijsTabel(form: FormState): PrijsTabel {
  const prijzen = {} as PrijsTabel;
  for (const { type } of TYPES) {
    prijzen[type] = {} as PrijsTabel[KlantType];
    for (const f of FREQUENTIES) {
      prijzen[type][f] = {
        maand: Number(form.prijzen[type][f].maand),
        jaar: Number(form.prijzen[type][f].jaar),
      };
    }
  }
  return prijzen;
}

/** Parse alleen de geldige kortingsrijen uit het formulier (live voorbeeld). */
function formNaarKortingRegels(rijen: KortingRij[]): ContainerKortingRegel[] {
  const regels: ContainerKortingRegel[] = [];
  for (const rij of rijen) {
    const vanafAantal = Number(rij.vanafAantal);
    const kortingPct = Number(rij.kortingPct);
    if (
      Number.isInteger(vanafAantal) &&
      vanafAantal >= 2 &&
      Number.isFinite(kortingPct) &&
      kortingPct > 0 &&
      kortingPct <= 100
    ) {
      regels.push({ vanafAantal, kortingPct });
    }
  }
  return regels;
}

export default function InstellingenPage() {
  const { t } = useI18n();
  const officeUser = useOfficeUser();
  const isEigenaar = officeUser.status === "office" && officeUser.rol === "eigenaar";

  const [form, setForm] = useState<FormState | null>(null);
  const [busy, setBusy] = useState(false);
  const [melding, setMelding] = useState<{ tekst: string; fout: boolean } | null>(null);

  useEffect(() => {
    // getInstellingen valt zelf terug op de defaults bij fouten.
    getInstellingen().then((inst) => setForm(naarForm(inst)));
  }, []);

  function zetPrijs(
    type: KlantType,
    f: Frequentie,
    veld: "maand" | "jaar",
    waarde: string
  ) {
    setForm((huidig) =>
      huidig
        ? {
            ...huidig,
            prijzen: {
              ...huidig.prijzen,
              [type]: {
                ...huidig.prijzen[type],
                [f]: { ...huidig.prijzen[type][f], [veld]: waarde },
              },
            },
          }
        : huidig
    );
  }

  function zetKorting(idx: number, veld: keyof KortingRij, waarde: string) {
    setForm((huidig) =>
      huidig
        ? {
            ...huidig,
            containerKorting: huidig.containerKorting.map((r, i) =>
              i === idx ? { ...r, [veld]: waarde } : r
            ),
          }
        : huidig
    );
  }

  function voegKortingToe() {
    setForm((huidig) =>
      huidig
        ? {
            ...huidig,
            containerKorting: [
              ...huidig.containerKorting,
              { vanafAantal: "2", kortingPct: "10" },
            ],
          }
        : huidig
    );
  }

  function verwijderKorting(idx: number) {
    setForm((huidig) =>
      huidig
        ? {
            ...huidig,
            containerKorting: huidig.containerKorting.filter((_, i) => i !== idx),
          }
        : huidig
    );
  }

  async function opslaan(e: React.FormEvent) {
    e.preventDefault();
    if (!form || busy || !isEigenaar) return;
    setMelding(null);

    // Valideer: alle prijzen en de capaciteit positieve getallen.
    const inst: Instellingen = {
      prijzen: {
        huishouden: {
          1: { maand: 0, jaar: 0 },
          2: { maand: 0, jaar: 0 },
          4: { maand: 0, jaar: 0 },
        },
        bedrijf: {
          1: { maand: 0, jaar: 0 },
          2: { maand: 0, jaar: 0 },
          4: { maand: 0, jaar: 0 },
        },
      },
      containerKorting: [],
      cadeauWelkom: form.cadeauWelkom.trim(),
      cadeauJaarcontract: form.cadeauJaarcontract.trim(),
      containersPerDag: Number(form.containersPerDag),
    };
    let geldig =
      Number.isFinite(inst.containersPerDag) && inst.containersPerDag > 0;
    for (const { type } of TYPES) {
      for (const f of FREQUENTIES) {
        const maand = Number(form.prijzen[type][f].maand);
        const jaar = Number(form.prijzen[type][f].jaar);
        if (!Number.isFinite(maand) || maand <= 0) geldig = false;
        if (!Number.isFinite(jaar) || jaar <= 0) geldig = false;
        inst.prijzen[type][f] = { maand, jaar };
      }
    }
    if (!geldig) {
      setMelding({ tekst: t("form.err.required"), fout: true });
      return;
    }

    // Valideer de kortingsregels: vanaf-aantal >= 2, percentage 1-100.
    for (const rij of form.containerKorting) {
      const vanafAantal = Number(rij.vanafAantal);
      const kortingPct = Number(rij.kortingPct);
      if (
        !Number.isInteger(vanafAantal) ||
        vanafAantal < 2 ||
        !Number.isFinite(kortingPct) ||
        kortingPct <= 0 ||
        kortingPct > 100
      ) {
        setMelding({ tekst: t("inst.korting.fout"), fout: true });
        return;
      }
      inst.containerKorting.push({ vanafAantal, kortingPct });
    }
    inst.containerKorting.sort((a, b) => a.vanafAantal - b.vanafAantal);

    if (!isFirebaseConfigured()) {
      setMelding({ tekst: t("login.offline"), fout: true });
      return;
    }

    setBusy(true);
    try {
      await saveInstellingen(inst);
      setMelding({ tekst: t("inst.saved"), fout: false });
    } catch {
      setMelding({ tekst: t("inst.err.save"), fout: true });
    } finally {
      setBusy(false);
    }
  }

  // Live voorbeeld-matrix: rekent met de HUIDIGE formulier-waarden, dus ook
  // vóór het opslaan beweegt hij meteen mee met elke prijs- of korting-wijziging.
  const matrixPrijzen = form ? formNaarPrijsTabel(form) : null;
  const matrixKorting = form ? formNaarKortingRegels(form.containerKorting) : [];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-black tracking-tight text-kliko-navy sm:text-3xl">
        {t("inst.title")}
      </h1>
      <p className="mt-1 text-sm text-kliko-navy/60">{t("inst.sub")}</p>

      {!isEigenaar && officeUser.status === "office" && (
        <p className="mt-4 rounded-xl border border-kliko-yellow bg-kliko-yellow/15 px-4 py-3 text-sm font-semibold text-kliko-navy">
          {t("inst.readonly")}
        </p>
      )}

      {form === null ? (
        <p className="py-10 text-center text-sm font-semibold text-kliko-navy/50">
          {t("inst.loading")}
        </p>
      ) : (
        <form onSubmit={opslaan} className="mt-6 flex flex-col gap-5">
          {/* Prijstabel: per tier maand + jaar */}
          <section className="rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-kliko-blue">
              {t("inst.prijzen")}
            </h2>
            <p className="mt-1 text-xs text-kliko-navy/50">{t("inst.prijzen.hint")}</p>
            <div className="mt-4 flex flex-col gap-6">
              {TYPES.map(({ type, label }) => (
                <div key={type}>
                  <h3 className="font-bold text-kliko-navy">{t(label)}</h3>
                  <div className="mt-2 flex flex-col gap-3">
                    {FREQUENTIES.map((f) => {
                      const maandNum = Number(form.prijzen[type][f].maand);
                      const maalTwaalf = Number.isFinite(maandNum) && maandNum > 0
                        ? maandNum * 12
                        : null;
                      return (
                        <div
                          key={f}
                          className="rounded-xl border border-kliko-navy/10 bg-kliko-navy/[0.02] p-3"
                        >
                          <span className="text-xs font-bold text-kliko-navy/60">
                            {t(FREQ_LABEL[f])}
                          </span>
                          <div className="mt-2 grid gap-3 sm:grid-cols-2">
                            <div>
                              <label
                                htmlFor={`prijs-${type}-${f}-maand`}
                                className="mb-1 block text-xs font-semibold text-kliko-navy/50"
                              >
                                {t("inst.prijs.maand")}
                              </label>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-kliko-navy/50">$</span>
                                <input
                                  id={`prijs-${type}-${f}-maand`}
                                  type="number"
                                  min={1}
                                  step="0.01"
                                  inputMode="decimal"
                                  disabled={!isEigenaar}
                                  className={inputCls}
                                  value={form.prijzen[type][f].maand}
                                  onChange={(e) =>
                                    zetPrijs(type, f, "maand", e.target.value)
                                  }
                                />
                              </div>
                            </div>
                            <div>
                              <label
                                htmlFor={`prijs-${type}-${f}-jaar`}
                                className="mb-1 block text-xs font-semibold text-kliko-navy/50"
                              >
                                {t("inst.prijs.jaar")}
                              </label>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-kliko-navy/50">$</span>
                                <input
                                  id={`prijs-${type}-${f}-jaar`}
                                  type="number"
                                  min={1}
                                  step="0.01"
                                  inputMode="decimal"
                                  disabled={!isEigenaar}
                                  className={inputCls}
                                  value={form.prijzen[type][f].jaar}
                                  onChange={(e) =>
                                    zetPrijs(type, f, "jaar", e.target.value)
                                  }
                                />
                              </div>
                              {/* Puur informatief: maand x 12, zodat de korting
                                  van de jaarprijs zichtbaar is. Wordt niet opgeslagen. */}
                              {maalTwaalf !== null && (
                                <p className="mt-1 text-xs tabular-nums text-kliko-navy/50">
                                  {t("inst.prijs.maal12")}: {formatUsd(maalTwaalf)}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Container-korting */}
          <section className="rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-kliko-blue">
                {t("inst.korting")}
              </h2>
              {isEigenaar && (
                <button
                  type="button"
                  onClick={voegKortingToe}
                  className="rounded-full bg-kliko-navy px-3.5 py-1.5 text-xs font-bold text-white hover:bg-kliko-navy/90"
                >
                  {t("inst.korting.toevoegen")}
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-kliko-navy/50">{t("inst.korting.hint")}</p>

            {form.containerKorting.length === 0 ? (
              <p className="mt-3 rounded-xl bg-kliko-navy/[0.03] px-4 py-3 text-sm font-semibold text-kliko-navy/50">
                {t("inst.korting.leeg")}
              </p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                {form.containerKorting.map((rij, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 rounded-xl border border-kliko-navy/10 bg-kliko-navy/[0.02] p-3"
                  >
                    <div>
                      <label
                        htmlFor={`korting-${idx}-vanaf`}
                        className="mb-1 block text-xs font-semibold text-kliko-navy/50"
                      >
                        {t("inst.korting.vanaf")}
                      </label>
                      <input
                        id={`korting-${idx}-vanaf`}
                        type="number"
                        min={2}
                        step="1"
                        inputMode="numeric"
                        disabled={!isEigenaar}
                        className={smallInputCls}
                        value={rij.vanafAantal}
                        onChange={(e) => zetKorting(idx, "vanafAantal", e.target.value)}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`korting-${idx}-pct`}
                        className="mb-1 block text-xs font-semibold text-kliko-navy/50"
                      >
                        {t("inst.korting.pct")}
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          id={`korting-${idx}-pct`}
                          type="number"
                          min={1}
                          max={100}
                          step="1"
                          inputMode="numeric"
                          disabled={!isEigenaar}
                          className={smallInputCls}
                          value={rij.kortingPct}
                          onChange={(e) => zetKorting(idx, "kortingPct", e.target.value)}
                        />
                        <span className="font-bold text-kliko-navy/50">%</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => verwijderKorting(idx)}
                      disabled={!isEigenaar}
                      aria-label={t("inst.korting.verwijderen")}
                      className="mb-1 rounded-full px-2.5 py-1 text-sm font-bold text-kliko-red hover:bg-kliko-red/10 disabled:cursor-not-allowed disabled:text-kliko-navy/20"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Live voorbeeld: totale maandprijs bij 1, 2 en 3 containers.
              Alle containers van een klant zitten op 1 abonnement; de cel is
              dus het totaal voor alle containers samen, met korting. */}
          <section className="rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-kliko-blue">
              {t("inst.matrix")}
            </h2>
            <p className="mt-1 text-xs text-kliko-navy/50">{t("inst.matrix.hint")}</p>
            <div className="mt-4 flex flex-col gap-5">
              {TYPES.map(({ type, label }) => (
                <div key={type}>
                  <h3 className="font-bold text-kliko-navy">{t(label)}</h3>
                  <table className="mt-2 w-full table-fixed border-separate border-spacing-0 overflow-hidden rounded-xl border border-kliko-navy/10 text-left">
                    <thead>
                      <tr className="bg-kliko-navy/[0.04]">
                        <th className="px-2 py-2 sm:px-3" aria-hidden="true" />
                        {MATRIX_AANTALLEN.map((n) => {
                          const pct = kortingPctVoorAantal(matrixKorting, n);
                          return (
                            <th key={n} className="px-2 py-2 align-top sm:px-3">
                              <span className="block text-xs font-bold text-kliko-navy">
                                {n === 1
                                  ? t("inst.matrix.kolom1")
                                  : t("inst.matrix.kolomN").replace("{n}", String(n))}
                              </span>
                              <span
                                className={`block text-[11px] font-semibold ${
                                  pct > 0 ? "text-kliko-blue" : "text-kliko-navy/40"
                                }`}
                              >
                                {pct > 0
                                  ? t("inst.matrix.korting").replace("{pct}", String(pct))
                                  : t("inst.matrix.geenkorting")}
                              </span>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {FREQUENTIES.map((f) => (
                        <tr key={f} className="border-t border-kliko-navy/10">
                          <th
                            scope="row"
                            className="border-t border-kliko-navy/10 px-2 py-2 text-xs font-semibold text-kliko-navy/60 sm:px-3"
                          >
                            {t(FREQ_LABEL[f])}
                          </th>
                          {MATRIX_AANTALLEN.map((n) => {
                            const maand = matrixPrijzen
                              ? totaalMaandPrijs(type, f, n, matrixPrijzen, matrixKorting)
                              : NaN;
                            const jaar = matrixPrijzen
                              ? totaalJaarPrijs(type, f, n, matrixPrijzen, matrixKorting)
                              : NaN;
                            return (
                              <td
                                key={n}
                                className="border-t border-kliko-navy/10 px-2 py-2 align-top sm:px-3"
                              >
                                <span className="block text-sm font-black tabular-nums text-kliko-navy">
                                  {Number.isFinite(maand) && maand > 0
                                    ? formatUsd(maand)
                                    : "-"}
                                </span>
                                <span className="block text-[11px] tabular-nums text-kliko-navy/50">
                                  {Number.isFinite(jaar) && jaar > 0
                                    ? `${t("inst.matrix.jaar")}: ${formatUsd(jaar)}`
                                    : "-"}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </section>

          {/* Offerte-cadeaus (voorheen onder Verkoop > Prijsbeleid) */}
          <section className="rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-kliko-blue">
              {t("inst.cadeaus")}
            </h2>
            <p className="mt-1 text-xs text-kliko-navy/50">{t("inst.cadeaus.hint")}</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="cadeau-welkom"
                  className="mb-1 block text-xs font-bold text-kliko-navy/60"
                >
                  {t("inst.cadeau.welkom")}
                </label>
                <input
                  id="cadeau-welkom"
                  disabled={!isEigenaar}
                  className={smallInputCls}
                  value={form.cadeauWelkom}
                  onChange={(e) =>
                    setForm((h) => (h ? { ...h, cadeauWelkom: e.target.value } : h))
                  }
                />
              </div>
              <div>
                <label
                  htmlFor="cadeau-jaar"
                  className="mb-1 block text-xs font-bold text-kliko-navy/60"
                >
                  {t("inst.cadeau.jaar")}
                </label>
                <input
                  id="cadeau-jaar"
                  disabled={!isEigenaar}
                  className={smallInputCls}
                  value={form.cadeauJaarcontract}
                  onChange={(e) =>
                    setForm((h) =>
                      h ? { ...h, cadeauJaarcontract: e.target.value } : h
                    )
                  }
                />
              </div>
            </div>
          </section>

          {/* Capaciteit */}
          <section className="rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-kliko-blue">
              {t("inst.capaciteit")}
            </h2>
            <p className="mt-1 text-xs text-kliko-navy/50">{t("inst.capaciteit.hint")}</p>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              disabled={!isEigenaar}
              aria-label={t("inst.capaciteit")}
              className={`${inputCls} mt-3 max-w-40`}
              value={form.containersPerDag}
              onChange={(e) =>
                setForm((huidig) =>
                  huidig ? { ...huidig, containersPerDag: e.target.value } : huidig
                )
              }
            />
          </section>

          {melding && (
            <p
              role="alert"
              className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
                melding.fout
                  ? "border-kliko-red/30 bg-kliko-red/10 text-kliko-red"
                  : "border-kliko-blue/30 bg-kliko-blue/10 text-kliko-blue"
              }`}
            >
              {melding.tekst}
            </p>
          )}

          {isEigenaar && (
            <button
              type="submit"
              disabled={busy}
              className="self-start rounded-full bg-kliko-blue px-6 py-3 font-bold text-white transition-transform hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? t("detail.busy") : t("inst.save")}
            </button>
          )}
        </form>
      )}
    </div>
  );
}
