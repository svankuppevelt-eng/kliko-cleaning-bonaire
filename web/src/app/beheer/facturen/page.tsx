"use client";

// Facturen-lijst (office): filter op status en maand, kaart-weergave
// (mobiel-eerst, geen brede tabel) en "Maandfacturen genereren".
// Genereren maakt per actief abonnement een concept-factuur; idempotent
// per klant+periode (zie lib/data/facturen.ts).
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  genereerMaandFacturen,
  listFacturen,
  maandLabel,
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
  betaald: "bg-kliko-blue/10 text-kliko-blue",
  teLaat: "bg-kliko-red/10 text-kliko-red",
};

// Betaald verdient een eigen groen accent; de merkkleuren hebben geen groen,
// dus een ingetogen vaste tint (zelfde als de PDF-voettekst).
const BETAALD_STYLE = "bg-[#0d8a3e]/10 text-[#0d8a3e]";

function statusPillClass(status: FactuurStatus): string {
  return status === "betaald" ? BETAALD_STYLE : STATUS_STYLE[status];
}

const ALLE_STATUSSEN: FactuurStatus[] = ["concept", "verstuurd", "betaald", "teLaat"];

function huidigeMaand(): string {
  return new Date().toISOString().slice(0, 7);
}

export default function FacturenPage() {
  const { t } = useI18n();

  const [facturen, setFacturen] = useState<Factuur[] | null>(() =>
    isFirebaseConfigured() ? null : []
  );
  const [laadFout, setLaadFout] = useState(false);

  const [statusFilter, setStatusFilter] = useState<"" | FactuurStatus>("");
  const [maandFilter, setMaandFilter] = useState("");

  // Genereer-paneel
  const [toonGenereer, setToonGenereer] = useState(false);
  const [genMaand, setGenMaand] = useState(huidigeMaand);
  const [genBezig, setGenBezig] = useState(false);
  const [genResultaat, setGenResultaat] = useState<
    { aangemaakt: number; overgeslagen: number } | null
  >(null);
  const [genFout, setGenFout] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    listFacturen()
      .then(setFacturen)
      .catch(() => setLaadFout(true));
  }, []);

  const maanden = useMemo(() => {
    const set = new Set((facturen ?? []).map((f) => f.periode));
    return Array.from(set).sort().reverse();
  }, [facturen]);

  const zichtbaar = useMemo(() => {
    return (facturen ?? []).filter((f) => {
      if (maandFilter && f.periode !== maandFilter) return false;
      if (statusFilter && effectieveStatus(f) !== statusFilter) return false;
      return true;
    });
  }, [facturen, statusFilter, maandFilter]);

  async function genereer() {
    if (genBezig || !/^\d{4}-(0[1-9]|1[0-2])$/.test(genMaand)) return;
    setGenBezig(true);
    setGenFout(false);
    setGenResultaat(null);
    try {
      const resultaat = await genereerMaandFacturen(genMaand);
      setGenResultaat(resultaat);
      setFacturen(await listFacturen());
    } catch {
      setGenFout(true);
    } finally {
      setGenBezig(false);
    }
  }

  const selectCls =
    "rounded-xl border border-kliko-navy/20 bg-white px-3 py-2.5 text-sm font-semibold text-kliko-navy focus:border-kliko-blue focus:outline-none";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black tracking-tight text-kliko-navy sm:text-3xl">
          {t("fact.title")}
          {facturen && (
            <span className="ml-2 align-middle text-base font-bold text-kliko-navy/40">
              {zichtbaar.length}
            </span>
          )}
        </h1>
        <button
          onClick={() => {
            setToonGenereer((v) => !v);
            setGenResultaat(null);
            setGenFout(false);
          }}
          className="rounded-full bg-kliko-blue px-4 py-2 text-sm font-bold text-white transition-transform hover:scale-[1.02]"
        >
          {t("fact.genereer")}
        </button>
      </div>

      {/* Genereer-paneel */}
      {toonGenereer && (
        <div className="mt-5 rounded-2xl border border-kliko-navy/10 bg-white p-4 shadow-sm">
          <p className="text-sm text-kliko-navy/70">{t("fact.genereer.uitleg")}</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-sm font-semibold text-kliko-navy">
              {t("fact.genereer.maand")}
              <input
                type="month"
                value={genMaand}
                onChange={(e) => setGenMaand(e.target.value)}
                className="rounded-xl border border-kliko-navy/20 bg-white px-3 py-2 text-sm font-semibold text-kliko-navy focus:border-kliko-blue focus:outline-none"
              />
            </label>
            <button
              onClick={genereer}
              disabled={genBezig}
              className="rounded-full bg-kliko-navy px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {genBezig ? t("fact.genereer.busy") : t("fact.genereer.start")}
            </button>
          </div>
          {genResultaat && (
            <p className="mt-3 rounded-xl bg-kliko-blue/10 px-4 py-2.5 text-sm font-semibold text-kliko-blue">
              {genResultaat.aangemaakt} {t("fact.gen.aangemaakt")},{" "}
              {genResultaat.overgeslagen} {t("fact.gen.overgeslagen")}
            </p>
          )}
          {genFout && (
            <p className="mt-3 rounded-xl border border-kliko-red/30 bg-kliko-red/10 px-4 py-2.5 text-sm font-semibold text-kliko-red">
              {t("fact.gen.err")}
            </p>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="mt-5 grid grid-cols-2 gap-2 sm:flex">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "" | FactuurStatus)}
          className={selectCls}
        >
          <option value="">{t("fact.filter.status")}</option>
          {ALLE_STATUSSEN.map((s) => (
            <option key={s} value={s}>
              {t(`fact.status.${s}`)}
            </option>
          ))}
        </select>
        <select
          value={maandFilter}
          onChange={(e) => setMaandFilter(e.target.value)}
          className={selectCls}
        >
          <option value="">{t("fact.filter.maand")}</option>
          {maanden.map((m) => (
            <option key={m} value={m}>
              {maandLabel(m)}
            </option>
          ))}
        </select>
      </div>

      {/* Lijst */}
      <div className="mt-6">
        {laadFout ? (
          <p className="rounded-xl border border-kliko-red/30 bg-kliko-red/10 px-4 py-3 text-sm font-semibold text-kliko-red">
            {t("fact.err.load")}
          </p>
        ) : facturen === null ? (
          <p className="py-10 text-center text-sm font-semibold text-kliko-navy/50">
            {t("fact.loading")}
          </p>
        ) : zichtbaar.length === 0 ? (
          <p className="py-10 text-center text-sm font-semibold text-kliko-navy/50">
            {t("fact.empty")}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {zichtbaar.map((f) => {
              const status = effectieveStatus(f);
              return (
                <li key={f.id}>
                  <Link
                    href={`/beheer/facturen/${f.id}`}
                    className="block rounded-2xl border border-kliko-navy/10 bg-white p-4 shadow-sm transition-colors hover:border-kliko-blue/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-kliko-navy">{f.nummer}</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusPillClass(status)}`}
                      >
                        {t(`fact.status.${status}`)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-kliko-navy/70">
                      {f.klantNaam} &middot; {maandLabel(f.periode)}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-kliko-navy">
                      {formatUsdCent(f.totaalCentIncl)}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
