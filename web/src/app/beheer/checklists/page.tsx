"use client";

// Office: checklists beheren (bv. het opstart-draaiboek van het bedrijf).
// Checklists aanmaken/hernoemen/verwijderen, items toevoegen/bewerken/
// afvinken/verwijderen en de volgorde wijzigen. Bij eerste bezoek wordt het
// opstart-draaiboek geseed (idempotent, alleen als de collectie leeg is).
// Alle wijzigingen: optimistic update + rollback bij fout.
import { useEffect, useState } from "react";
import { useI18n, type Lang } from "@/lib/i18n";
import { isFirebaseConfigured } from "@/lib/firebase";
import { useOfficeUser } from "@/lib/use-office-user";
import {
  herschikItems,
  listChecklists,
  maakChecklist,
  seedChecklistsAlsLeeg,
  toggleItem,
  updateChecklist,
  verwijderChecklist,
  verwijderItem,
  voegItemToe,
  wijzigItem,
  type Checklist,
  type ChecklistItem,
} from "@/lib/data/checklists";

const inputCls =
  "w-full rounded-xl border border-kliko-navy/20 bg-white px-4 py-2.5 text-base text-kliko-navy placeholder:text-kliko-navy/40 focus:border-kliko-blue focus:outline-none focus:ring-2 focus:ring-kliko-blue/30";

/** Datum + tijd van afvinken, kort en leesbaar in de gekozen taal. */
function formatMoment(iso: string, lang: Lang): string {
  const locale = lang === "en" ? "en-GB" : "nl-NL";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ChecklistsPage() {
  const { t, lang } = useI18n();
  const user = useOfficeUser();
  const eigenNaam =
    user.status === "office" ? user.naam || user.email : "";

  // Zonder Firebase-config: meteen een lege lijst (lazy initializer).
  const [lijsten, setLijsten] = useState<Checklist[] | null>(() =>
    isFirebaseConfigured() ? null : []
  );
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);

  // Opengeklapte checklists.
  const [open, setOpen] = useState<Set<string>>(new Set());

  // Nieuwe checklist.
  const [nieuwTitel, setNieuwTitel] = useState("");
  const [addBusy, setAddBusy] = useState(false);

  // Hernoemen checklist: 1 tegelijk.
  const [editLijstId, setEditLijstId] = useState<string | null>(null);
  const [editTitel, setEditTitel] = useState("");

  // Nieuw item per checklist.
  const [nieuwItem, setNieuwItem] = useState<Record<string, string>>({});
  const [itemBusyId, setItemBusyId] = useState<string | null>(null);

  // Item-tekst bewerken: 1 tegelijk (sleutel = `${checklistId}:${itemId}`).
  const [editItemKey, setEditItemKey] = useState<string | null>(null);
  const [editItemTekst, setEditItemTekst] = useState("");

  // Notitie bewerken: 1 tegelijk.
  const [notitieKey, setNotitieKey] = useState<string | null>(null);
  const [notitieTekst, setNotitieTekst] = useState("");

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    // Seed eerst (doet niets als er al checklists zijn), daarna laden.
    seedChecklistsAlsLeeg()
      .catch(() => {
        // Seed mislukt (bv. rules): lijst alsnog proberen te laden.
      })
      .then(() => listChecklists())
      .then(setLijsten)
      .catch(() => setLoadError(true));
  }, []);

  /** Eén checklist in de lokale state vervangen. */
  const zetLijst = (id: string, wijzig: (c: Checklist) => Checklist) =>
    setLijsten((huidig) =>
      (huidig ?? []).map((c) => (c.id === id ? wijzig(c) : c))
    );

  const toggleOpen = (id: string) =>
    setOpen((huidig) => {
      const volgend = new Set(huidig);
      if (volgend.has(id)) volgend.delete(id);
      else volgend.add(id);
      return volgend;
    });

  async function nieuweChecklist(e: React.FormEvent) {
    e.preventDefault();
    const titel = nieuwTitel.trim();
    if (!titel || addBusy) return;
    setSaveError(false);
    setAddBusy(true);
    try {
      const lijst = await maakChecklist(titel);
      setLijsten((huidig) => [...(huidig ?? []), lijst]);
      setOpen((huidig) => new Set(huidig).add(lijst.id));
      setNieuwTitel("");
    } catch {
      setSaveError(true);
    } finally {
      setAddBusy(false);
    }
  }

  async function hernoemen(lijst: Checklist) {
    const titel = editTitel.trim();
    setEditLijstId(null);
    if (!titel || titel === lijst.titel) return;
    setSaveError(false);
    zetLijst(lijst.id, (c) => ({ ...c, titel }));
    try {
      await updateChecklist(lijst.id, { titel });
    } catch {
      zetLijst(lijst.id, (c) => ({ ...c, titel: lijst.titel }));
      setSaveError(true);
    }
  }

  async function verwijderLijst(lijst: Checklist) {
    if (!window.confirm(t("checklists.delete.confirm"))) return;
    setSaveError(false);
    const oud = lijsten ?? [];
    setLijsten(oud.filter((c) => c.id !== lijst.id));
    try {
      await verwijderChecklist(lijst.id);
    } catch {
      setLijsten(oud);
      setSaveError(true);
    }
  }

  async function itemToevoegen(lijst: Checklist, e: React.FormEvent) {
    e.preventDefault();
    const tekst = (nieuwItem[lijst.id] ?? "").trim();
    if (!tekst || itemBusyId) return;
    setSaveError(false);
    setItemBusyId(lijst.id);
    try {
      const item = await voegItemToe(lijst.id, tekst);
      zetLijst(lijst.id, (c) => ({ ...c, items: [...c.items, item] }));
      setNieuwItem((huidig) => ({ ...huidig, [lijst.id]: "" }));
    } catch {
      setSaveError(true);
    } finally {
      setItemBusyId(null);
    }
  }

  async function itemAfvinken(lijst: Checklist, item: ChecklistItem) {
    setSaveError(false);
    const gedaan = !item.gedaan;
    const zetItem = (velden: Partial<ChecklistItem>) =>
      zetLijst(lijst.id, (c) => ({
        ...c,
        items: c.items.map((it) =>
          it.id === item.id ? { ...it, ...velden } : it
        ),
      }));
    zetItem({
      gedaan,
      gedaanOp: gedaan ? new Date().toISOString() : null,
      gedaanDoorNaam: gedaan ? eigenNaam || null : null,
    });
    try {
      await toggleItem(lijst.id, item.id, gedaan, eigenNaam);
    } catch {
      zetItem({
        gedaan: item.gedaan,
        gedaanOp: item.gedaanOp ?? null,
        gedaanDoorNaam: item.gedaanDoorNaam ?? null,
      });
      setSaveError(true);
    }
  }

  async function itemTekstOpslaan(lijst: Checklist, item: ChecklistItem) {
    const tekst = editItemTekst.trim();
    setEditItemKey(null);
    if (!tekst || tekst === item.tekst) return;
    setSaveError(false);
    const zetTekst = (nieuweTekst: string) =>
      zetLijst(lijst.id, (c) => ({
        ...c,
        items: c.items.map((it) =>
          it.id === item.id ? { ...it, tekst: nieuweTekst } : it
        ),
      }));
    zetTekst(tekst);
    try {
      await wijzigItem(lijst.id, item.id, { tekst });
    } catch {
      zetTekst(item.tekst);
      setSaveError(true);
    }
  }

  async function notitieOpslaan(lijst: Checklist, item: ChecklistItem) {
    const notitie = notitieTekst.trim();
    setNotitieKey(null);
    if (notitie === (item.notitie ?? "")) return;
    setSaveError(false);
    const zetNotitie = (n: string) =>
      zetLijst(lijst.id, (c) => ({
        ...c,
        items: c.items.map((it) =>
          it.id === item.id ? { ...it, notitie: n } : it
        ),
      }));
    zetNotitie(notitie);
    try {
      await wijzigItem(lijst.id, item.id, { notitie });
    } catch {
      zetNotitie(item.notitie ?? "");
      setSaveError(true);
    }
  }

  async function itemVerwijderen(lijst: Checklist, item: ChecklistItem) {
    if (!window.confirm(t("checklists.item.delete.confirm"))) return;
    setSaveError(false);
    const oudeItems = lijst.items;
    zetLijst(lijst.id, (c) => ({
      ...c,
      items: c.items.filter((it) => it.id !== item.id),
    }));
    try {
      await verwijderItem(lijst.id, item.id);
    } catch {
      zetLijst(lijst.id, (c) => ({ ...c, items: oudeItems }));
      setSaveError(true);
    }
  }

  async function itemVerplaatsen(
    lijst: Checklist,
    index: number,
    richting: -1 | 1
  ) {
    const doel = index + richting;
    if (doel < 0 || doel >= lijst.items.length) return;
    setSaveError(false);
    const oudeItems = lijst.items;
    const nieuw = [...lijst.items];
    [nieuw[index], nieuw[doel]] = [nieuw[doel], nieuw[index]];
    const hernummerd = nieuw.map((it, i) => ({ ...it, volgorde: (i + 1) * 10 }));
    zetLijst(lijst.id, (c) => ({ ...c, items: hernummerd }));
    try {
      await herschikItems(lijst.id, hernummerd);
    } catch {
      zetLijst(lijst.id, (c) => ({ ...c, items: oudeItems }));
      setSaveError(true);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-black tracking-tight text-kliko-navy sm:text-3xl">
        {t("checklists.title")}
      </h1>
      <p className="mt-1 text-sm text-kliko-navy/60">{t("checklists.sub")}</p>

      {/* Nieuwe checklist */}
      <form onSubmit={nieuweChecklist} className="mt-5 flex gap-2">
        <input
          value={nieuwTitel}
          onChange={(e) => setNieuwTitel(e.target.value)}
          placeholder={t("checklists.new.placeholder")}
          className={inputCls}
        />
        <button
          type="submit"
          disabled={addBusy || !nieuwTitel.trim()}
          className="shrink-0 rounded-full bg-kliko-blue px-5 py-2.5 text-sm font-bold text-white transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {t("checklists.new.add")}
        </button>
      </form>

      {saveError && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-kliko-red/30 bg-kliko-red/10 px-4 py-3 text-sm font-semibold text-kliko-red"
        >
          {t("checklists.err.save")}
        </p>
      )}

      {loadError ? (
        <p className="mt-6 rounded-xl border border-kliko-red/30 bg-kliko-red/10 px-4 py-3 text-sm font-semibold text-kliko-red">
          {t("checklists.err.load")}
        </p>
      ) : lijsten === null ? (
        <p className="py-10 text-center text-sm font-semibold text-kliko-navy/50">
          {t("checklists.loading")}
        </p>
      ) : lijsten.length === 0 ? (
        <p className="py-10 text-center text-sm font-semibold text-kliko-navy/50">
          {t("checklists.empty")}
        </p>
      ) : (
        <ul className="mt-5 flex flex-col gap-3">
          {lijsten.map((lijst) => {
            const totaal = lijst.items.length;
            const klaar = lijst.items.filter((it) => it.gedaan).length;
            const pct = totaal === 0 ? 0 : Math.round((klaar / totaal) * 100);
            const isOpen = open.has(lijst.id);
            return (
              <li
                key={lijst.id}
                className="rounded-2xl border border-kliko-navy/10 bg-white"
              >
                {/* Kop: open/dicht, titel (klik = hernoemen), teller, weg */}
                <div className="flex items-center gap-2 px-3 py-3">
                  <button
                    type="button"
                    onClick={() => toggleOpen(lijst.id)}
                    aria-expanded={isOpen}
                    aria-label={
                      isOpen ? t("checklists.sluiten") : t("checklists.open")
                    }
                    className="shrink-0 rounded-lg p-2 text-kliko-navy/60 hover:bg-kliko-navy/5 hover:text-kliko-blue"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`transition-transform ${isOpen ? "rotate-90" : ""}`}
                    >
                      <polyline points="9 5 16 12 9 19" />
                    </svg>
                  </button>

                  {editLijstId === lijst.id ? (
                    <input
                      value={editTitel}
                      onChange={(e) => setEditTitel(e.target.value)}
                      onBlur={() => hernoemen(lijst)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          hernoemen(lijst);
                        }
                        if (e.key === "Escape") setEditLijstId(null);
                      }}
                      autoFocus
                      aria-label={t("checklists.new.placeholder")}
                      className="min-w-0 flex-1 rounded-lg border border-kliko-blue bg-white px-2.5 py-1.5 text-sm font-bold text-kliko-navy focus:outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditLijstId(lijst.id);
                        setEditTitel(lijst.titel);
                      }}
                      className="min-w-0 flex-1 truncate text-left text-sm font-bold text-kliko-navy hover:text-kliko-blue"
                    >
                      {lijst.titel}
                    </button>
                  )}

                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                      totaal > 0 && klaar === totaal
                        ? "bg-kliko-blue/10 text-kliko-blue"
                        : "bg-kliko-navy/10 text-kliko-navy/70"
                    }`}
                  >
                    {klaar}/{totaal}
                  </span>

                  <button
                    type="button"
                    onClick={() => verwijderLijst(lijst)}
                    aria-label={t("checklists.delete")}
                    className="shrink-0 rounded-full p-1.5 text-kliko-red/70 hover:bg-kliko-red/10 hover:text-kliko-red"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="M4 7h16" />
                      <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
                    </svg>
                  </button>
                </div>

                {/* Voortgangsbalk */}
                <div className="px-4 pb-3">
                  <div className="h-1.5 overflow-hidden rounded-full bg-kliko-navy/10">
                    <div
                      className="h-full rounded-full bg-kliko-blue transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-kliko-navy/10 px-3 py-3">
                    <ul className="flex flex-col gap-1">
                      {lijst.items.map((item, i) => {
                        const itemKey = `${lijst.id}:${item.id}`;
                        return (
                          <li
                            key={item.id}
                            className="flex items-start gap-2 rounded-xl px-1 py-1.5 hover:bg-kliko-navy/[0.03]"
                          >
                            {/* Grote afvink-checkbox */}
                            <button
                              type="button"
                              onClick={() => itemAfvinken(lijst, item)}
                              role="checkbox"
                              aria-checked={item.gedaan}
                              aria-label={t("checklists.item.toggle")}
                              className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border-2 transition-colors ${
                                item.gedaan
                                  ? "border-kliko-blue bg-kliko-blue text-white"
                                  : "border-kliko-navy/25 bg-white text-transparent hover:border-kliko-blue"
                              }`}
                            >
                              <svg
                                viewBox="0 0 24 24"
                                width="18"
                                height="18"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="5 13 10 18 19 7" />
                              </svg>
                            </button>

                            {/* Tekst + gedaan-info + notitie */}
                            <div className="min-w-0 flex-1">
                              {editItemKey === itemKey ? (
                                <input
                                  value={editItemTekst}
                                  onChange={(e) =>
                                    setEditItemTekst(e.target.value)
                                  }
                                  onBlur={() => itemTekstOpslaan(lijst, item)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      itemTekstOpslaan(lijst, item);
                                    }
                                    if (e.key === "Escape")
                                      setEditItemKey(null);
                                  }}
                                  autoFocus
                                  aria-label={t("checklists.item.placeholder")}
                                  className="w-full rounded-lg border border-kliko-blue bg-white px-2.5 py-1.5 text-sm text-kliko-navy focus:outline-none"
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditItemKey(itemKey);
                                    setEditItemTekst(item.tekst);
                                  }}
                                  className={`w-full py-1 text-left text-sm font-semibold hover:text-kliko-blue ${
                                    item.gedaan
                                      ? "text-kliko-navy/45 line-through"
                                      : "text-kliko-navy"
                                  }`}
                                >
                                  {item.tekst}
                                </button>
                              )}

                              {item.gedaan && item.gedaanOp && (
                                <p className="text-xs text-kliko-navy/40">
                                  {item.gedaanDoorNaam
                                    ? `${item.gedaanDoorNaam}, `
                                    : ""}
                                  {formatMoment(item.gedaanOp, lang)}
                                </p>
                              )}

                              {notitieKey === itemKey ? (
                                <input
                                  value={notitieTekst}
                                  onChange={(e) =>
                                    setNotitieTekst(e.target.value)
                                  }
                                  onBlur={() => notitieOpslaan(lijst, item)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      notitieOpslaan(lijst, item);
                                    }
                                    if (e.key === "Escape")
                                      setNotitieKey(null);
                                  }}
                                  autoFocus
                                  placeholder={t(
                                    "checklists.item.notitie.placeholder"
                                  )}
                                  aria-label={t("checklists.item.notitie.add")}
                                  className="mt-1 w-full rounded-lg border border-kliko-blue bg-white px-2.5 py-1.5 text-xs text-kliko-navy focus:outline-none"
                                />
                              ) : item.notitie ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNotitieKey(itemKey);
                                    setNotitieTekst(item.notitie ?? "");
                                  }}
                                  className="mt-0.5 w-full text-left text-xs italic text-kliko-navy/55 hover:text-kliko-blue"
                                >
                                  {item.notitie}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNotitieKey(itemKey);
                                    setNotitieTekst("");
                                  }}
                                  className="mt-0.5 text-xs font-semibold text-kliko-navy/35 hover:text-kliko-blue"
                                >
                                  + {t("checklists.item.notitie.add")}
                                </button>
                              )}
                            </div>

                            {/* Volgorde */}
                            <div className="flex shrink-0 flex-col">
                              <button
                                type="button"
                                onClick={() => itemVerplaatsen(lijst, i, -1)}
                                disabled={i === 0}
                                aria-label={t("checklists.item.omhoog")}
                                className="rounded p-1 text-kliko-navy/60 hover:text-kliko-blue disabled:opacity-25"
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  width="14"
                                  height="14"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                >
                                  <polyline points="5 15 12 8 19 15" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => itemVerplaatsen(lijst, i, 1)}
                                disabled={i === lijst.items.length - 1}
                                aria-label={t("checklists.item.omlaag")}
                                className="rounded p-1 text-kliko-navy/60 hover:text-kliko-blue disabled:opacity-25"
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  width="14"
                                  height="14"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                >
                                  <polyline points="5 9 12 16 19 9" />
                                </svg>
                              </button>
                            </div>

                            {/* Item verwijderen */}
                            <button
                              type="button"
                              onClick={() => itemVerwijderen(lijst, item)}
                              aria-label={t("checklists.item.delete")}
                              className="mt-1 shrink-0 rounded-full p-1.5 text-kliko-red/60 hover:bg-kliko-red/10 hover:text-kliko-red"
                            >
                              <svg
                                viewBox="0 0 24 24"
                                width="14"
                                height="14"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                              >
                                <path d="M4 7h16" />
                                <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                <path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
                              </svg>
                            </button>
                          </li>
                        );
                      })}
                    </ul>

                    {/* Item toevoegen */}
                    <form
                      onSubmit={(e) => itemToevoegen(lijst, e)}
                      className="mt-3 flex gap-2"
                    >
                      <input
                        value={nieuwItem[lijst.id] ?? ""}
                        onChange={(e) =>
                          setNieuwItem((huidig) => ({
                            ...huidig,
                            [lijst.id]: e.target.value,
                          }))
                        }
                        placeholder={t("checklists.item.placeholder")}
                        className="min-w-0 flex-1 rounded-xl border border-kliko-navy/20 bg-white px-3.5 py-2 text-sm text-kliko-navy placeholder:text-kliko-navy/40 focus:border-kliko-blue focus:outline-none focus:ring-2 focus:ring-kliko-blue/30"
                      />
                      <button
                        type="submit"
                        disabled={
                          itemBusyId === lijst.id ||
                          !(nieuwItem[lijst.id] ?? "").trim()
                        }
                        className="shrink-0 rounded-full bg-kliko-blue px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {t("checklists.item.add")}
                      </button>
                    </form>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
