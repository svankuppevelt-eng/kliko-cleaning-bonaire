"use client";

// Office: prijstabel + dagcapaciteit bewerken (Firestore-doc instellingen/algemeen).
// Alleen rol "eigenaar" mag wijzigen; rol "kantoor" ziet de waarden read-only.
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { isFirebaseConfigured } from "@/lib/firebase";
import { useOfficeUser } from "@/lib/use-office-user";
import {
  getInstellingen,
  saveInstellingen,
  type Instellingen,
} from "@/lib/data/instellingen";
import { FREQUENTIES } from "@/lib/data/prijzen";
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

/** Formulier-state als strings, zodat tussenstanden tijdens typen niet breken. */
interface FormState {
  prijzen: Record<KlantType, Record<Frequentie, string>>;
  containersPerDag: string;
}

function naarForm(inst: Instellingen): FormState {
  const prijzen = {} as FormState["prijzen"];
  for (const { type } of TYPES) {
    prijzen[type] = {} as Record<Frequentie, string>;
    for (const f of FREQUENTIES) prijzen[type][f] = String(inst.prijzen[type][f]);
  }
  return { prijzen, containersPerDag: String(inst.containersPerDag) };
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

  function zetPrijs(type: KlantType, f: Frequentie, waarde: string) {
    setForm((huidig) =>
      huidig
        ? {
            ...huidig,
            prijzen: {
              ...huidig.prijzen,
              [type]: { ...huidig.prijzen[type], [f]: waarde },
            },
          }
        : huidig
    );
  }

  async function opslaan(e: React.FormEvent) {
    e.preventDefault();
    if (!form || busy || !isEigenaar) return;
    setMelding(null);

    // Valideer: alle velden positieve getallen.
    const inst: Instellingen = {
      prijzen: { huishouden: { 1: 0, 2: 0, 4: 0 }, bedrijf: { 1: 0, 2: 0, 4: 0 } },
      containersPerDag: Number(form.containersPerDag),
    };
    let geldig =
      Number.isFinite(inst.containersPerDag) && inst.containersPerDag > 0;
    for (const { type } of TYPES) {
      for (const f of FREQUENTIES) {
        const n = Number(form.prijzen[type][f]);
        if (!Number.isFinite(n) || n <= 0) geldig = false;
        inst.prijzen[type][f] = n;
      }
    }
    if (!geldig) {
      setMelding({ tekst: t("form.err.required"), fout: true });
      return;
    }
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

  return (
    <div className="mx-auto max-w-2xl">
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
          {/* Prijstabel */}
          <section className="rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-kliko-blue">
              {t("inst.prijzen")}
            </h2>
            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              {TYPES.map(({ type, label }) => (
                <div key={type}>
                  <h3 className="font-bold text-kliko-navy">{t(label)}</h3>
                  <div className="mt-2 flex flex-col gap-3">
                    {FREQUENTIES.map((f) => (
                      <div key={f}>
                        <label
                          htmlFor={`prijs-${type}-${f}`}
                          className="mb-1 block text-xs font-bold text-kliko-navy/60"
                        >
                          {t(FREQ_LABEL[f])}
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-kliko-navy/50">$</span>
                          <input
                            id={`prijs-${type}-${f}`}
                            type="number"
                            min={1}
                            step="0.01"
                            inputMode="decimal"
                            disabled={!isEigenaar}
                            className={inputCls}
                            value={form.prijzen[type][f]}
                            onChange={(e) => zetPrijs(type, f, e.target.value)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
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
