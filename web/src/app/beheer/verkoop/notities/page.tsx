"use client";

// Office: losse werk-aantekeningen per categorie. Overgezet uit de Streamlit
// Notities-pagina; nu opgeslagen in Firestore-collectie `notities`.
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { VerkoopTabs } from "@/components/verkoop-tabs";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  createNotitie,
  deleteNotitie,
  listNotities,
  NOTITIE_CATEGORIEEN,
  updateNotitie,
  type Notitie,
  type NotitieCategorie,
} from "@/lib/data/notities";

const inputCls =
  "w-full rounded-xl border border-kliko-navy/20 bg-white px-3 py-2 text-sm text-kliko-navy focus:border-kliko-blue focus:outline-none focus:ring-2 focus:ring-kliko-blue/30";

const CAT_STYLE = "bg-kliko-navy/5 text-kliko-navy/70";

export default function NotitiesPage() {
  const { t } = useI18n();
  const [notities, setNotities] = useState<Notitie[]>([]);
  const [geladen, setGeladen] = useState(false);
  const [filter, setFilter] = useState<NotitieCategorie | "alle">("alle");

  // Formulier voor nieuw / bewerken.
  const [bewerkId, setBewerkId] = useState<string | null>(null);
  const [titel, setTitel] = useState("");
  const [inhoud, setInhoud] = useState("");
  const [categorie, setCategorie] = useState<NotitieCategorie>("Algemeen");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setGeladen(true);
      return;
    }
    listNotities()
      .then(setNotities)
      .finally(() => setGeladen(true));
  }, []);

  function reset() {
    setBewerkId(null);
    setTitel("");
    setInhoud("");
    setCategorie("Algemeen");
  }

  function beginBewerken(n: Notitie) {
    setBewerkId(n.id);
    setTitel(n.titel);
    setInhoud(n.inhoud);
    setCategorie(n.categorie);
  }

  async function opslaan() {
    if (busy || !titel.trim() || !isFirebaseConfigured()) return;
    setBusy(true);
    const bewerktOp = new Date().toISOString().slice(0, 16);
    try {
      if (bewerkId) {
        await updateNotitie(bewerkId, { titel, inhoud, categorie, bewerktOp });
        setNotities((h) =>
          h.map((n) =>
            n.id === bewerkId ? { ...n, titel, inhoud, categorie, bewerktOp } : n
          )
        );
      } else {
        const id = await createNotitie({ titel, inhoud, categorie, bewerktOp });
        setNotities((h) => [{ id, titel, inhoud, categorie, bewerktOp }, ...h]);
      }
      reset();
    } catch {
      window.alert(t("verkoop.not.fout"));
    } finally {
      setBusy(false);
    }
  }

  async function verwijder(id: string) {
    if (!isFirebaseConfigured()) return;
    const vorige = notities;
    setNotities((h) => h.filter((n) => n.id !== id));
    if (bewerkId === id) reset();
    try {
      await deleteNotitie(id);
    } catch {
      setNotities(vorige);
      window.alert(t("verkoop.not.fout"));
    }
  }

  const zichtbaar =
    filter === "alle"
      ? notities
      : notities.filter((n) => n.categorie === filter);

  return (
    <div>
      <VerkoopTabs />
      <h1 className="text-2xl font-black tracking-tight text-kliko-navy sm:text-3xl">
        {t("verkoop.not.title")}
      </h1>
      <p className="mt-1 text-sm text-kliko-navy/60">{t("verkoop.not.sub")}</p>

      {/* Nieuw / bewerken */}
      <section className="mt-6 rounded-2xl border border-kliko-navy/10 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-kliko-blue">
          {bewerkId ? t("verkoop.not.bewerken") : t("verkoop.not.nieuw")}
        </h2>
        <div className="mt-4 flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              className={inputCls}
              placeholder={t("verkoop.not.titel")}
              value={titel}
              onChange={(e) => setTitel(e.target.value)}
            />
            <select
              className={inputCls}
              value={categorie}
              onChange={(e) => setCategorie(e.target.value as NotitieCategorie)}
            >
              {NOTITIE_CATEGORIEEN.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <textarea
            className={`${inputCls} min-h-24`}
            placeholder={t("verkoop.not.inhoud")}
            value={inhoud}
            onChange={(e) => setInhoud(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={opslaan}
              disabled={busy || !titel.trim()}
              className="rounded-full bg-kliko-blue px-5 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? t("verkoop.not.bezig") : t("verkoop.not.opslaan")}
            </button>
            {bewerkId && (
              <button
                onClick={reset}
                className="rounded-full border border-kliko-navy/20 px-5 py-2 text-sm font-bold text-kliko-navy hover:border-kliko-navy/40"
              >
                {t("verkoop.not.annuleer")}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Filter */}
      <div className="mt-6 flex flex-wrap gap-2">
        {(["alle", ...NOTITIE_CATEGORIEEN] as (NotitieCategorie | "alle")[]).map(
          (c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={
                filter === c
                  ? "rounded-full bg-kliko-navy px-3.5 py-1.5 text-xs font-bold text-white"
                  : "rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-kliko-navy/70 ring-1 ring-kliko-navy/10 hover:text-kliko-navy"
              }
            >
              {c === "alle" ? t("verkoop.not.alle") : c}
            </button>
          )
        )}
      </div>

      {/* Lijst */}
      <div className="mt-4 flex flex-col gap-2">
        {!geladen ? (
          <p className="py-8 text-center text-sm font-semibold text-kliko-navy/40">
            {t("verkoop.not.laden")}
          </p>
        ) : zichtbaar.length === 0 ? (
          <p className="py-8 text-center text-sm font-semibold text-kliko-navy/40">
            {t("verkoop.not.leeg")}
          </p>
        ) : (
          zichtbaar.map((n) => (
            <div
              key={n.id}
              className="rounded-2xl border border-kliko-navy/10 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold ${CAT_STYLE}`}
                  >
                    {n.categorie}
                  </span>
                  <h3 className="mt-1.5 font-bold text-kliko-navy">{n.titel}</h3>
                  {n.inhoud && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-kliko-navy/70">
                      {n.inhoud}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => beginBewerken(n)}
                    className="rounded-lg px-2.5 py-1 text-xs font-bold text-kliko-blue hover:bg-kliko-blue/10"
                  >
                    {t("verkoop.not.bewerk")}
                  </button>
                  <button
                    onClick={() => verwijder(n.id)}
                    className="rounded-lg px-2.5 py-1 text-xs font-bold text-kliko-red hover:bg-kliko-red/10"
                  >
                    {t("verkoop.not.wis")}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
