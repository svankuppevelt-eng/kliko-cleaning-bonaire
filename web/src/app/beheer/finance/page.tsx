"use client";

// Finance-dashboard (office): KPI-tegels + grafieken over omzet, kosten,
// winst, abonnees, klanttypes, buurten en factuur-statussen.
// Alle bedragen in dollarcenten (integer); omzet = subtotaal EXCL ABB,
// want de ABB wordt afgedragen en is geen omzet. Kosten komen uit de
// office-beheerbare collectie `kosten` (invoer via /beheer/finance/kosten).
//
// Dataviz-afspraken: 1 y-as per grafiek, kleur volgt functie (omzet blauw,
// kosten amber, winst navy; status semantisch), tekst altijd in navy-inkt,
// recessief raster, tooltip op elke grafiek, legenda bij 2+ series.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "@/lib/i18n";
import { isFirebaseConfigured } from "@/lib/firebase";
import { listKlanten, listAbonnementenPerKlant } from "@/lib/data/klanten";
import { listFacturen, maandLabel } from "@/lib/data/facturen";
import { listKosten, type KostenPost } from "@/lib/data/kosten";
import { formatUsdCent, type Factuur } from "@/lib/data/facturen-types";
import type { Abonnement, Klant } from "@/lib/data/types";
import {
  abonneesPerMaand,
  abonnementenPerFrequentie,
  berekenArpuCent,
  berekenMaandCijfers,
  berekenMrrCent,
  huidigeMaand,
  kortMaandLabel,
  maandenReeks,
  omzetPerBuurt,
  omzetPerKlanttype,
  somMaandCijfers,
  statusVerdeling,
  telActieveAbonnees,
} from "@/lib/data/finance";

// ----- kleuren: functie-vast, niet gecycled -------------------------------
const KLEUR_OMZET = "#0077cc"; // kliko-blue
const KLEUR_KOSTEN = "#E39A1F"; // amber
const KLEUR_WINST = "#0d2b6a"; // kliko-navy
const KLEUR_HUISHOUDEN = "#0077cc";
const KLEUR_BEDRIJF = "#ffc20e"; // kliko-yellow
// Frequentie 1x/2x/4x is oplopend: sequential blauw licht -> donker.
const KLEUR_FREQ = ["#7fb9e0", "#0077cc", "#0d2b6a"];
// Status semantisch (altijd met label ernaast, nooit kleur-alleen).
const KLEUR_STATUS: Record<string, string> = {
  betaald: "#16a34a",
  verstuurd: "#0077cc",
  teLaat: "#e30613",
  concept: "#94a3b8",
};

// ----- inkt en raster (tekst nooit in de seriekleur) ----------------------
const INK = "#0d2b6a";
const INK_MUTED = "rgba(13,43,106,0.55)";
const GRID = "rgba(13,43,106,0.10)";

const AXIS_TICK = { fontSize: 11, fill: INK_MUTED } as const;

// Recharts geeft tooltip-waarden door als number | string | array | undefined;
// wij plotten alleen enkelvoudige getallen, dus dit vouwt dat veilig terug.
type TooltipWaarde =
  | number
  | string
  | ReadonlyArray<number | string>
  | undefined;
function tooltipGetal(v: TooltipWaarde): number {
  if (Array.isArray(v)) return Number(v[0] ?? 0);
  return Number(v ?? 0);
}

function axisDollar(cent: number): string {
  const d = cent / 100;
  if (Math.abs(d) >= 1000) {
    return `$${(d / 1000).toLocaleString("en-US", { maximumFractionDigits: 1 })}k`;
  }
  return `$${d.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

const TOOLTIP_BOX = {
  borderRadius: 12,
  border: "1px solid rgba(13,43,106,0.15)",
  background: "#ffffff",
  boxShadow: "0 4px 12px rgba(13,43,106,0.08)",
  fontSize: 12,
  fontWeight: 600,
  fontVariantNumeric: "tabular-nums",
} as const;
const TOOLTIP_LABEL = { color: INK, fontWeight: 700 } as const;
const TOOLTIP_ITEM = { color: INK } as const;

/** Legenda-tekst in inkt-kleur (recharts kleurt anders mee met de serie). */
function legendaInkt(value: string) {
  return <span style={{ color: INK, fontSize: 12, fontWeight: 600 }}>{value}</span>;
}

// ----- kleine bouwstenen ---------------------------------------------------
function Kaart({
  titel,
  children,
}: {
  titel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-kliko-navy/10 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-bold text-kliko-navy">{titel}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function LeegMelding({ tekst }: { tekst: string }) {
  return (
    <p className="py-12 text-center text-sm font-semibold text-kliko-navy/45">
      {tekst}
    </p>
  );
}

function KpiTegel({
  label,
  waarde,
  sub,
  negatief,
}: {
  label: string;
  waarde: string;
  sub: string;
  negatief?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-kliko-navy/10 bg-white p-4 shadow-sm">
      <p className="text-[0.7rem] font-bold uppercase tracking-[0.08em] text-kliko-navy/50">
        {label}
      </p>
      <p
        className={`mt-1 text-xl font-black tabular-nums sm:text-2xl ${
          negatief ? "text-kliko-red" : "text-kliko-navy"
        }`}
      >
        {waarde}
      </p>
      <p className="mt-0.5 text-xs text-kliko-navy/55">{sub}</p>
    </div>
  );
}

/** Donut met directe labels: gekleurde stip + naam + bedrag naast de grafiek. */
function DonutMetLabels({
  data,
  centerLabel,
  centerWaarde,
  formatWaarde,
}: {
  data: { naam: string; waarde: number; kleur: string; detail?: string }[];
  centerLabel: string;
  centerWaarde: string;
  formatWaarde: (v: number) => string;
}) {
  const zichtbaar = data.filter((d) => d.waarde > 0);
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="relative h-44 w-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={zichtbaar}
              dataKey="waarde"
              nameKey="naam"
              innerRadius="64%"
              outerRadius="96%"
              paddingAngle={2}
              stroke="#ffffff"
              strokeWidth={2}
            >
              {zichtbaar.map((d) => (
                <Cell key={d.naam} fill={d.kleur} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: TooltipWaarde) => [formatWaarde(tooltipGetal(v)), ""]}
              separator=""
              contentStyle={TOOLTIP_BOX}
              labelStyle={TOOLTIP_LABEL}
              itemStyle={TOOLTIP_ITEM}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base font-black tabular-nums text-kliko-navy">
            {centerWaarde}
          </span>
          <span className="text-[0.65rem] font-semibold text-kliko-navy/50">
            {centerLabel}
          </span>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-2">
        {data.map((d) => (
          <li key={d.naam} className="flex items-center gap-2 text-sm">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: d.kleur }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate font-semibold text-kliko-navy">
              {d.naam}
            </span>
            {d.detail ? (
              <span className="text-xs tabular-nums text-kliko-navy/50">
                {d.detail}
              </span>
            ) : null}
            <span className="font-bold tabular-nums text-kliko-navy">
              {formatWaarde(d.waarde)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ----- pagina --------------------------------------------------------------
type Periode = "12mnd" | "maand";

export default function FinancePage() {
  const { t } = useI18n();

  const [klanten, setKlanten] = useState<Klant[] | null>(null);
  const [abonnementen, setAbonnementen] = useState<Abonnement[] | null>(null);
  const [facturen, setFacturen] = useState<Factuur[] | null>(null);
  const [kosten, setKosten] = useState<KostenPost[] | null>(null);
  const [laadFout, setLaadFout] = useState(false);

  const [periode, setPeriode] = useState<Periode>("12mnd");
  const [maand, setMaand] = useState(huidigeMaand);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setKlanten([]);
      setAbonnementen([]);
      setFacturen([]);
      setKosten([]);
      return;
    }
    Promise.all([
      listKlanten(),
      listAbonnementenPerKlant(),
      listFacturen(),
      listKosten(),
    ])
      .then(([kl, abosMap, fa, ko]) => {
        setKlanten(kl);
        setAbonnementen(Array.from(abosMap.values()).flat());
        setFacturen(fa);
        setKosten(ko);
      })
      .catch(() => setLaadFout(true));
  }, []);

  const geladen =
    klanten !== null &&
    abonnementen !== null &&
    facturen !== null &&
    kosten !== null;

  // Geldige "yyyy-mm", anders de huidige maand (input type=month kan even leeg zijn).
  const eindMaand = /^\d{4}-(0[1-9]|1[0-2])$/.test(maand)
    ? maand
    : huidigeMaand();

  const maanden12 = useMemo(() => maandenReeks(eindMaand, 12), [eindMaand]);
  const periodeMaanden = useMemo(
    () => (periode === "maand" ? [eindMaand] : maanden12),
    [periode, eindMaand, maanden12]
  );

  const facturenPeriode = useMemo(
    () => (facturen ?? []).filter((f) => periodeMaanden.includes(f.periode)),
    [facturen, periodeMaanden]
  );
  const kostenPeriode = useMemo(
    () => (kosten ?? []).filter((k) => periodeMaanden.includes(k.maand)),
    [kosten, periodeMaanden]
  );

  // Tijdreeks (altijd 12 maanden, eindigend op de gekozen maand).
  const reeks = useMemo(
    () =>
      berekenMaandCijfers(maanden12, facturen ?? [], kosten ?? []).map((r) => ({
        ...r,
        label: kortMaandLabel(r.maand),
      })),
    [maanden12, facturen, kosten]
  );

  // KPI's over de gekozen periode.
  const kpi = useMemo(
    () =>
      somMaandCijfers(
        berekenMaandCijfers(periodeMaanden, facturenPeriode, kostenPeriode)
      ),
    [periodeMaanden, facturenPeriode, kostenPeriode]
  );
  const mrrCent = berekenMrrCent(abonnementen ?? []);
  const abonnees = telActieveAbonnees(abonnementen ?? []);
  const arpuCent = berekenArpuCent(abonnementen ?? []);

  // Verdeling-grafieken over de gekozen periode.
  const perType = useMemo(
    () => omzetPerKlanttype(facturenPeriode, klanten ?? []),
    [facturenPeriode, klanten]
  );
  const perBuurt = useMemo(
    () => omzetPerBuurt(facturenPeriode, 8),
    [facturenPeriode]
  );
  const perStatus = useMemo(
    () => statusVerdeling(facturenPeriode),
    [facturenPeriode]
  );
  const perFreq = useMemo(
    () =>
      abonnementenPerFrequentie(abonnementen ?? []).map((r, i) => ({
        ...r,
        label: t(`price.f${r.frequentie}`),
        kleur: KLEUR_FREQ[i],
      })),
    [abonnementen, t]
  );
  const abonneesReeks = useMemo(
    () =>
      abonneesPerMaand(abonnementen ?? [], maanden12).map((r) => ({
        ...r,
        label: kortMaandLabel(r.maand),
      })),
    [abonnementen, maanden12]
  );

  const heeftFacturen = (facturen ?? []).length > 0;
  const heeftPeriodeFacturen = facturenPeriode.length > 0;
  const heeftReeksData = reeks.some(
    (r) => r.omzetCent > 0 || r.kostenCent > 0
  );
  const heeftAbos = (abonnementen ?? []).length > 0;

  const segBtn = (actief: boolean) =>
    `rounded-full px-4 py-2 text-sm font-bold transition-colors ${
      actief
        ? "bg-kliko-navy text-white"
        : "bg-white text-kliko-navy/70 hover:text-kliko-navy border border-kliko-navy/15"
    }`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-kliko-navy sm:text-3xl">
            {t("fin.title")}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-kliko-navy/60">
            {t("fin.sub")}
          </p>
        </div>
        <Link
          href="/beheer/finance/kosten"
          className="rounded-full bg-kliko-blue px-4 py-2 text-sm font-bold text-white transition-transform hover:scale-[1.02]"
        >
          {t("fin.kosten.beheer")}
        </Link>
      </div>

      {laadFout ? (
        <p className="mt-6 rounded-xl border border-kliko-red/30 bg-kliko-red/10 px-4 py-3 text-sm font-semibold text-kliko-red">
          {t("fin.err.load")}
        </p>
      ) : !geladen ? (
        <p className="py-16 text-center text-sm font-semibold text-kliko-navy/50">
          {t("fin.loading")}
        </p>
      ) : (
        <>
          {/* Periode-filter: 1 rij boven de cijfers */}
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPeriode("12mnd")}
              className={segBtn(periode === "12mnd")}
            >
              {t("fin.periode.12mnd")}
            </button>
            <button
              onClick={() => setPeriode("maand")}
              className={segBtn(periode === "maand")}
            >
              {t("fin.periode.maand")}
            </button>
            {periode === "maand" && (
              <input
                type="month"
                value={maand}
                onChange={(e) => setMaand(e.target.value)}
                className="rounded-xl border border-kliko-navy/20 bg-white px-3 py-2 text-sm font-semibold text-kliko-navy focus:border-kliko-blue focus:outline-none"
              />
            )}
          </div>

          {!heeftFacturen && (
            <p className="mt-4 rounded-xl border border-kliko-yellow bg-kliko-yellow/15 px-4 py-3 text-sm font-semibold text-kliko-navy">
              {t("fin.leeg.facturen")}
            </p>
          )}

          {/* KPI-tegels */}
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiTegel
              label={t("fin.kpi.mrr")}
              waarde={formatUsdCent(mrrCent)}
              sub={t("fin.kpi.mrr.sub")}
            />
            <KpiTegel
              label={t("fin.kpi.abonnees")}
              waarde={String(abonnees)}
              sub={`${formatUsdCent(arpuCent)} ${t("fin.kpi.abonnees.sub")}`}
            />
            <KpiTegel
              label={t("fin.kpi.omzet")}
              waarde={formatUsdCent(kpi.omzetCent)}
              sub={t("fin.kpi.omzet.sub")}
            />
            <KpiTegel
              label={t("fin.kpi.betaald")}
              waarde={formatUsdCent(kpi.betaaldCent)}
              sub={t("fin.kpi.betaald.sub")}
            />
            <KpiTegel
              label={t("fin.kpi.open")}
              waarde={formatUsdCent(kpi.openstaandCent)}
              sub={t("fin.kpi.open.sub")}
            />
            <KpiTegel
              label={t("fin.kpi.kosten")}
              waarde={formatUsdCent(kpi.kostenCent)}
              sub={t("fin.kpi.kosten.sub")}
            />
            <KpiTegel
              label={t("fin.kpi.winst")}
              waarde={formatUsdCent(kpi.winstCent)}
              sub={t("fin.kpi.winst.sub")}
              negatief={kpi.winstCent < 0}
            />
            <KpiTegel
              label={t("fin.kpi.abb")}
              waarde={formatUsdCent(kpi.abbCent)}
              sub={t("fin.kpi.abb.sub")}
            />
          </div>

          {/* Grafieken */}
          <div className="mt-6 grid gap-4">
            {/* Omzet, kosten en winst per maand */}
            <Kaart titel={t("fin.chart.owk")}>
              {heeftReeksData ? (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={reeks} barGap={2} maxBarSize={16}>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={AXIS_TICK}
                        tickLine={false}
                        axisLine={{ stroke: GRID }}
                      />
                      <YAxis
                        tick={AXIS_TICK}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => axisDollar(Number(v))}
                        width={52}
                      />
                      <Tooltip
                        formatter={(v: TooltipWaarde, name?: string | number) => [
                          formatUsdCent(tooltipGetal(v)),
                          String(name ?? ""),
                        ]}
                        labelFormatter={(_, payload) =>
                          maandLabel(
                            (payload?.[0]?.payload as { maand?: string })
                              ?.maand ?? ""
                          )
                        }
                        contentStyle={TOOLTIP_BOX}
                        labelStyle={TOOLTIP_LABEL}
                        itemStyle={TOOLTIP_ITEM}
                        cursor={{ fill: "rgba(13,43,106,0.05)" }}
                      />
                      <Legend formatter={legendaInkt} iconType="circle" iconSize={9} />
                      <Bar
                        dataKey="omzetCent"
                        name={t("fin.serie.omzet")}
                        fill={KLEUR_OMZET}
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="kostenCent"
                        name={t("fin.serie.kosten")}
                        fill={KLEUR_KOSTEN}
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="winstCent"
                        name={t("fin.serie.winst")}
                        fill={KLEUR_WINST}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <LeegMelding tekst={t("fin.leeg")} />
              )}
            </Kaart>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Abonnees-ontwikkeling */}
              <Kaart titel={t("fin.chart.abonnees")}>
                {heeftAbos ? (
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={abonneesReeks}>
                        <CartesianGrid stroke={GRID} vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={AXIS_TICK}
                          tickLine={false}
                          axisLine={{ stroke: GRID }}
                        />
                        <YAxis
                          tick={AXIS_TICK}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                          width={36}
                        />
                        <Tooltip
                          formatter={(v: TooltipWaarde) => [
                            String(tooltipGetal(v)),
                            t("fin.serie.abonnees"),
                          ]}
                          labelFormatter={(_, payload) =>
                            maandLabel(
                              (payload?.[0]?.payload as { maand?: string })
                                ?.maand ?? ""
                            )
                          }
                          contentStyle={TOOLTIP_BOX}
                          labelStyle={TOOLTIP_LABEL}
                          itemStyle={TOOLTIP_ITEM}
                        />
                        <Area
                          type="monotone"
                          dataKey="aantal"
                          name={t("fin.serie.abonnees")}
                          stroke={KLEUR_OMZET}
                          strokeWidth={2}
                          fill="rgba(0,119,204,0.14)"
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <LeegMelding tekst={t("fin.leeg")} />
                )}
              </Kaart>

              {/* Omzet per klanttype */}
              <Kaart titel={t("fin.chart.klanttype")}>
                {heeftPeriodeFacturen ? (
                  <DonutMetLabels
                    data={[
                      {
                        naam: t("price.home"),
                        waarde: perType.huishouden,
                        kleur: KLEUR_HUISHOUDEN,
                      },
                      {
                        naam: t("price.biz"),
                        waarde: perType.bedrijf,
                        kleur: KLEUR_BEDRIJF,
                      },
                    ]}
                    centerLabel={t("fin.serie.omzet")}
                    centerWaarde={formatUsdCent(
                      perType.huishouden + perType.bedrijf
                    )}
                    formatWaarde={formatUsdCent}
                  />
                ) : (
                  <LeegMelding tekst={t("fin.leeg")} />
                )}
              </Kaart>

              {/* Abonnementen per frequentie */}
              <Kaart titel={t("fin.chart.freq")}>
                {heeftAbos ? (
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={perFreq} maxBarSize={56}>
                        <CartesianGrid stroke={GRID} vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={AXIS_TICK}
                          tickLine={false}
                          axisLine={{ stroke: GRID }}
                        />
                        <YAxis
                          tick={AXIS_TICK}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                          width={36}
                        />
                        <Tooltip
                          formatter={(v: TooltipWaarde) => [
                            `${tooltipGetal(v)} ${t("fin.aantal.abos")}`,
                            "",
                          ]}
                          separator=""
                          contentStyle={TOOLTIP_BOX}
                          labelStyle={TOOLTIP_LABEL}
                          itemStyle={TOOLTIP_ITEM}
                          cursor={{ fill: "rgba(13,43,106,0.05)" }}
                        />
                        <Bar dataKey="aantal" radius={[4, 4, 0, 0]}>
                          {perFreq.map((r) => (
                            <Cell key={r.frequentie} fill={r.kleur} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <LeegMelding tekst={t("fin.leeg")} />
                )}
              </Kaart>

              {/* Facturen-status */}
              <Kaart titel={t("fin.chart.status")}>
                {heeftPeriodeFacturen ? (
                  <DonutMetLabels
                    data={perStatus.map((s) => ({
                      naam: t(`fact.status.${s.status}`),
                      waarde: s.bedragCent,
                      kleur: KLEUR_STATUS[s.status],
                      detail: `${s.aantal} ${t("fin.aantal.facturen")}`,
                    }))}
                    centerLabel={t("fin.aantal.facturen")}
                    centerWaarde={String(facturenPeriode.length)}
                    formatWaarde={formatUsdCent}
                  />
                ) : (
                  <LeegMelding tekst={t("fin.leeg")} />
                )}
              </Kaart>
            </div>

            {/* Omzet per buurt */}
            <Kaart titel={t("fin.chart.buurt")}>
              {perBuurt.length > 0 ? (
                <div
                  className="w-full"
                  style={{ height: Math.max(140, perBuurt.length * 36 + 40) }}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={perBuurt}
                      layout="vertical"
                      maxBarSize={18}
                      margin={{ left: 8, right: 16 }}
                    >
                      <CartesianGrid stroke={GRID} horizontal={false} />
                      <XAxis
                        type="number"
                        tick={AXIS_TICK}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => axisDollar(Number(v))}
                      />
                      <YAxis
                        type="category"
                        dataKey="buurt"
                        tick={{ ...AXIS_TICK, fill: INK }}
                        tickLine={false}
                        axisLine={{ stroke: GRID }}
                        width={130}
                      />
                      <Tooltip
                        formatter={(v: TooltipWaarde) => [
                          formatUsdCent(tooltipGetal(v)),
                          "",
                        ]}
                        separator=""
                        contentStyle={TOOLTIP_BOX}
                        labelStyle={TOOLTIP_LABEL}
                        itemStyle={TOOLTIP_ITEM}
                        cursor={{ fill: "rgba(13,43,106,0.05)" }}
                      />
                      <Bar
                        dataKey="omzetCent"
                        fill={KLEUR_OMZET}
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <LeegMelding tekst={t("fin.leeg")} />
              )}
            </Kaart>
          </div>
        </>
      )}
    </div>
  );
}
