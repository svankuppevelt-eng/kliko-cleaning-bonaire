"use client";

// Teambeheer (alleen rol "eigenaar"): CRUD op Firestore-collectie `users`.
// - Aanmaken: Auth-account via secundaire app-instantie + users-doc (zie lib/data/team.ts).
// - Bewerken: naam, rol, actief-status + wachtwoord-reset-mail.
// - Verwijderen = toegang intrekken (users-doc weg); het Auth-account blijft
//   bestaan tot er later een Cloud Function/Admin-route is voor volledige verwijdering.
// - Bescherming: de laatste actieve eigenaar kan zichzelf niet verwijderen,
//   deactiveren of zijn rol verlagen.
import { useEffect, useMemo, useState } from "react";
import { FirebaseError } from "firebase/app";
import { useI18n } from "@/lib/i18n";
import { useOfficeUser } from "@/lib/use-office-user";
import type { Rol } from "@/lib/auth-config";
import {
  createTeamUser,
  listTeamUsers,
  revokeTeamUser,
  sendTeamPasswordReset,
  updateTeamUser,
  type TeamUser,
} from "@/lib/data/team";

const ROLLEN: Rol[] = ["eigenaar", "kantoor", "schoonmaker"];

const inputCls =
  "w-full rounded-xl border border-kliko-navy/20 bg-white px-4 py-2.5 text-base text-kliko-navy placeholder:text-kliko-navy/40 focus:border-kliko-blue focus:outline-none focus:ring-2 focus:ring-kliko-blue/30";
const labelCls = "mb-1 block text-sm font-bold text-kliko-navy";
const selectCls =
  "w-full rounded-xl border border-kliko-navy/20 bg-white px-3 py-2.5 text-sm font-semibold text-kliko-navy focus:border-kliko-blue focus:outline-none";
const primaryBtn =
  "rounded-full bg-kliko-blue px-5 py-2.5 text-sm font-bold text-white transition-transform hover:scale-[1.02] disabled:opacity-60";
const ghostBtn =
  "rounded-full border border-kliko-navy/20 px-4 py-2 text-sm font-bold text-kliko-navy hover:border-kliko-navy/40 disabled:opacity-60";
const dangerBtn =
  "rounded-full border border-kliko-red/40 px-4 py-2 text-sm font-bold text-kliko-red hover:bg-kliko-red/5 disabled:opacity-60";

const ROL_STYLE: Record<Rol, string> = {
  eigenaar: "bg-kliko-navy/10 text-kliko-navy",
  kantoor: "bg-kliko-blue/10 text-kliko-blue",
  schoonmaker: "bg-kliko-yellow/25 text-kliko-navy",
};

export default function TeamPage() {
  const { t, lang } = useI18n();
  const officeUser = useOfficeUser();

  const [users, setUsers] = useState<TeamUser[] | null>(null);
  const [loadError, setLoadError] = useState(false);

  // Nieuw teamlid
  const [createOpen, setCreateOpen] = useState(false);
  const [nieuwNaam, setNieuwNaam] = useState("");
  const [nieuwEmail, setNieuwEmail] = useState("");
  const [nieuwRol, setNieuwRol] = useState<Rol>("kantoor");
  const [nieuwPw, setNieuwPw] = useState("");
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Bewerken (1 kaart tegelijk)
  const [editUid, setEditUid] = useState<string | null>(null);
  const [editNaam, setEditNaam] = useState("");
  const [editRol, setEditRol] = useState<Rol>("kantoor");
  const [editActief, setEditActief] = useState(true);
  const [editBusy, setEditBusy] = useState(false);

  // Per-kaart melding (reset-mail verstuurd, foutmelding, ...)
  const [notice, setNotice] = useState<{ uid: string; tekst: string; fout: boolean } | null>(null);

  const isEigenaar = officeUser.status === "office" && officeUser.rol === "eigenaar";
  const mijnUid = officeUser.status === "office" ? officeUser.user.uid : null;

  useEffect(() => {
    if (!isEigenaar) return;
    listTeamUsers()
      .then(setUsers)
      .catch(() => setLoadError(true));
  }, [isEigenaar]);

  const actieveEigenaars = useMemo(
    () => (users ?? []).filter((u) => u.rol === "eigenaar" && u.actief).length,
    [users]
  );

  /** True als deze wijziging/verwijdering de laatste actieve eigenaar zou buitensluiten. */
  function sluitZichzelfBuiten(u: TeamUser, nieuweRol?: Rol, nieuwActief?: boolean): boolean {
    if (u.uid !== mijnUid) return false;
    if (!(u.rol === "eigenaar" && u.actief)) return false;
    if (actieveEigenaars > 1) return false;
    const rolNa = nieuweRol ?? u.rol;
    const actiefNa = nieuwActief ?? u.actief;
    return rolNa !== "eigenaar" || !actiefNa;
  }

  async function doCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    if (!nieuwNaam.trim() || !/^\S+@\S+\.\S+$/.test(nieuwEmail.trim())) {
      setCreateError(!nieuwNaam.trim() ? t("form.err.required") : t("form.err.email"));
      return;
    }
    if (nieuwPw.length < 6) {
      setCreateError(t("login.err.weak"));
      return;
    }
    setCreateBusy(true);
    try {
      const nieuw = await createTeamUser({
        naam: nieuwNaam,
        email: nieuwEmail,
        rol: nieuwRol,
        wachtwoord: nieuwPw,
      });
      setUsers((prev) => [...(prev ?? []), nieuw]);
      setCreateOpen(false);
      setNieuwNaam("");
      setNieuwEmail("");
      setNieuwRol("kantoor");
      setNieuwPw("");
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : "";
      if (code === "auth/email-already-in-use") setCreateError(t("login.err.inuse"));
      else if (code === "auth/weak-password") setCreateError(t("login.err.weak"));
      else if (code === "auth/invalid-email") setCreateError(t("form.err.email"));
      else setCreateError(t("team.err.create"));
    } finally {
      setCreateBusy(false);
    }
  }

  function openEdit(u: TeamUser) {
    setEditUid(u.uid);
    setEditNaam(u.naam);
    setEditRol(u.rol);
    setEditActief(u.actief);
    setNotice(null);
  }

  async function doSave(u: TeamUser) {
    setNotice(null);
    if (!editNaam.trim()) {
      setNotice({ uid: u.uid, tekst: t("form.err.required"), fout: true });
      return;
    }
    if (sluitZichzelfBuiten(u, editRol, editActief)) {
      setNotice({ uid: u.uid, tekst: t("team.err.lastowner"), fout: true });
      return;
    }
    setEditBusy(true);
    try {
      await updateTeamUser(u.uid, { naam: editNaam.trim(), rol: editRol, actief: editActief });
      setUsers((prev) =>
        (prev ?? []).map((x) =>
          x.uid === u.uid ? { ...x, naam: editNaam.trim(), rol: editRol, actief: editActief } : x
        )
      );
      setEditUid(null);
    } catch {
      setNotice({ uid: u.uid, tekst: t("team.err.save"), fout: true });
    } finally {
      setEditBusy(false);
    }
  }

  async function doRevoke(u: TeamUser) {
    setNotice(null);
    if (sluitZichzelfBuiten(u, undefined, false)) {
      setNotice({ uid: u.uid, tekst: t("team.err.lastowner"), fout: true });
      return;
    }
    if (!window.confirm(t("team.delete.confirm"))) return;
    try {
      await revokeTeamUser(u.uid);
      setUsers((prev) => (prev ?? []).filter((x) => x.uid !== u.uid));
      if (editUid === u.uid) setEditUid(null);
    } catch {
      setNotice({ uid: u.uid, tekst: t("team.err.delete"), fout: true });
    }
  }

  async function doReset(u: TeamUser) {
    setNotice(null);
    try {
      await sendTeamPasswordReset(u.email);
      setNotice({ uid: u.uid, tekst: t("team.reset.sent"), fout: false });
    } catch {
      setNotice({ uid: u.uid, tekst: t("team.reset.err"), fout: true });
    }
  }

  // Gate: alleen eigenaars beheren het team. Kantoor/schoonmaker krijgen een nette melding.
  if (officeUser.status === "office" && !isEigenaar) {
    return (
      <p className="rounded-xl border border-kliko-red/30 bg-kliko-red/10 px-4 py-3 text-sm font-semibold text-kliko-red">
        {t("team.noaccess")}
      </p>
    );
  }
  if (!isEigenaar) {
    // loading / redirect wordt al door OfficeShell afgehandeld
    return null;
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-kliko-navy sm:text-3xl">
            {t("team.title")}
            {users && (
              <span className="ml-2 align-middle text-base font-bold text-kliko-navy/40">
                {users.length}
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-kliko-navy/60">{t("team.sub")}</p>
        </div>
        {!createOpen && (
          <button onClick={() => setCreateOpen(true)} className={primaryBtn}>
            {t("team.new")}
          </button>
        )}
      </div>

      {/* Nieuw teamlid */}
      {createOpen && (
        <form
          onSubmit={doCreate}
          noValidate
          className="mt-5 rounded-2xl border border-kliko-blue/30 bg-white p-4 shadow-sm sm:p-5"
        >
          <h2 className="text-lg font-black text-kliko-navy">{t("team.new")}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="nieuw-naam" className={labelCls}>
                {t("form.naam")}
              </label>
              <input
                id="nieuw-naam"
                className={inputCls}
                value={nieuwNaam}
                onChange={(e) => setNieuwNaam(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="nieuw-email" className={labelCls}>
                {t("form.email")}
              </label>
              <input
                id="nieuw-email"
                type="email"
                className={inputCls}
                value={nieuwEmail}
                onChange={(e) => setNieuwEmail(e.target.value)}
                autoComplete="off"
                inputMode="email"
              />
            </div>
            <div>
              <label htmlFor="nieuw-rol" className={labelCls}>
                {t("team.form.rol")}
              </label>
              <select
                id="nieuw-rol"
                className={selectCls}
                value={nieuwRol}
                onChange={(e) => setNieuwRol(e.target.value as Rol)}
              >
                {ROLLEN.map((r) => (
                  <option key={r} value={r}>
                    {t(`rol.${r}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="nieuw-pw" className={labelCls}>
                {t("team.form.pw")}
              </label>
              <input
                id="nieuw-pw"
                type="password"
                className={inputCls}
                value={nieuwPw}
                onChange={(e) => setNieuwPw(e.target.value)}
                autoComplete="new-password"
              />
              <p className="mt-1 text-xs text-kliko-navy/50">{t("team.form.pw.hint")}</p>
            </div>
          </div>
          {createError && (
            <p role="alert" className="mt-3 text-sm font-semibold text-kliko-red">
              {createError}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="submit" disabled={createBusy} className={primaryBtn}>
              {createBusy ? t("team.form.busy") : t("team.form.create")}
            </button>
            <button
              type="button"
              disabled={createBusy}
              onClick={() => {
                setCreateOpen(false);
                setCreateError(null);
              }}
              className={ghostBtn}
            >
              {t("team.form.cancel")}
            </button>
          </div>
        </form>
      )}

      {/* Lijst */}
      <div className="mt-6">
        {loadError ? (
          <p className="rounded-xl border border-kliko-red/30 bg-kliko-red/10 px-4 py-3 text-sm font-semibold text-kliko-red">
            {t("team.err.load")}
          </p>
        ) : users === null ? (
          <p className="py-10 text-center text-sm font-semibold text-kliko-navy/50">
            {t("team.loading")}
          </p>
        ) : users.length === 0 ? (
          <p className="py-10 text-center text-sm font-semibold text-kliko-navy/50">
            {t("team.empty")}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {users.map((u) => (
              <li
                key={u.uid}
                className="rounded-2xl border border-kliko-navy/10 bg-white p-4 shadow-sm"
              >
                {editUid === u.uid ? (
                  <div className="flex flex-col gap-3">
                    <div>
                      <label htmlFor={`edit-naam-${u.uid}`} className={labelCls}>
                        {t("form.naam")}
                      </label>
                      <input
                        id={`edit-naam-${u.uid}`}
                        className={inputCls}
                        value={editNaam}
                        onChange={(e) => setEditNaam(e.target.value)}
                      />
                    </div>
                    <div>
                      <label htmlFor={`edit-rol-${u.uid}`} className={labelCls}>
                        {t("team.form.rol")}
                      </label>
                      <select
                        id={`edit-rol-${u.uid}`}
                        className={selectCls}
                        value={editRol}
                        onChange={(e) => setEditRol(e.target.value as Rol)}
                      >
                        {ROLLEN.map((r) => (
                          <option key={r} value={r}>
                            {t(`rol.${r}`)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <label className="flex items-center gap-2 text-sm font-semibold text-kliko-navy">
                      <input
                        type="checkbox"
                        checked={editActief}
                        onChange={(e) => setEditActief(e.target.checked)}
                        className="h-4 w-4 accent-kliko-blue"
                      />
                      {t("team.actief.label")}
                    </label>
                    {notice && notice.uid === u.uid && (
                      <p
                        role="alert"
                        className={`text-sm font-semibold ${notice.fout ? "text-kliko-red" : "text-kliko-blue"}`}
                      >
                        {notice.tekst}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => doSave(u)} disabled={editBusy} className={primaryBtn}>
                        {editBusy ? t("team.form.busy") : t("team.save")}
                      </button>
                      <button
                        onClick={() => {
                          setEditUid(null);
                          setNotice(null);
                        }}
                        disabled={editBusy}
                        className={ghostBtn}
                      >
                        {t("team.form.cancel")}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 border-t border-kliko-navy/10 pt-3">
                      <button onClick={() => doReset(u)} className={ghostBtn}>
                        {t("team.reset")}
                      </button>
                      <button onClick={() => doRevoke(u)} className={dangerBtn}>
                        {t("team.delete")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-kliko-navy">
                        {u.naam}
                        {u.uid === mijnUid && (
                          <span className="ml-1.5 text-xs font-bold text-kliko-navy/40">
                            ({t("team.you")})
                          </span>
                        )}
                      </span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${ROL_STYLE[u.rol]}`}
                        >
                          {t(`rol.${u.rol}`)}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            u.actief
                              ? "bg-kliko-blue/10 text-kliko-blue"
                              : "bg-kliko-red/10 text-kliko-red"
                          }`}
                        >
                          {u.actief ? t("status.actief") : t("team.status.inactief")}
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 break-all text-sm text-kliko-navy/70">{u.email}</p>
                    <p className="mt-1 text-xs text-kliko-navy/45">
                      {t("beheer.aangemaakt")}:{" "}
                      {new Date(u.aangemaaktOp).toLocaleDateString(
                        lang === "en" ? "en-GB" : "nl-NL"
                      )}
                    </p>
                    {notice && notice.uid === u.uid && (
                      <p
                        role="alert"
                        className={`mt-2 text-sm font-semibold ${notice.fout ? "text-kliko-red" : "text-kliko-blue"}`}
                      >
                        {notice.tekst}
                      </p>
                    )}
                    <div className="mt-3">
                      <button onClick={() => openEdit(u)} className={ghostBtn}>
                        {t("team.edit")}
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
