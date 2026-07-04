"use client";

// Office: prospect- / marktlijst (hotels, supermarkten, restaurants, e.d.).
// Statische onderzoekslijst uit prospects.ts + een per-prospect verkoopstatus
// die office in Firestore bijhoudt. Overgezet uit de Streamlit-marktpagina.
import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { VerkoopTabs } from "@/components/verkoop-tabs";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  PROSPECTS,
  type Prospect,
  type ProspectCategorie,
} from "@/lib/data/prospects";
import {
  clearProspectStatus,
  listProspectStatus,
  PROSPECT_STATUSSEN,
  prospectSlug,
  setProspectStatus,
  STATUS_LABEL,
  type ProspectStatus,
  type ProspectStatusWaarde,
} from "@/lib/data/prospect-status";

const CATEGORIE_LABEL: Record<ProspectCategorie | "alle", string> = {
  alle: "Alle",
  hotel: "Hotels & resorts",
  supermarkt: "Supermarkten",
  restaurant: "Restaurants",
  vakantieverhuur: "Vakantieverhuur",
  instelling: "Instellingen",
};

const PRIO_STYLE: Record<string, string> = {
  Hoog: "bg-kliko-red/10 text-kliko-red",
  Midden: "bg-kliko-yellow/20 text-kliko-navy",
  Laag: "bg-kliko-navy/10 text-kliko-navy/60",
};

const STATUS_STYLE: Record<ProspectStatusWaarde, string> = {
  nieuw: "bg-kliko-navy/5 text-kliko-navy/60",
  benaderd: "bg-kliko-blue/10 text-kliko-blue",
  "in-gesprek": "bg-kliko-yellow/20 text-kliko-navy",
  klant: "bg-green-100 text-green-700",
  afgewezen: "bg-kliko-navy/10 text-kliko-navy/40",
};

const selectCls =
  "rounded-lg border border-kliko-navy/20 bg-white px-2 py-1 text-xs font-semibold text-kliko-navy focus:border-kliko-blue focus:outline-none";

export default function ProspectsPage() {
  const { t } = useI18n();
  const [statusMap, setStatusMap] = useState<Map<string, ProspectStatus>>(
    new Map()
  );
  const [categorie, setCategorie] = useState<ProspectCategorie | "alle">("alle");
  const [zoek, setZoek] = useState("");

  useEffect(() => {
    listProspectStatus().then(setStatusMap);
  }, []);

  const categorieen = useMemo(() => {
    const set = new Set<ProspectCategorie>();
    for (const p of PROSPECTS) set.add(p.categorie);
    return Array.from(set);
  }, []);

  const zichtbaar = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    return PROSPECTS.filter(
      (p) =>
        (categorie === "alle" || p.categorie === categorie) &&
        (!q ||
          p.naam.toLowerCase().includes(q) ||
          p.adres.toLowerCase().includes(q))
    );
  }, [categorie, zoek]);

  function statusVan(p: Prospect): ProspectStatusWaarde {
    return statusMap.get(prospectSlug(p.naam))?.status ?? "nieuw";
  }

  async function wijzigStatus(p: Prospect, nieuw: ProspectStatusWaarde) {
    const slug = prospectSlug(p.naam);
    const nu = new Date().toISOString().slice(0, 16);
    const bestaand = statusMap.get(slug);
    const volgende = new Map(statusMap);
    if (nieuw === "nieuw") {
      volgende.delete(slug);
      setStatusMap(volgende);
      if (isFirebaseConfigured()) await clearProspectStatus(p.naam).catch(() => {});
      return;
    }
    const record: ProspectStatus = {
      status: nieuw,
      notitie: bestaand?.notitie ?? "",
      bewerktOp: nu,
    };
    volgende.set(slug, record);
    setStatusMap(volgende);
    if (isFirebaseConfigured()) await setProspectStatus(p.naam, record).catch(() => {});
  }

  // Tellingen voor de kop.
  const aantalKlant = useMemo(
    () =>
      Array.from(statusMap.values()).filter((s) => s.status === "klant").length,
    [statusMap]
  );

  return (
    <div>
      <VerkoopTabs />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-kliko-navy sm:text-3xl">
            {t("verkoop.pro.title")}
          </h1>
          <p className="mt-1 text-sm text-kliko-navy/60">{t("verkoop.pro.sub")}</p>
        </div>
        <div className="flex gap-4 text-sm">
          <span className="font-semibold text-kliko-navy/60">
            {t("verkoop.pro.totaal")}:{" "}
            <span className="font-black text-kliko-navy">{PROSPECTS.length}</span>
          </span>
          <span className="font-semibold text-kliko-navy/60">
            {t("verkoop.pro.klanten")}:{" "}
            <span className="font-black text-green-600">{aantalKlant}</span>
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {(["alle", ...categorieen] as (ProspectCategorie | "alle")[]).map((c) => (
          <button
            key={c}
            onClick={() => setCategorie(c)}
            className={
              categorie === c
                ? "rounded-full bg-kliko-blue px-3.5 py-1.5 text-xs font-bold text-white"
                : "rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-kliko-navy/70 ring-1 ring-kliko-navy/10 hover:text-kliko-navy"
            }
          >
            {CATEGORIE_LABEL[c]}
          </button>
        ))}
        <input
          className="ml-auto min-w-48 flex-1 rounded-full border border-kliko-navy/20 bg-white px-4 py-1.5 text-sm text-kliko-navy focus:border-kliko-blue focus:outline-none sm:max-w-64 sm:flex-none"
          placeholder={t("verkoop.pro.zoek")}
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
        />
      </div>

      {/* Lijst */}
      <div className="mt-4 flex flex-col gap-2">
        {zichtbaar.map((p) => {
          const status = statusVan(p);
          return (
            <div
              key={prospectSlug(p.naam)}
              className="rounded-2xl border border-kliko-navy/10 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-kliko-navy">{p.naam}</h3>
                    {p.prioriteit && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          PRIO_STYLE[p.prioriteit] ?? "bg-kliko-navy/10 text-kliko-navy/60"
                        }`}
                      >
                        {p.prioriteit}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[status]}`}
                    >
                      {STATUS_LABEL[status]}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-kliko-navy/60">
                    {p.type ? `${p.type} · ` : ""}
                    {p.adres}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-kliko-navy/60">
                    {p.telefoon && (
                      <a
                        href={`tel:${p.telefoon.replace(/\s/g, "")}`}
                        className="font-semibold text-kliko-blue hover:underline"
                      >
                        {p.telefoon}
                      </a>
                    )}
                    {p.website && (
                      <a
                        href={`https://${p.website}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-kliko-blue hover:underline"
                      >
                        {p.website}
                      </a>
                    )}
                    {p.eenheden > 0 && (
                      <span>
                        {p.eenheden} {t("verkoop.pro.eenheden")}
                      </span>
                    )}
                    {p.containers > 0 && (
                      <span>
                        ~{p.containers} {t("verkoop.pro.containers")}
                      </span>
                    )}
                  </div>
                </div>
                <select
                  className={selectCls}
                  value={status}
                  onChange={(e) =>
                    wijzigStatus(p, e.target.value as ProspectStatusWaarde)
                  }
                >
                  {PROSPECT_STATUSSEN.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
        {zichtbaar.length === 0 && (
          <p className="py-10 text-center text-sm font-semibold text-kliko-navy/40">
            {t("verkoop.pro.leeg")}
          </p>
        )}
      </div>
    </div>
  );
}
