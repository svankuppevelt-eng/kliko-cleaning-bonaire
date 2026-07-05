"use client";

// Office weekplanning: vaste schoonmaakdagen (ma t/m za) met capaciteit per dag
// (office-instelbaar via /beheer/instellingen) en filter op buurt.
// Alleen actieve abonnementen. Vaste dag wijzigen = optimistic update + rollback.
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  listAbonnementenPerKlant,
  listKlanten,
  updateAbonnement,
} from "@/lib/data/klanten";
import { WERKDAGEN } from "@/lib/data/planning";
import { useInstellingen } from "@/lib/use-instellingen";
import { useActieveBuurten } from "@/lib/use-buurten";
import type { Buurt } from "@/lib/data/buurten";
import type { Abonnement, Klant, Weekdag } from "@/lib/data/types";

const FREQ_LABEL: Record<number, string> = {
  1: "price.f1",
  2: "price.f2",
  4: "price.f4",
};

/**
 * Label "Selibon: dinsdag ochtend" voor bij een wijk-kop, zodat office de
 * route kan afstemmen op de afvalophaaldag van Selibon. Onbekend = null
 * (dan tonen we niets).
 */
function selibonTekst(
  buurt: Buurt | undefined,
  t: (key: string) => string
): string | null {
  if (!buurt || (buurt.selibonDag == null && buurt.selibonDagdeel == null)) {
    return null;
  }
  const delen: string[] = [];
  if (buurt.selibonDag != null) delen.push(t(`dag.${buurt.selibonDag}`));
  if (buurt.selibonDagdeel) delen.push(t(`dagdeel.${buurt.selibonDagdeel}`));
  return `${t("selibon.label")}: ${delen.join(" ")}`;
}

interface Rij {
  klant: Klant;
  abo: Abonnement;
}

export default function PlanningPage() {
  const { t } = useI18n();
  const { instellingen } = useInstellingen();
  const { buurten } = useActieveBuurten();
  const capaciteit = instellingen.containersPerDag;

  // Zonder Firebase-config meteen een lege lijst (lazy initializer).
  const [rijen, setRijen] = useState<Rij[] | null>(() =>
    isFirebaseConfigured() ? null : []
  );
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [buurtFilter, setBuurtFilter] = useState("");

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    Promise.all([listKlanten(), listAbonnementenPerKlant()])
      .then(([klanten, abosPerKlant]) => {
        const r: Rij[] = [];
        for (const klant of klanten) {
          for (const abo of abosPerKlant.get(klant.id) ?? []) {
            if (abo.status === "actief") r.push({ klant, abo });
          }
        }
        setRijen(r);
      })
      .catch(() => setLoadError(true));
  }, []);

  // Route-volgorde: buurten in office-volgorde (zoals de schoonmaker ze op
  // /vandaag rijdt), onbekende buurten achteraan, binnen een buurt op naam.
  const buurtVolgorde = useMemo(
    () => new Map(buurten.map((b) => [b.naam, b.volgorde])),
    [buurten]
  );
  // Voor de Selibon-info bij de wijk-koppen: buurt opzoeken op naam.
  const buurtPerNaam = useMemo(
    () => new Map(buurten.map((b) => [b.naam, b])),
    [buurten]
  );
  const gesorteerd = useMemo(() => {
    const lijst = [...(rijen ?? [])];
    lijst.sort((a, b) => {
      const va = buurtVolgorde.get(a.klant.wijk) ?? Number.MAX_SAFE_INTEGER;
      const vb = buurtVolgorde.get(b.klant.wijk) ?? Number.MAX_SAFE_INTEGER;
      return (
        va - vb ||
        a.klant.wijk.localeCompare(b.klant.wijk) ||
        a.klant.naam.localeCompare(b.klant.naam)
      );
    });
    return lijst;
  }, [rijen, buurtVolgorde]);

  // Filter-opties: actieve buurten + wijken van klanten buiten de lijst.
  const filterOpties = useMemo(() => {
    const uitLijst = buurten.map((b) => b.naam);
    const extra = Array.from(
      new Set((rijen ?? []).map((r) => r.klant.wijk).filter(Boolean))
    )
      .filter((w) => !uitLijst.includes(w))
      .sort();
    return [...uitLijst, ...extra];
  }, [buurten, rijen]);

  const gefilterd = useMemo(
    () =>
      buurtFilter
        ? gesorteerd.filter((r) => r.klant.wijk === buurtFilter)
        : gesorteerd,
    [gesorteerd, buurtFilter]
  );

  const nietIngepland = useMemo(
    () => gefilterd.filter((r) => !r.abo.vasteDag),
    [gefilterd]
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

      {/* Filter op buurt */}
      <div className="mt-4">
        <select
          value={buurtFilter}
          onChange={(e) => setBuurtFilter(e.target.value)}
          aria-label={t("beheer.filter.wijk")}
          className="w-full rounded-xl border border-kliko-navy/20 bg-white px-3 py-2.5 text-sm font-semibold text-kliko-navy focus:border-kliko-blue focus:outline-none sm:w-auto"
        >
          <option value="">{t("beheer.filter.wijk")}</option>
          {filterOpties.map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
      </div>

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
              const vanDag = gefilterd.filter((r) => r.abo.vasteDag === dag);
              // Capaciteit altijd over ALLE klanten van de dag rekenen, ook
              // met een actief buurt-filter: het is een fysieke daglimiet.
              const somKlikos = rijen
                .filter((r) => r.abo.vasteDag === dag)
                .reduce((som, r) => som + (r.klant.aantalKlikos || 0), 0);
              const over = somKlikos > capaciteit;
              const pct = Math.min(
                100,
                Math.round((somKlikos / capaciteit) * 100)
              );
              // Groeperen per wijk, in route-volgorde (gefilterd is al op
              // buurt-volgorde + naam gesorteerd).
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
                      {somKlikos} / {capaciteit} {t("beheer.klikos")}
                    </span>
                  </div>

                  {/* Capaciteitsbalk */}
                  <div
                    className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-kliko-navy/10"
                    role="progressbar"
                    aria-label={t("plan.cap.label")}
                    aria-valuenow={somKlikos}
                    aria-valuemin={0}
                    aria-valuemax={capaciteit}
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
                      {wijken.map((wijk) => {
                        const selibon = selibonTekst(buurtPerNaam.get(wijk), t);
                        return (
                          <div key={wijk}>
                            <h3 className="flex flex-wrap items-baseline gap-x-2 text-xs font-bold uppercase tracking-wider text-kliko-blue">
                              {wijk}
                              {selibon && (
                                <span className="font-semibold normal-case tracking-normal text-kliko-navy/50">
                                  {selibon}
                                </span>
                              )}
                            </h3>
                            <ul className="mt-1.5 flex flex-col gap-2">
                              {vanDag
                                .filter((r) => r.klant.wijk === wijk)
                                .map(klantRij)}
                            </ul>
                          </div>
                        );
                      })}
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
