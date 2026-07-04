"use client";

// Office weekplanning: vaste schoonmaakdagen (ma t/m za) met capaciteit per dag.
// Alleen actieve abonnementen. Vaste dag wijzigen = optimistic update + rollback.
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  listAbonnementenPerKlant,
  listKlanten,
  updateAbonnement,
} from "@/lib/data/klanten";
import { CONTAINERS_PER_DAG, WERKDAGEN } from "@/lib/data/planning";
import type { Abonnement, Klant, Weekdag } from "@/lib/data/types";

const FREQ_LABEL: Record<number, string> = {
  1: "price.f1",
  2: "price.f2",
  4: "price.f4",
};

interface Rij {
  klant: Klant;
  abo: Abonnement;
}

export default function PlanningPage() {
  const { t } = useI18n();

  const [rijen, setRijen] = useState<Rij[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setRijen([]);
      return;
    }
    Promise.all([listKlanten(), listAbonnementenPerKlant()])
      .then(([klanten, abosPerKlant]) => {
        const r: Rij[] = [];
        for (const klant of klanten) {
          for (const abo of abosPerKlant.get(klant.id) ?? []) {
            if (abo.status === "actief") r.push({ klant, abo });
          }
        }
        r.sort(
          (a, b) =>
            a.klant.wijk.localeCompare(b.klant.wijk) ||
            a.klant.naam.localeCompare(b.klant.naam)
        );
        setRijen(r);
      })
      .catch(() => setLoadError(true));
  }, []);

  const nietIngepland = useMemo(
    () => (rijen ?? []).filter((r) => !r.abo.vasteDag),
    [rijen]
  );

  async function wijzigDag(rij: Rij, nieuweDag: Weekdag | null) {
    const oudeDag = rij.abo.vasteDag ?? null;
    if (oudeDag === nieuweDag) return;
    setSaveError(false);
    // Optimistic update: eerst de UI, dan Firestore; bij fout terugdraaien.
    const zetDag = (dag: Weekdag | null) =>
      setRijen((huidig) =>
        (huidig ?? []).map((r) =>
          r.abo.id === rij.abo.id ? { ...r, abo: { ...r.abo, vasteDag: dag } } : r
        )
      );
    zetDag(nieuweDag);
    try {
      await updateAbonnement(rij.abo.id, { vasteDag: nieuweDag });
    } catch {
      zetDag(oudeDag);
      setSaveError(true);
    }
  }

  function dagSelect(rij: Rij) {
    return (
      <select
        value={rij.abo.vasteDag ?? ""}
        onChange={(e) =>
          wijzigDag(
            rij,
            e.target.value === "" ? null : (Number(e.target.value) as Weekdag)
          )
        }
        aria-label={t("plan.dag.label")}
        className="rounded-lg border border-kliko-navy/20 bg-white px-2 py-1.5 text-xs font-semibold text-kliko-navy focus:border-kliko-blue focus:outline-none"
      >
        <option value="">{t("plan.optie.geen")}</option>
        {WERKDAGEN.map((d) => (
          <option key={d} value={d}>
            {t(`dag.${d}`)}
          </option>
        ))}
      </select>
    );
  }

  function klantRij(rij: Rij) {
    return (
      <li
        key={rij.abo.id}
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-kliko-navy/10 bg-white px-3 py-2.5"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-kliko-navy">
            {rij.klant.naam}
          </p>
          <p className="text-xs text-kliko-navy/60">
            {rij.klant.wijk} &middot; {rij.klant.aantalKlikos}{" "}
            {t("beheer.klikos")} &middot; {t(FREQ_LABEL[rij.abo.frequentie])}
          </p>
        </div>
        {dagSelect(rij)}
      </li>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight text-kliko-navy sm:text-3xl">
        {t("plan.title")}
      </h1>
      <p className="mt-1 text-sm text-kliko-navy/60">{t("plan.sub")}</p>

      {saveError && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-kliko-red/30 bg-kliko-red/10 px-4 py-3 text-sm font-semibold text-kliko-red"
        >
          {t("plan.err.save")}
        </p>
      )}

      {loadError ? (
        <p className="mt-6 rounded-xl border border-kliko-red/30 bg-kliko-red/10 px-4 py-3 text-sm font-semibold text-kliko-red">
          {t("beheer.err.load")}
        </p>
      ) : rijen === null ? (
        <p className="py-10 text-center text-sm font-semibold text-kliko-navy/50">
          {t("beheer.loading")}
        </p>
      ) : (
        <>
          {/* Nog niet ingeplande actieve abonnementen */}
          <section className="mt-6 rounded-2xl border border-kliko-yellow/70 bg-kliko-yellow/10 p-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-kliko-navy">
              {t("plan.nietIngepland")}
              <span className="ml-2 font-black text-kliko-navy/50">
                {nietIngepland.length}
              </span>
            </h2>
            {nietIngepland.length === 0 ? (
              <p className="mt-2 text-sm font-semibold text-kliko-navy/60">
                {t("plan.nietIngepland.leeg")}
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {nietIngepland.map(klantRij)}
              </ul>
            )}
          </section>

          {/* Week-overzicht: op mobiel onder elkaar, op breed scherm in kolommen */}
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {WERKDAGEN.map((dag) => {
              const vanDag = rijen.filter((r) => r.abo.vasteDag === dag);
              const somKlikos = vanDag.reduce(
                (som, r) => som + (r.klant.aantalKlikos || 0),
                0
              );
              const over = somKlikos > CONTAINERS_PER_DAG;
              const pct = Math.min(
                100,
                Math.round((somKlikos / CONTAINERS_PER_DAG) * 100)
              );
              // Groeperen per wijk (rijen zijn al op wijk + naam gesorteerd).
              const wijken = Array.from(new Set(vanDag.map((r) => r.klant.wijk)));
              return (
                <section
                  key={dag}
                  className="rounded-2xl border border-kliko-navy/10 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="font-black text-kliko-navy">{t(`dag.${dag}`)}</h2>
                    <span
                      className={`text-xs font-bold tabular-nums ${
                        over ? "text-kliko-red" : "text-kliko-navy/60"
                      }`}
                    >
                      {somKlikos} / {CONTAINERS_PER_DAG} {t("beheer.klikos")}
                    </span>
                  </div>

                  {/* Capaciteitsbalk */}
                  <div
                    className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-kliko-navy/10"
                    role="progressbar"
                    aria-label={t("plan.cap.label")}
                    aria-valuenow={somKlikos}
                    aria-valuemin={0}
                    aria-valuemax={CONTAINERS_PER_DAG}
                  >
                    <div
                      className={`h-full rounded-full ${
                        over ? "bg-kliko-red" : "bg-kliko-blue"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {over && (
                    <p className="mt-2 rounded-lg bg-kliko-red/10 px-3 py-2 text-xs font-bold text-kliko-red">
                      {t("plan.cap.over")}
                    </p>
                  )}

                  {vanDag.length === 0 ? (
                    <p className="mt-3 text-sm font-semibold text-kliko-navy/45">
                      {t("plan.leeg.dag")}
                    </p>
                  ) : (
                    <div className="mt-3 flex flex-col gap-3">
                      {wijken.map((wijk) => (
                        <div key={wijk}>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-kliko-blue">
                            {wijk}
                          </h3>
                          <ul className="mt-1.5 flex flex-col gap-2">
                            {vanDag
                              .filter((r) => r.klant.wijk === wijk)
                              .map(klantRij)}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
