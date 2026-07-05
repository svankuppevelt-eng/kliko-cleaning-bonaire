"use client";

// Office-startscherm (/beheer/overzicht): de dag in een oogopslag.
// Samenvattingstegels (stops vandaag, openstaande facturen, nieuwe
// aanmeldingen, actieve abonnees, MRR), aandachtspunten met een link naar de
// relevante pagina, de eerste stops van vandaag en snelle acties.
// Hergebruikt de bestaande data-helpers; alle bedragen in dollarcenten.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { isFirebaseConfigured } from "@/lib/firebase";
import { listAbonnementenPerKlant, listKlanten } from "@/lib/data/klanten";
import { listFacturen } from "@/lib/data/facturen";
import { effectieveStatus, formatUsdCent, type Factuur } from "@/lib/data/facturen-types";
import { isVandaagDue, WERKDAGEN } from "@/lib/data/planning";
import { berekenMrrCent, telActieveAbonnees } from "@/lib/data/finance";
import { useInstellingen } from "@/lib/use-instellingen";
import { useOfficeUser } from "@/lib/use-office-user";
import type { Abonnement, Klant, Weekdag } from "@/lib/data/types";

const FREQ_LABEL: Record<number, string> = {
  1: "price.f1",
  2: "price.f2",
  4: "price.f4",
};

const MAX_STOPS_IN_LIJST = 5;

interface Data {
  klanten: Klant[];
  abosPerKlant: Map<string, Abonnement[]>;
  facturen: Factuur[];
}

interface Stop {
  klant: Klant;
  abo: Abonnement;
}

// ----- kleine bouwstenen ----------------------------------------------------

function KpiTegel({
  label,
  waarde,
  sub,
}: {
  label: string;
  waarde: string;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-kliko-navy/10 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-kliko-navy/50">
        {label}
      </p>
      <p className="mt-1 text-2xl font-black tabular-nums text-kliko-navy">
        {waarde}
      </p>
      {sub ? <p className="mt-0.5 text-xs text-kliko-navy/55">{sub}</p> : null}
    </div>
  );
}

type AlertToon = "rood" | "geel";

function AlertRij({
  toon,
  tekst,
  linkHref,
  linkLabel,
}: {
  toon: AlertToon;
  tekst: string;
  linkHref: string;
  linkLabel: string;
}) {
  const kleuren =
    toon === "rood"
      ? "border-kliko-red/30 bg-kliko-red/10 text-kliko-red"
      : "border-kliko-yellow bg-kliko-yellow/15 text-kliko-navy";
  return (
    <li
      className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 ${kleuren}`}
    >
      <span className="text-sm font-semibold">{tekst}</span>
      <Link
        href={linkHref}
        className="text-sm font-bold text-kliko-blue underline-offset-2 hover:underline"
      >
        {linkLabel}
      </Link>
    </li>
  );
}

export default function OverzichtPage() {
  const { t } = useI18n();
  const user = useOfficeUser();
  const { instellingen } = useInstellingen();
  const capaciteit = instellingen.containersPerDag;

  // Zonder Firebase-config meteen lege data (lazy initializer), net als de
  // andere office-pagina's: het scherm toont dan de lege staten.
  const [data, setData] = useState<Data | null>(() =>
    isFirebaseConfigured()
      ? null
      : { klanten: [], abosPerKlant: new Map(), facturen: [] }
  );
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    Promise.all([listKlanten(), listAbonnementenPerKlant(), listFacturen()])
      .then(([klanten, abosPerKlant, facturen]) =>
        setData({ klanten, abosPerKlant, facturen })
      )
      .catch(() => setLoadError(true));
  }, []);

  const nu = useMemo(() => new Date(), []);

  const berekend = useMemo(() => {
    if (!data) return null;
    const { klanten, abosPerKlant, facturen } = data;
    const alleAbos = Array.from(abosPerKlant.values()).flat();

    // Stops van vandaag: actieve abonnementen die volgens frequentie + vaste
    // dag vandaag aan de beurt zijn (zelfde logica als de /vandaag-pagina).
    const stops: Stop[] = [];
    for (const klant of klanten) {
      for (const abo of abosPerKlant.get(klant.id) ?? []) {
        if (isVandaagDue(abo, nu)) stops.push({ klant, abo });
      }
    }
    stops.sort((a, b) => a.klant.wijk.localeCompare(b.klant.wijk));

    // Openstaande facturen: verstuurd of (afgeleid) te laat.
    const open = facturen.filter((f) =>
      ["verstuurd", "teLaat"].includes(effectieveStatus(f))
    );
    const openBedragCent = open.reduce((som, f) => som + f.totaalCentIncl, 0);
    const teLaat = facturen.filter(
      (f) => effectieveStatus(f) === "teLaat"
    ).length;

    // Nieuwe aanmeldingen: klanten aangemaakt in de laatste 7 dagen.
    const grens = new Date(nu.getTime() - 7 * 86_400_000).toISOString();
    const nieuweKlanten = klanten.filter((k) => k.aangemaaktOp >= grens).length;

    const actieveAbos = alleAbos.filter((a) => a.status === "actief");
    const nietIngepland = actieveAbos.filter((a) => !a.vasteDag).length;
    const pauze = alleAbos.filter((a) => a.status === "pauze").length;

    // Dagen boven capaciteit: som kliko's van actieve abonnementen per vaste dag.
    const klantById = new Map(klanten.map((k) => [k.id, k]));
    const klikosPerDag = new Map<Weekdag, number>(WERKDAGEN.map((d) => [d, 0]));
    for (const abo of actieveAbos) {
      if (!abo.vasteDag) continue;
      const klikos = klantById.get(abo.klantId)?.aantalKlikos ?? 0;
      klikosPerDag.set(abo.vasteDag, (klikosPerDag.get(abo.vasteDag) ?? 0) + klikos);
    }
    const overCapaciteit = WERKDAGEN.map((dag) => ({
      dag,
      klikos: klikosPerDag.get(dag) ?? 0,
    })).filter((rij) => rij.klikos > capaciteit);

    return {
      stops,
      openAantal: open.length,
      openBedragCent,
      teLaat,
      nieuweKlanten,
      actieveAbonnees: telActieveAbonnees(alleAbos),
      mrrCent: berekenMrrCent(alleAbos),
      nietIngepland,
      pauze,
      overCapaciteit,
      geenKlanten: klanten.length === 0,
    };
  }, [data, nu, capaciteit]);

  // "1 factuur is te laat" vs "3 facturen zijn te laat": aparte keys per vorm.
  const telTekst = (n: number, keyBasis: string) =>
    n === 1 ? t(`${keyBasis}.een`) : `${n} ${t(`${keyBasis}.meer`)}`;

  const naam = user.status === "office" ? user.naam : "";

  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight text-kliko-navy sm:text-3xl">
        {t("ovz.title")}
        {naam ? (
          <span className="font-bold text-kliko-navy/40"> &middot; {naam}</span>
        ) : null}
      </h1>
      <p className="mt-1 text-sm text-kliko-navy/60">{t("ovz.sub")}</p>

      {loadError ? (
        <p className="mt-6 rounded-xl border border-kliko-red/30 bg-kliko-red/10 px-4 py-3 text-sm font-semibold text-kliko-red">
          {t("ovz.err.load")}
        </p>
      ) : !berekend ? (
        <p className="py-10 text-center text-sm font-semibold text-kliko-navy/50">
          {t("ovz.loading")}
        </p>
      ) : (
        <>
          {/* Samenvattingstegels: op mobiel gestapeld, daarna 2 en 5 kolommen */}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <KpiTegel
              label={t("ovz.kpi.stops")}
              waarde={String(berekend.stops.length)}
              sub={t("ovz.kpi.stops.sub")}
            />
            <KpiTegel
              label={t("ovz.kpi.open")}
              waarde={`${berekend.openAantal} / ${formatUsdCent(berekend.openBedragCent)}`}
              sub={t("ovz.kpi.open.sub")}
            />
            <KpiTegel
              label={t("ovz.kpi.nieuw")}
              waarde={String(berekend.nieuweKlanten)}
              sub={t("ovz.kpi.nieuw.sub")}
            />
            <KpiTegel
              label={t("ovz.kpi.abonnees")}
              waarde={String(berekend.actieveAbonnees)}
              sub={t("ovz.kpi.abonnees.sub")}
            />
            <KpiTegel
              label={t("ovz.kpi.mrr")}
              waarde={formatUsdCent(berekend.mrrCent)}
              sub={t("ovz.kpi.mrr.sub")}
            />
          </div>

          {berekend.geenKlanten ? (
            <p className="mt-6 rounded-2xl border border-kliko-navy/10 bg-white px-4 py-6 text-center text-sm font-semibold text-kliko-navy/55">
              {t("ovz.leeg")}
            </p>
          ) : null}

          {/* Aandachtspunten: alleen tonen als er iets is */}
          {(berekend.teLaat > 0 ||
            berekend.nietIngepland > 0 ||
            berekend.pauze > 0 ||
            berekend.overCapaciteit.length > 0) && (
            <section className="mt-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-kliko-navy">
                {t("ovz.aandacht")}
              </h2>
              <ul className="mt-3 flex flex-col gap-2">
                {berekend.teLaat > 0 && (
                  <AlertRij
                    toon="rood"
                    tekst={telTekst(berekend.teLaat, "ovz.alert.telaat")}
                    linkHref="/beheer/facturen"
                    linkLabel={t("ovz.naar.facturen")}
                  />
                )}
                {berekend.overCapaciteit.map((rij) => (
                  <AlertRij
                    key={rij.dag}
                    toon="rood"
                    tekst={`${t(`dag.${rij.dag}`)} ${t("ovz.alert.capaciteit")} (${rij.klikos} / ${capaciteit} ${t("beheer.klikos")})`}
                    linkHref="/beheer/planning"
                    linkLabel={t("ovz.naar.planning")}
                  />
                ))}
                {berekend.nietIngepland > 0 && (
                  <AlertRij
                    toon="geel"
                    tekst={telTekst(berekend.nietIngepland, "ovz.alert.nietingepland")}
                    linkHref="/beheer/planning"
                    linkLabel={t("ovz.naar.planning")}
                  />
                )}
                {berekend.pauze > 0 && (
                  <AlertRij
                    toon="geel"
                    tekst={telTekst(berekend.pauze, "ovz.alert.pauze")}
                    linkHref="/beheer"
                    linkLabel={t("ovz.naar.klanten")}
                  />
                )}
              </ul>
            </section>
          )}

          {/* Stops van vandaag (eerste 5) + snelle acties */}
          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_minmax(230px,0.6fr)]">
            <section className="rounded-2xl border border-kliko-navy/10 bg-white p-4 shadow-sm">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-sm font-bold text-kliko-navy">
                  {t("ovz.stops.title")}
                </h2>
                <Link
                  href="/vandaag"
                  className="text-sm font-bold text-kliko-blue underline-offset-2 hover:underline"
                >
                  {t("ovz.stops.alle")}
                </Link>
              </div>
              {berekend.stops.length === 0 ? (
                <p className="mt-3 py-6 text-center text-sm font-semibold text-kliko-navy/45">
                  {t("ovz.stops.leeg")}
                </p>
              ) : (
                <>
                  <ul className="mt-3 flex flex-col gap-2">
                    {berekend.stops.slice(0, MAX_STOPS_IN_LIJST).map((stop) => (
                      <li
                        key={stop.abo.id}
                        className="rounded-xl border border-kliko-navy/10 px-3 py-2.5"
                      >
                        <p className="truncate text-sm font-bold text-kliko-navy">
                          {stop.klant.naam}
                        </p>
                        <p className="text-xs text-kliko-navy/60">
                          {stop.klant.wijk} &middot; {stop.klant.aantalKlikos}{" "}
                          {t("beheer.klikos")} &middot;{" "}
                          {t(FREQ_LABEL[stop.abo.frequentie])}
                        </p>
                      </li>
                    ))}
                  </ul>
                  {berekend.stops.length > MAX_STOPS_IN_LIJST && (
                    <p className="mt-2 text-xs font-semibold text-kliko-navy/50">
                      + {berekend.stops.length - MAX_STOPS_IN_LIJST}{" "}
                      {t("ovz.stops.meer")}
                    </p>
                  )}
                </>
              )}
            </section>

            <section className="rounded-2xl border border-kliko-navy/10 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold text-kliko-navy">
                {t("ovz.acties")}
              </h2>
              <div className="mt-3 flex flex-col gap-2">
                <Link
                  href="/beheer/nieuw"
                  className="rounded-full bg-kliko-blue px-5 py-2.5 text-center text-sm font-bold text-white transition-transform hover:scale-[1.02]"
                >
                  {t("beheer.nieuw")}
                </Link>
                <Link
                  href="/beheer/facturen"
                  className="rounded-full border-2 border-kliko-blue px-5 py-2.5 text-center text-sm font-bold text-kliko-blue hover:bg-kliko-blue/5"
                >
                  {t("ovz.actie.facturen")}
                </Link>
                <Link
                  href="/beheer/planning"
                  className="rounded-full border-2 border-kliko-navy/20 px-5 py-2.5 text-center text-sm font-bold text-kliko-navy hover:border-kliko-navy/40"
                >
                  {t("plan.title")}
                </Link>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
