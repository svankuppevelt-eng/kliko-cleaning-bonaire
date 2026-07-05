"use client";

// Office: buurten-lijst beheren (toevoegen, hernoemen, actief/inactief,
// verwijderen, volgorde). Bij eerste bezoek wordt de startlijst geseed
// (idempotent, alleen als de collectie leeg is).
// Alle wijzigingen: optimistic update + rollback bij fout.
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  createBuurt,
  deleteBuurt,
  herschrijfVolgorde,
  listBuurten,
  seedBuurtenAlsLeeg,
  updateBuurt,
  verwijderDubbeleBuurten,
  type Buurt,
  type SelibonDagdeel,
} from "@/lib/data/buurten";

const inputCls =
  "w-full rounded-xl border border-kliko-navy/20 bg-white px-4 py-2.5 text-base text-kliko-navy placeholder:text-kliko-navy/40 focus:border-kliko-blue focus:outline-none focus:ring-2 focus:ring-kliko-blue/30";

const selectCls =
  "min-w-0 flex-1 rounded-lg border border-kliko-navy/20 bg-white px-2 py-1.5 text-xs font-semibold text-kliko-navy focus:border-kliko-blue focus:outline-none";

/** Selibon haalt ook op dagen op waarop wij zelf niet schoonmaken: ma t/m zo. */
const SELIBON_DAGEN = [1, 2, 3, 4, 5, 6, 7] as const;
const DAGDELEN: SelibonDagdeel[] = ["ochtend", "middag"];

export default function BuurtenPage() {
  const { t } = useI18n();

  // Zonder Firebase-config: meteen een lege lijst (lazy initializer).
  const [buurten, setBuurten] = useState<Buurt[] | null>(() =>
    isFirebaseConfigured() ? null : []
  );
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const [nieuwNaam, setNieuwNaam] = useState("");
  const [addBusy, setAddBusy] = useState(false);

  // Hernoemen: 1 rij tegelijk.
  const [editId, setEditId] = useState<string | null>(null);
  const [editNaam, setEditNaam] = useState("");

  // Dubbele buurten opruimen (oude dubbele seed).
  const [dubbelBusy, setDubbelBusy] = useState(false);
  const [dubbelMelding, setDubbelMelding] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    // Seed eerst (doet niets als er al buurten zijn), daarna de lijst laden.
    seedBuurtenAlsLeeg()
      .catch(() => {
        // Seed mislukt (bv. rules): lijst alsnog proberen te laden.
      })
      .then(() => listBuurten())
      .then(setBuurten)
      .catch(() => setLoadError(true));
  }, []);

  async function toevoegen(e: React.FormEvent) {
    e.preventDefault();
    const naam = nieuwNaam.trim();
    if (!naam || addBusy) return;
    setSaveError(false);
    setAddBusy(true);
    const volgorde = ((buurten ?? []).length + 1) * 10;
    try {
      const id = await createBuurt({ naam, actief: true, volgorde });
      setBuurten((huidig) => [...(huidig ?? []), { id, naam, actief: true, volgorde }]);
      setNieuwNaam("");
    } catch {
      setSaveError(true);
    } finally {
      setAddBusy(false);
    }
  }

  async function toggleActief(buurt: Buurt) {
    setSaveError(false);
    const zet = (actief: boolean) =>
      setBuurten((huidig) =>
        (huidig ?? []).map((b) => (b.id === buurt.id ? { ...b, actief } : b))
      );
    zet(!buurt.actief);
    try {
      await updateBuurt(buurt.id, { actief: !buurt.actief });
    } catch {
      zet(buurt.actief);
      setSaveError(true);
    }
  }

  async function hernoemen(buurt: Buurt) {
    const naam = editNaam.trim();
    setEditId(null);
    if (!naam || naam === buurt.naam) return;
    setSaveError(false);
    const zet = (n: string) =>
      setBuurten((huidig) =>
        (huidig ?? []).map((b) => (b.id === buurt.id ? { ...b, naam: n } : b))
      );
    zet(naam);
    try {
      await updateBuurt(buurt.id, { naam });
    } catch {
      zet(buurt.naam);
      setSaveError(true);
    }
  }

  async function verwijderen(buurt: Buurt) {
    if (!window.confirm(t("buurten.delete.confirm"))) return;
    setSaveError(false);
    const oud = buurten ?? [];
    setBuurten(oud.filter((b) => b.id !== buurt.id));
    try {
      await deleteBuurt(buurt.id);
    } catch {
      setBuurten(oud);
      setSaveError(true);
    }
  }

  async function verwijderDubbele() {
    if (dubbelBusy) return;
    if (!window.confirm(t("buurten.dubbel.confirm"))) return;
    setSaveError(false);
    setDubbelMelding(null);
    setDubbelBusy(true);
    try {
      const n = await verwijderDubbeleBuurten();
      // Lijst opnieuw laden: verwijderDubbeleBuurten kan ook Selibon-info
      // naar de behouden buurt gemerged hebben.
      setBuurten(await listBuurten());
      setDubbelMelding(
        n === 0
          ? t("buurten.dubbel.geen")
          : `${n} ${t("buurten.dubbel.klaar")}`
      );
    } catch {
      setSaveError(true);
    } finally {
      setDubbelBusy(false);
    }
  }

  async function wijzigSelibon(
    buurt: Buurt,
    wijziging: Partial<Pick<Buurt, "selibonDag" | "selibonDagdeel">>
  ) {
    setSaveError(false);
    const zet = (velden: Partial<Buurt>) =>
      setBuurten((huidig) =>
        (huidig ?? []).map((b) => (b.id === buurt.id ? { ...b, ...velden } : b))
      );
    zet(wijziging);
    try {
      await updateBuurt(buurt.id, wijziging);
    } catch {
      // Rollback naar de waarden van voor de wijziging.
      zet({
        selibonDag: buurt.selibonDag ?? null,
        selibonDagdeel: buurt.selibonDagdeel ?? null,
      });
      setSaveError(true);
    }
  }

  async function verplaats(index: number, richting: -1 | 1) {
    const oud = buurten ?? [];
    const doel = index + richting;
    if (doel < 0 || doel >= oud.length) return;
    setSaveError(false);
    const nieuw = [...oud];
    [nieuw[index], nieuw[doel]] = [nieuw[doel], nieuw[index]];
    const hernummerd = nieuw.map((b, i) => ({ ...b, volgorde: (i + 1) * 10 }));
    setBuurten(hernummerd);
    try {
      await herschrijfVolgorde(hernummerd);
    } catch {
      setBuurten(oud);
      setSaveError(true);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-black tracking-tight text-kliko-navy sm:text-3xl">
        {t("buurten.title")}
      </h1>
      <p className="mt-1 text-sm text-kliko-navy/60">{t("buurten.sub")}</p>

      {/* Toevoegen */}
      <form onSubmit={toevoegen} className="mt-5 flex gap-2">
        <input
          value={nieuwNaam}
          onChange={(e) => setNieuwNaam(e.target.value)}
          placeholder={t("buurten.new.placeholder")}
          className={inputCls}
        />
        <button
          type="submit"
          disabled={addBusy || !nieuwNaam.trim()}
          className="shrink-0 rounded-full bg-kliko-blue px-5 py-2.5 text-sm font-bold text-white transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t("buurten.add")}
        </button>
      </form>

      {/* Opruimactie voor de oude dubbele seed */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={verwijderDubbele}
          disabled={dubbelBusy}
          className="rounded-full border-2 border-kliko-navy/20 px-4 py-2 text-xs font-bold text-kliko-navy hover:border-kliko-blue hover:text-kliko-blue disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t("buurten.dubbel.btn")}
        </button>
        {dubbelMelding && (
          <p role="status" className="text-sm font-semibold text-kliko-blue">
            {dubbelMelding}
          </p>
        )}
      </div>

      {saveError && (
        <p role="alert" className="mt-4 rounded-xl border border-kliko-red/30 bg-kliko-red/10 px-4 py-3 text-sm font-semibold text-kliko-red">
          {t("buurten.err.save")}
        </p>
      )}

      {loadError ? (
        <p className="mt-6 rounded-xl border border-kliko-red/30 bg-kliko-red/10 px-4 py-3 text-sm font-semibold text-kliko-red">
          {t("buurten.err.load")}
        </p>
      ) : buurten === null ? (
        <p className="py-10 text-center text-sm font-semibold text-kliko-navy/50">
          {t("buurten.loading")}
        </p>
      ) : buurten.length === 0 ? (
        <p className="py-10 text-center text-sm font-semibold text-kliko-navy/50">
          {t("buurten.empty")}
        </p>
      ) : (
        <ul className="mt-5 flex flex-col gap-2">
          {buurten.map((buurt, i) => (
            <li
              key={buurt.id}
              className={`flex flex-wrap items-center gap-2 rounded-xl border bg-white px-3 py-2.5 ${
                buurt.actief ? "border-kliko-navy/10" : "border-kliko-navy/10 opacity-60"
              }`}
            >
              {/* Volgorde */}
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => verplaats(i, -1)}
                  disabled={i === 0}
                  aria-label={t("buurten.omhoog")}
                  className="rounded p-0.5 text-kliko-navy/60 hover:text-kliko-blue disabled:opacity-25"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="5 15 12 8 19 15" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => verplaats(i, 1)}
                  disabled={i === buurten.length - 1}
                  aria-label={t("buurten.omlaag")}
                  className="rounded p-0.5 text-kliko-navy/60 hover:text-kliko-blue disabled:opacity-25"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="5 9 12 16 19 9" />
                  </svg>
                </button>
              </div>

              {/* Naam / hernoemen */}
              {editId === buurt.id ? (
                <input
                  value={editNaam}
                  onChange={(e) => setEditNaam(e.target.value)}
                  onBlur={() => hernoemen(buurt)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      hernoemen(buurt);
                    }
                    if (e.key === "Escape") setEditId(null);
                  }}
                  autoFocus
                  aria-label={t("form.naam")}
                  className="min-w-0 flex-1 rounded-lg border border-kliko-blue bg-white px-2.5 py-1.5 text-sm font-semibold text-kliko-navy focus:outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditId(buurt.id);
                    setEditNaam(buurt.naam);
                  }}
                  className="min-w-0 flex-1 truncate text-left text-sm font-bold text-kliko-navy hover:text-kliko-blue"
                >
                  {buurt.naam}
                </button>
              )}

              {/* Actief-toggle */}
              <button
                type="button"
                onClick={() => toggleActief(buurt)}
                aria-pressed={buurt.actief}
                className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                  buurt.actief
                    ? "bg-kliko-blue/10 text-kliko-blue"
                    : "bg-kliko-navy/10 text-kliko-navy/60"
                }`}
              >
                {buurt.actief ? t("buurten.actief") : t("buurten.inactief")}
              </button>

              {/* Verwijderen */}
              <button
                type="button"
                onClick={() => verwijderen(buurt)}
                aria-label={t("buurten.delete")}
                className="rounded-full p-1.5 text-kliko-red/70 hover:bg-kliko-red/10 hover:text-kliko-red"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M4 7h16" />
                  <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
                </svg>
              </button>

              {/* Selibon-ophaaldag + dagdeel: hele breedte, tweede regel */}
              <div className="flex w-full items-center gap-2">
                <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-kliko-navy/50">
                  {t("selibon.label")}
                </span>
                <select
                  value={buurt.selibonDag ?? ""}
                  onChange={(e) =>
                    wijzigSelibon(buurt, {
                      selibonDag:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  aria-label={t("buurten.selibon.dag")}
                  className={selectCls}
                >
                  <option value="">{t("selibon.onbekend")}</option>
                  {SELIBON_DAGEN.map((d) => (
                    <option key={d} value={d}>
                      {t(`dag.${d}`)}
                    </option>
                  ))}
                </select>
                <select
                  value={buurt.selibonDagdeel ?? ""}
                  onChange={(e) =>
                    wijzigSelibon(buurt, {
                      selibonDagdeel:
                        e.target.value === ""
                          ? null
                          : (e.target.value as SelibonDagdeel),
                    })
                  }
                  aria-label={t("buurten.selibon.dagdeel")}
                  className={selectCls}
                >
                  <option value="">{t("selibon.onbekend")}</option>
                  {DAGDELEN.map((dd) => (
                    <option key={dd} value={dd}>
                      {t(`dagdeel.${dd}`)}
                    </option>
                  ))}
                </select>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
