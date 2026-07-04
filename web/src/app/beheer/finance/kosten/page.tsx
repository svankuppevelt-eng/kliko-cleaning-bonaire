"use client";

// Kosten-invoer (office): per maand kostenposten toevoegen, bewerken en
// verwijderen per categorie (water, materiaal, personeel, brandstof, overig).
// Deze collectie `kosten` voedt de kosten- en winst-cijfers op /beheer/finance.
// Bedragen in dollarcenten; invoer in dollars, opslag als integer centen.
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { isFirebaseConfigured } from "@/lib/firebase";
import { formatUsdCent } from "@/lib/data/facturen-types";
import { maandLabel } from "@/lib/data/facturen";
import { huidigeMaand } from "@/lib/data/finance";
import {
  createKosten,
  deleteKosten,
  KOSTEN_CATEGORIEEN,
  listKostenVoorMaand,
  updateKosten,
  type KostenCategorie,
  type KostenPost,
} from "@/lib/data/kosten";

// Categorie-pills: neutrale navy-inkt met alleen een tint-verschil per
// categorie is hier bewust NIET gedaan; categorie is identiteit, dus vaste
// rustige tinten (geen statuskleuren, geen rood/groen).
const CATEGORIE_PILL: Record<KostenCategorie, string> = {
  water: "bg-kliko-blue/10 text-kliko-blue",
  materiaal: "bg-kliko-navy/10 text-kliko-navy",
  personeel: "bg-[#7c3aed]/10 text-[#7c3aed]",
  brandstof: "bg-[#E39A1F]/15 text-[#a96f0d]",
  overig: "bg-kliko-navy/5 text-kliko-navy/70",
};

/** "12.50" of "12,50" -> 1250 centen; null bij ongeldig of <= 0. */
function parseDollarsNaarCent(invoer: string): number | null {
  const genormaliseerd = invoer.trim().replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(genormaliseerd)) return null;
  const cent = Math.round(Number(genormaliseerd) * 100);
  return cent > 0 ? cent : null;
}

interface FormState {
  categorie: KostenCategorie;
  omschrijving: string;
  bedrag: string;
}

const LEEG_FORM: FormState = { categorie: "water", omschrijving: "", bedrag: "" };

export default function KostenPage() {
  const { t } = useI18n();

  const [maand, setMaand] = useState(huidigeMaand);
  const [posten, setPosten] = useState<KostenPost[] | null>(null);
  const [laadFout, setLaadFout] = useState(false);
  const [saveFout, setSaveFout] = useState(false);
  const [bedragFout, setBedragFout] = useState(false);
  const [bezig, setBezig] = useState(false);

  // Nieuw-formulier + (max 1) post in bewerking.
  const [form, setForm] = useState<FormState>(LEEG_FORM);
  const [bewerkId, setBewerkId] = useState<string | null>(null);
  const [bewerkForm, setBewerkForm] = useState<FormState>(LEEG_FORM);

  const geldigeMaand = /^\d{4}-(0[1-9]|1[0-2])$/.test(maand)
    ? maand
    : huidigeMaand();

  useEffect(() => {
    setPosten(null);
    setLaadFout(false);
    if (!isFirebaseConfigured()) {
      setPosten([]);
      return;
    }
    listKostenVoorMaand(geldigeMaand)
      .then((rijen) =>
        setPosten(
          [...rijen].sort((a, b) => a.aangemaaktOp.localeCompare(b.aangemaaktOp))
        )
      )
      .catch(() => setLaadFout(true));
  }, [geldigeMaand]);

  const totaalCent = useMemo(
    () => (posten ?? []).reduce((som, p) => som + p.bedragCent, 0),
    [posten]
  );

  async function herlaad() {
    const rijen = await listKostenVoorMaand(geldigeMaand);
    setPosten(
      [...rijen].sort((a, b) => a.aangemaaktOp.localeCompare(b.aangemaaktOp))
    );
  }

  async function voegToe() {
    if (bezig) return;
    setSaveFout(false);
    setBedragFout(false);
    const cent = parseDollarsNaarCent(form.bedrag);
    if (cent === null || !form.omschrijving.trim()) {
      setBedragFout(true);
      return;
    }
    setBezig(true);
    try {
      await createKosten({
        maand: geldigeMaand,
        categorie: form.categorie,
        omschrijving: form.omschrijving.trim(),
        bedragCent: cent,
        aangemaaktOp: new Date().toISOString(),
      });
      setForm(LEEG_FORM);
      await herlaad();
    } catch {
      setSaveFout(true);
    } finally {
      setBezig(false);
    }
  }

  function startBewerk(post: KostenPost) {
    setBewerkId(post.id);
    setBewerkForm({
      categorie: post.categorie,
      omschrijving: post.omschrijving,
      bedrag: (post.bedragCent / 100).toFixed(2),
    });
    setSaveFout(false);
    setBedragFout(false);
  }

  async function bewaarBewerk() {
    if (bezig || !bewerkId) return;
    setSaveFout(false);
    setBedragFout(false);
    const cent = parseDollarsNaarCent(bewerkForm.bedrag);
    if (cent === null || !bewerkForm.omschrijving.trim()) {
      setBedragFout(true);
      return;
    }
    setBezig(true);
    try {
      await updateKosten(bewerkId, {
        categorie: bewerkForm.categorie,
        omschrijving: bewerkForm.omschrijving.trim(),
        bedragCent: cent,
      });
      setBewerkId(null);
      await herlaad();
    } catch {
      setSaveFout(true);
    } finally {
      setBezig(false);
    }
  }

  async function verwijder(id: string) {
    if (bezig || !window.confirm(t("kost.verwijder.confirm"))) return;
    setBezig(true);
    setSaveFout(false);
    try {
      await deleteKosten(id);
      await herlaad();
    } catch {
      setSaveFout(true);
    } finally {
      setBezig(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-kliko-navy/20 bg-white px-3 py-2.5 text-sm font-semibold text-kliko-navy focus:border-kliko-blue focus:outline-none";

  const renderFormVelden = (
    state: FormState,
    setState: (f: FormState) => void
  ) => (
    <div className="grid gap-2 sm:grid-cols-[10rem_1fr_8rem]">
      <label className="block">
        <span className="mb-1 block text-xs font-bold text-kliko-navy/60">
          {t("kost.categorie")}
        </span>
        <select
          value={state.categorie}
          onChange={(e) =>
            setState({ ...state, categorie: e.target.value as KostenCategorie })
          }
          className={inputCls}
        >
          {KOSTEN_CATEGORIEEN.map((c) => (
            <option key={c} value={c}>
              {t(`kost.cat.${c}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-bold text-kliko-navy/60">
          {t("kost.omschrijving")}
        </span>
        <input
          type="text"
          value={state.omschrijving}
          onChange={(e) => setState({ ...state, omschrijving: e.target.value })}
          placeholder={t("kost.omschrijving.placeholder")}
          className={inputCls}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-bold text-kliko-navy/60">
          {t("kost.bedrag")}
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={state.bedrag}
          onChange={(e) => setState({ ...state, bedrag: e.target.value })}
          placeholder="0.00"
          className={`${inputCls} tabular-nums`}
        />
      </label>
    </div>
  );

  return (
    <div>
      <Link
        href="/beheer/finance"
        className="text-sm font-semibold text-kliko-blue hover:underline"
      >
        &larr; {t("kost.terug")}
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-kliko-navy sm:text-3xl">
            {t("kost.title")}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-kliko-navy/60">
            {t("kost.sub")}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-kliko-navy">
          {t("kost.maand")}
          <input
            type="month"
            value={maand}
            onChange={(e) => setMaand(e.target.value)}
            className="rounded-xl border border-kliko-navy/20 bg-white px-3 py-2 text-sm font-semibold text-kliko-navy focus:border-kliko-blue focus:outline-none"
          />
        </label>
      </div>

      {/* Nieuw-formulier */}
      <div className="mt-5 rounded-2xl border border-kliko-navy/10 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-kliko-navy">{t("kost.nieuw")}</h2>
        <div className="mt-3">
          {renderFormVelden(form, setForm)}
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={voegToe}
              disabled={bezig}
              className="rounded-full bg-kliko-blue px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              {bezig ? t("kost.bezig") : t("kost.toevoegen")}
            </button>
          </div>
        </div>
      </div>

      {bedragFout && (
        <p className="mt-3 rounded-xl border border-kliko-yellow bg-kliko-yellow/15 px-4 py-2.5 text-sm font-semibold text-kliko-navy">
          {t("kost.err.bedrag")}
        </p>
      )}
      {saveFout && (
        <p className="mt-3 rounded-xl border border-kliko-red/30 bg-kliko-red/10 px-4 py-2.5 text-sm font-semibold text-kliko-red">
          {t("kost.err.save")}
        </p>
      )}

      {/* Lijst + maandtotaal */}
      <div className="mt-6">
        {laadFout ? (
          <p className="rounded-xl border border-kliko-red/30 bg-kliko-red/10 px-4 py-3 text-sm font-semibold text-kliko-red">
            {t("kost.err.load")}
          </p>
        ) : posten === null ? (
          <p className="py-10 text-center text-sm font-semibold text-kliko-navy/50">
            {t("kost.loading")}
          </p>
        ) : posten.length === 0 ? (
          <p className="py-10 text-center text-sm font-semibold text-kliko-navy/50">
            {t("kost.leeg")}
          </p>
        ) : (
          <>
            <ul className="space-y-2">
              {posten.map((post) =>
                bewerkId === post.id ? (
                  <li
                    key={post.id}
                    className="rounded-2xl border border-kliko-blue/40 bg-white p-4 shadow-sm"
                  >
                    {renderFormVelden(bewerkForm, setBewerkForm)}
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={bewaarBewerk}
                        disabled={bezig}
                        className="rounded-full bg-kliko-navy px-4 py-1.5 text-sm font-bold text-white disabled:opacity-50"
                      >
                        {bezig ? t("kost.bezig") : t("kost.opslaan")}
                      </button>
                      <button
                        onClick={() => setBewerkId(null)}
                        className="rounded-full border border-kliko-navy/20 px-4 py-1.5 text-sm font-bold text-kliko-navy"
                      >
                        {t("kost.annuleer")}
                      </button>
                    </div>
                  </li>
                ) : (
                  <li
                    key={post.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-kliko-navy/10 bg-white p-4 shadow-sm"
                  >
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${CATEGORIE_PILL[post.categorie]}`}
                    >
                      {t(`kost.cat.${post.categorie}`)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-kliko-navy">
                      {post.omschrijving}
                    </span>
                    <span className="text-sm font-bold tabular-nums text-kliko-navy">
                      {formatUsdCent(post.bedragCent)}
                    </span>
                    <span className="flex gap-1">
                      <button
                        onClick={() => startBewerk(post)}
                        className="rounded-full border border-kliko-navy/15 px-3 py-1 text-xs font-bold text-kliko-navy hover:border-kliko-navy/40"
                      >
                        {t("kost.bewerk")}
                      </button>
                      <button
                        onClick={() => verwijder(post.id)}
                        className="rounded-full border border-kliko-red/20 px-3 py-1 text-xs font-bold text-kliko-red hover:border-kliko-red/50"
                      >
                        {t("kost.verwijder")}
                      </button>
                    </span>
                  </li>
                )
              )}
            </ul>
            <div className="mt-4 flex items-center justify-between rounded-2xl bg-kliko-navy/5 px-4 py-3">
              <span className="text-sm font-bold text-kliko-navy">
                {t("kost.totaal")} ({maandLabel(geldigeMaand)})
              </span>
              <span className="text-base font-black tabular-nums text-kliko-navy">
                {formatUsdCent(totaalCent)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
