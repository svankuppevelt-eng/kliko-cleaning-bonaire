"use client";

// Klantkaart-detail: contactgegevens, adres, abonnement, notitie.
// Sinds Fase 3 volledig bewerkbaar (klant + abonnement) met optimistic
// update + rollback, en verwijderen met bevestiging.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  deleteKlantMetAbonnementen,
  getKlant,
  listAbonnementenVoorKlant,
  updateAbonnement,
  updateKlant,
} from "@/lib/data/klanten";
import { listReinigingenVoorKlant } from "@/lib/data/reinigingen";
import {
  formatUsd,
  kortingPctVoorAantal,
  totaalMaandPrijs,
} from "@/lib/data/prijzen";
import { WERKDAGEN } from "@/lib/data/planning";
import { useInstellingen } from "@/lib/use-instellingen";
import { useActieveBuurten } from "@/lib/use-buurten";
import { BuurtVeld } from "@/components/buurt-veld";
import type {
  Abonnement,
  AbonnementStatus,
  Frequentie,
  Klant,
  KlantTaal,
  KlantType,
  Reiniging,
  Weekdag,
} from "@/lib/data/types";

const FREQ_LABEL: Record<number, string> = {
  1: "price.f1",
  2: "price.f2",
  4: "price.f4",
};

const FREQUENTIES: Frequentie[] = [1, 2, 4];
const STATUSSEN: AbonnementStatus[] = ["actief", "pauze", "gestopt"];

const STATUS_STYLE: Record<Abonnement["status"], string> = {
  actief: "bg-kliko-blue/10 text-kliko-blue",
  pauze: "bg-kliko-yellow/25 text-kliko-navy",
  gestopt: "bg-kliko-red/10 text-kliko-red",
};

const inputCls =
  "w-full rounded-xl border border-kliko-navy/20 bg-white px-4 py-2.5 text-base text-kliko-navy placeholder:text-kliko-navy/40 focus:border-kliko-blue focus:outline-none focus:ring-2 focus:ring-kliko-blue/30";
const selectCls =
  "w-full rounded-xl border border-kliko-navy/20 bg-white px-3 py-2.5 text-sm font-semibold text-kliko-navy focus:border-kliko-blue focus:outline-none";
const labelCls = "mb-1.5 block text-sm font-bold text-kliko-navy";

/** Bewerk-formulier state (strings voor getallen, zodat typen niet breekt). */
interface EditState {
  naam: string;
  email: string;
  telefoon: string;
  adres: string;
  wijk: string;
  aantalKlikos: string;
  type: KlantType;
  taal: KlantTaal;
  notitie: string;
  // Abonnement (alleen als er een abonnement is)
  frequentie: Frequentie;
  prijs: string;
  status: AbonnementStatus;
  vasteDag: Weekdag | null;
}

export default function KlantDetailPage() {
  const { t, lang } = useI18n();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { buurten, geladen: buurtenGeladen } = useActieveBuurten();
  // Office-prijstabel + container-korting voor het prijs-voorstel in de
  // bewerk-modus (valt terug op de standaardtarieven).
  const { instellingen } = useInstellingen();

  // Zonder Firebase-config meteen "niet gevonden" (lazy initializer).
  const [klant, setKlant] = useState<Klant | null | undefined>(() =>
    isFirebaseConfigured() ? undefined : null
  );
  const [abos, setAbos] = useState<Abonnement[]>([]);
  const [error, setError] = useState(false);
  // Schoonmaak-historie: null = nog aan het laden.
  const [historie, setHistorie] = useState<Reiniging[] | null>(null);
  const [histFout, setHistFout] = useState(false);

  const [edit, setEdit] = useState<EditState | null>(null);
  const [busy, setBusy] = useState(false);
  const [actieError, setActieError] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id || !isFirebaseConfigured()) return;
    Promise.all([getKlant(params.id), listAbonnementenVoorKlant(params.id)])
      .then(([k, a]) => {
        setKlant(k);
        setAbos(a);
      })
      .catch(() => setError(true));
    // Historie los laden: een fout hier mag de klantkaart zelf niet blokkeren.
    listReinigingenVoorKlant(params.id)
      .then(setHistorie)
      .catch(() => setHistFout(true));
  }, [params?.id]);

  const hoofdAbo = abos[0] as Abonnement | undefined;

  // Prijs-voorstel in bewerk-modus: TOTAAL voor alle containers op het (ene)
  // abonnement, met container-korting. Alleen ter suggestie; de opgeslagen
  // prijsPerMaand verandert pas als office hem overneemt en opslaat.
  const editAantal = edit ? Math.max(1, Number(edit.aantalKlikos) || 1) : 1;
  const editBasisPrijs = edit
    ? instellingen.prijzen[edit.type][edit.frequentie].maand
    : 0;
  const editKortingPct = edit
    ? kortingPctVoorAantal(instellingen.containerKorting, editAantal)
    : 0;
  const editVoorstel = edit
    ? totaalMaandPrijs(
        edit.type,
        edit.frequentie,
        editAantal,
        instellingen.prijzen,
        instellingen.containerKorting
      )
    : 0;

  function startEdit() {
    if (!klant) return;
    setActieError(null);
    setEdit({
      naam: klant.naam,
      email: klant.email,
      telefoon: klant.telefoon,
      adres: klant.adres,
      wijk: klant.wijk,
      aantalKlikos: String(klant.aantalKlikos),
      type: klant.type,
      taal: klant.taal ?? "nl",
      notitie: klant.notitie ?? "",
      frequentie: hoofdAbo?.frequentie ?? 2,
      prijs: hoofdAbo ? String(hoofdAbo.prijsPerMaand) : "",
      status: hoofdAbo?.status ?? "actief",
      vasteDag: hoofdAbo?.vasteDag ?? null,
    });
  }

  async function opslaan(e: React.FormEvent) {
    e.preventDefault();
    if (!klant || !edit || busy) return;
    setActieError(null);

    const prijsNum = Number(edit.prijs);
    const klikosNum = Math.max(1, Number(edit.aantalKlikos) || 1);
    if (!edit.naam.trim() || !edit.email.trim() || !edit.telefoon.trim() || !edit.adres.trim() || !edit.wijk.trim()) {
      setActieError(t("form.err.required"));
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(edit.email.trim())) {
      setActieError(t("form.err.email"));
      return;
    }
    if (hoofdAbo && (!Number.isFinite(prijsNum) || prijsNum <= 0)) {
      setActieError(t("form.err.required"));
      return;
    }

    const nieuweKlant: Klant = {
      ...klant,
      naam: edit.naam.trim(),
      email: edit.email.trim().toLowerCase(),
      telefoon: edit.telefoon.trim(),
      adres: edit.adres.trim(),
      wijk: edit.wijk.trim(),
      aantalKlikos: klikosNum,
      type: edit.type,
      taal: edit.taal,
      notitie: edit.notitie.trim(),
    };
    const nieuweAbo: Abonnement | undefined = hoofdAbo
      ? {
          ...hoofdAbo,
          type: edit.type,
          frequentie: edit.frequentie,
          prijsPerMaand: prijsNum,
          status: edit.status,
          vasteDag: edit.vasteDag,
        }
      : undefined;

    // Optimistic update: eerst de UI, dan Firestore; bij fout terugdraaien.
    const oudeKlant = klant;
    const oudeAbos = abos;
    setKlant(nieuweKlant);
    if (nieuweAbo) setAbos([nieuweAbo, ...abos.slice(1)]);
    setEdit(null);
    setBusy(true);
    try {
      await updateKlant(klant.id, {
        naam: nieuweKlant.naam,
        email: nieuweKlant.email,
        telefoon: nieuweKlant.telefoon,
        adres: nieuweKlant.adres,
        wijk: nieuweKlant.wijk,
        aantalKlikos: nieuweKlant.aantalKlikos,
        type: nieuweKlant.type,
        taal: nieuweKlant.taal ?? "nl",
        notitie: nieuweKlant.notitie ?? "",
      });
      if (nieuweAbo) {
        await updateAbonnement(nieuweAbo.id, {
          type: nieuweAbo.type,
          frequentie: nieuweAbo.frequentie,
          prijsPerMaand: nieuweAbo.prijsPerMaand,
          status: nieuweAbo.status,
          vasteDag: nieuweAbo.vasteDag ?? null,
        });
      }
    } catch {
      setKlant(oudeKlant);
      setAbos(oudeAbos);
      setActieError(t("detail.err.save"));
    } finally {
      setBusy(false);
    }
  }

  async function verwijderen() {
    if (!klant || busy) return;
    if (!window.confirm(t("detail.delete.confirm"))) return;
    setActieError(null);
    setBusy(true);
    try {
      // Verwijdert klant + abonnementen; de reinigingen-historie blijft
      // bewust staan (gedenormaliseerd, blijft leesbaar zonder klant).
      await deleteKlantMetAbonnementen(klant.id);
      router.replace("/beheer");
    } catch {
      setActieError(t("detail.err.delete"));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/beheer"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-kliko-blue hover:underline"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3">
          <polyline points="15 5 8 12 15 19" />
        </svg>
        {t("detail.back")}
      </Link>

      {error ? (
        <p className="mt-5 rounded-xl border border-kliko-red/30 bg-kliko-red/10 px-4 py-3 text-sm font-semibold text-kliko-red">
          {t("beheer.err.load")}
        </p>
      ) : klant === undefined ? (
        <p className="py-10 text-center text-sm font-semibold text-kliko-navy/50">
          {t("beheer.loading")}
        </p>
      ) : klant === null ? (
        <p className="py-10 text-center text-sm font-semibold text-kliko-navy/50">
          {t("detail.notfound")}
        </p>
      ) : edit ? (
        /* ---------- Bewerk-modus ---------- */
        <form onSubmit={opslaan} noValidate className="mt-5 flex flex-col gap-4">
          <div className="rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-kliko-blue">
              {t("detail.contact")}
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="e-naam" className={labelCls}>{t("form.naam")}</label>
                <input id="e-naam" className={inputCls} value={edit.naam} onChange={(e) => setEdit({ ...edit, naam: e.target.value })} />
              </div>
              <div>
                <label htmlFor="e-email" className={labelCls}>{t("form.email")}</label>
                <input id="e-email" type="email" className={inputCls} value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} inputMode="email" />
              </div>
              <div>
                <label htmlFor="e-telefoon" className={labelCls}>{t("form.telefoon")}</label>
                <input id="e-telefoon" type="tel" className={inputCls} value={edit.telefoon} onChange={(e) => setEdit({ ...edit, telefoon: e.target.value })} inputMode="tel" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="e-adres" className={labelCls}>{t("form.adres")}</label>
                <input id="e-adres" className={inputCls} value={edit.adres} onChange={(e) => setEdit({ ...edit, adres: e.target.value })} />
              </div>
              <div>
                <label htmlFor="e-wijk" className={labelCls}>{t("form.wijk")}</label>
                <BuurtVeld
                  id="e-wijk"
                  value={edit.wijk}
                  onChange={(wijk) => setEdit((huidig) => (huidig ? { ...huidig, wijk } : huidig))}
                  buurten={buurten}
                  geladen={buurtenGeladen}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="e-klikos" className={labelCls}>{t("form.klikos")}</label>
                <input id="e-klikos" type="number" min={1} max={50} className={inputCls} value={edit.aantalKlikos} onChange={(e) => setEdit({ ...edit, aantalKlikos: e.target.value })} inputMode="numeric" />
              </div>
              <div>
                <label htmlFor="e-type" className={labelCls}>{t("signup.type")}</label>
                <select id="e-type" className={selectCls} value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as KlantType })}>
                  <option value="huishouden">{t("price.home")}</option>
                  <option value="bedrijf">{t("price.biz")}</option>
                </select>
              </div>
              <div>
                <label htmlFor="e-taal" className={labelCls}>{t("form.taal")}</label>
                <select id="e-taal" className={selectCls} value={edit.taal} onChange={(e) => setEdit({ ...edit, taal: e.target.value as KlantTaal })}>
                  <option value="pap">{t("taal.pap")}</option>
                  <option value="nl">{t("taal.nl")}</option>
                  <option value="en">{t("taal.en")}</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="e-notitie" className={labelCls}>{t("form.notitie")}</label>
                <textarea id="e-notitie" rows={3} className={inputCls} value={edit.notitie} onChange={(e) => setEdit({ ...edit, notitie: e.target.value })} />
              </div>
            </div>
          </div>

          {hoofdAbo && (
            <div className="rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-kliko-blue">
                {t("detail.abonnement")}
              </h2>
              {/* 1 abonnement voor alle containers; de prijs is het maand-totaal. */}
              <p className="mt-1 text-xs text-kliko-navy/50">{t("abo.1abo")}</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="e-freq" className={labelCls}>{t("abo.freq")}</label>
                  <select id="e-freq" className={selectCls} value={edit.frequentie} onChange={(e) => setEdit({ ...edit, frequentie: Number(e.target.value) as Frequentie })}>
                    {FREQUENTIES.map((f) => (
                      <option key={f} value={f}>{t(FREQ_LABEL[f])}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="e-prijs" className={labelCls}>{t("abo.prijs")}</label>
                  <input id="e-prijs" type="number" min={1} step="0.01" className={inputCls} value={edit.prijs} onChange={(e) => setEdit({ ...edit, prijs: e.target.value })} inputMode="decimal" />
                  {/* Voorstel volgens de prijstabel (totaal voor alle containers,
                      met korting); office neemt hem over met 1 klik. */}
                  <p className="mt-1 text-xs text-kliko-navy/50">
                    {t("abo.voorstel").replace("{totaal}", formatUsd(editVoorstel))}{" "}
                    <button
                      type="button"
                      onClick={() => setEdit({ ...edit, prijs: String(editVoorstel) })}
                      className="font-bold text-kliko-blue hover:underline"
                    >
                      {t("abo.voorstel.gebruik")}
                    </button>
                  </p>
                  {editAantal >= 2 && (
                    <p className="mt-1 text-xs font-semibold text-kliko-blue">
                      {(editKortingPct > 0
                        ? t("abo.opbouw.korting").replace("{pct}", String(editKortingPct))
                        : t("abo.opbouw.geen")
                      )
                        .replace("{n}", String(editAantal))
                        .replace("{basis}", formatUsd(editBasisPrijs))
                        .replace("{totaal}", formatUsd(editVoorstel))}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="e-status" className={labelCls}>{t("abo.status")}</label>
                  <select id="e-status" className={selectCls} value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as AbonnementStatus })}>
                    {STATUSSEN.map((s) => (
                      <option key={s} value={s}>{t(`status.${s}`)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="e-dag" className={labelCls}>{t("plan.dag.label")}</label>
                  <select
                    id="e-dag"
                    className={selectCls}
                    value={edit.vasteDag ?? ""}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        vasteDag: e.target.value === "" ? null : (Number(e.target.value) as Weekdag),
                      })
                    }
                  >
                    <option value="">{t("plan.optie.geen")}</option>
                    {WERKDAGEN.map((d) => (
                      <option key={d} value={d}>{t(`dag.${d}`)}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {actieError && (
            <p role="alert" className="rounded-xl border border-kliko-red/30 bg-kliko-red/10 px-4 py-3 text-sm font-semibold text-kliko-red">
              {actieError}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-kliko-blue px-6 py-2.5 text-sm font-bold text-white transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? t("detail.busy") : t("detail.save")}
            </button>
            <button
              type="button"
              onClick={() => {
                setEdit(null);
                setActieError(null);
              }}
              className="rounded-full border border-kliko-navy/20 px-5 py-2.5 text-sm font-bold text-kliko-navy hover:border-kliko-navy/40"
            >
              {t("detail.cancel")}
            </button>
          </div>
        </form>
      ) : (
        /* ---------- Lees-modus ---------- */
        <div className="mt-5 flex flex-col gap-4">
          {actieError && (
            <p role="alert" className="rounded-xl border border-kliko-red/30 bg-kliko-red/10 px-4 py-3 text-sm font-semibold text-kliko-red">
              {actieError}
            </p>
          )}

          <div className="rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 className="text-2xl font-black tracking-tight text-kliko-navy">
                {klant.naam}
              </h1>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-kliko-blue/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-kliko-blue">
                  {t(klant.type === "huishouden" ? "price.home" : "price.biz")}
                </span>
                <button
                  type="button"
                  onClick={startEdit}
                  className="rounded-full border border-kliko-navy/20 px-3.5 py-1.5 text-xs font-bold text-kliko-navy hover:border-kliko-blue hover:text-kliko-blue"
                >
                  {t("detail.edit")}
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-kliko-navy/45">
              {t("beheer.aangemaakt")}:{" "}
              {new Date(klant.aangemaaktOp).toLocaleDateString(
                lang === "en" ? "en-GB" : "nl-NL"
              )}
            </p>

            <h2 className="mt-5 text-sm font-bold uppercase tracking-wider text-kliko-blue">
              {t("detail.contact")}
            </h2>
            <dl className="mt-2 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-bold text-kliko-navy/60">{t("form.email")}</dt>
                <dd className="break-all text-kliko-navy">
                  <a href={`mailto:${klant.email}`} className="hover:text-kliko-blue">{klant.email}</a>
                </dd>
              </div>
              <div>
                <dt className="font-bold text-kliko-navy/60">{t("form.telefoon")}</dt>
                <dd className="text-kliko-navy">
                  <a href={`tel:${klant.telefoon}`} className="hover:text-kliko-blue">{klant.telefoon}</a>
                </dd>
              </div>
              <div>
                <dt className="font-bold text-kliko-navy/60">{t("form.adres")}</dt>
                <dd className="text-kliko-navy">{klant.adres}</dd>
              </div>
              <div>
                <dt className="font-bold text-kliko-navy/60">{t("form.wijk")}</dt>
                <dd className="text-kliko-navy">{klant.wijk}</dd>
              </div>
              <div>
                <dt className="font-bold text-kliko-navy/60">{t("form.klikos")}</dt>
                <dd className="text-kliko-navy">{klant.aantalKlikos}</dd>
              </div>
              <div>
                <dt className="font-bold text-kliko-navy/60">{t("form.taal")}</dt>
                <dd className="text-kliko-navy">{t(`taal.${klant.taal ?? "nl"}`)}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-kliko-blue">
              {t("detail.abonnement")}
            </h2>
            {abos.length === 0 ? (
              <p className="mt-2 text-sm font-semibold text-kliko-navy/50">
                {t("beheer.geen.abo")}
              </p>
            ) : (
              <ul className="mt-2 flex flex-col divide-y divide-kliko-navy/10">
                {abos.map((abo) => (
                  <li key={abo.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div>
                      <p className="font-bold text-kliko-navy">
                        {t(FREQ_LABEL[abo.frequentie])}
                      </p>
                      <p className="text-xs text-kliko-navy/50">
                        {abo.startdatum}
                        {abo.vasteDag ? <> &middot; {t(`dag.${abo.vasteDag}`)}</> : null}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-black tabular-nums text-kliko-navy">
                        {formatUsd(abo.prijsPerMaand)}
                        <span className="text-sm font-semibold text-kliko-navy/50">
                          {t("price.month")}
                        </span>
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLE[abo.status]}`}>
                        {t(`status.${abo.status}`)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Schoonmaak-historie: alle beurten (gedaan/overgeslagen) van deze klant. */}
          <div className="rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-kliko-blue">
              {t("hist.title")}
            </h2>
            {histFout ? (
              <p className="mt-2 text-sm font-semibold text-kliko-red">
                {t("hist.err")}
              </p>
            ) : historie === null ? (
              <p className="mt-2 text-sm font-semibold text-kliko-navy/50">
                {t("beheer.loading")}
              </p>
            ) : historie.length === 0 ? (
              <p className="mt-2 text-sm font-semibold text-kliko-navy/50">
                {t("hist.leeg")}
              </p>
            ) : (
              <ul className="mt-2 flex flex-col divide-y divide-kliko-navy/10">
                {historie.map((r) => (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {r.fotoUrl && (
                        // Klikbare thumbnail van de bewijsfoto (opent origineel).
                        <a
                          href={r.fotoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0"
                          title={t("hist.foto")}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={r.fotoUrl}
                            alt={t("hist.foto")}
                            className="h-11 w-11 rounded-lg border border-kliko-navy/10 object-cover"
                          />
                        </a>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-kliko-navy">
                          {new Date(`${r.datum}T12:00:00`).toLocaleDateString(
                            lang === "en" ? "en-GB" : "nl-NL"
                          )}
                        </p>
                        {r.uitgevoerdDoorNaam && (
                          <p className="truncate text-xs text-kliko-navy/55">
                            {t("hist.door")} {r.uitgevoerdDoorNaam}
                          </p>
                        )}
                        {r.status === "overgeslagen" && r.redenOverslaan && (
                          <p className="text-xs font-semibold text-kliko-navy/70">
                            {r.redenOverslaan}
                          </p>
                        )}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        r.status === "gedaan"
                          ? "bg-kliko-blue/10 text-kliko-blue"
                          : "bg-kliko-yellow/25 text-kliko-navy"
                      }`}
                    >
                      {t(
                        r.status === "gedaan"
                          ? "vandaag.status.gedaan"
                          : "vandaag.status.overgeslagen"
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {klant.notitie && (
            <div className="rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-kliko-blue">
                {t("detail.notitie")}
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-kliko-navy">{klant.notitie}</p>
            </div>
          )}

          {/* Verwijderen */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={verwijderen}
              disabled={busy}
              className="rounded-full border border-kliko-red/40 px-5 py-2.5 text-sm font-bold text-kliko-red hover:bg-kliko-red/5 disabled:opacity-60"
            >
              {t("detail.delete")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
