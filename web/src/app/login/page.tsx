"use client";

// Office-login met e-mail + wachtwoord.
// Extra: eerste-keer bootstrap. Staat het e-mailadres in de bootstrap-allowlist
// (auth-config.ts) maar bestaat er nog geen Auth-account, dan kan de gebruiker
// hier zelf een wachtwoord kiezen; dat maakt het account aan en schrijft direct
// het users/{uid}-doc. Daarna is het gewoon wachtwoord-login.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { LogoPrimary } from "@/components/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/lib/i18n";
import { getDb, getFirebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import { signOutOffice, useOfficeUser } from "@/lib/use-office-user";
import { allowlistEntryVoorEmail, rolVoorEmail, type Rol } from "@/lib/auth-config";
import { writeTeamUserDoc } from "@/lib/data/team";

const inputCls =
  "w-full rounded-xl border border-kliko-navy/20 bg-white px-4 py-3 text-base text-kliko-navy placeholder:text-kliko-navy/40 focus:border-kliko-blue focus:outline-none focus:ring-2 focus:ring-kliko-blue/30";

const labelCls = "mb-1.5 block text-sm font-bold text-kliko-navy";

export default function LoginPage() {
  const { t } = useI18n();
  const router = useRouter();
  const officeUser = useOfficeUser();

  const [mode, setMode] = useState<"login" | "first">("login");
  const [email, setEmail] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [wachtwoord2, setWachtwoord2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // Toon de bootstrap-optie na een mislukte login met een allowlist-e-mailadres.
  const [bootstrapMogelijk, setBootstrapMogelijk] = useState(false);

  const configured = isFirebaseConfigured();
  const emailGeldig = /^\S+@\S+\.\S+$/.test(email.trim());
  const allowEntry = allowlistEntryVoorEmail(email);

  function loginErrorTekst(err: unknown): string {
    if (err instanceof FirebaseError) {
      switch (err.code) {
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
        case "auth/invalid-login-credentials":
          return t("login.err.credentials");
        case "auth/too-many-requests":
          return t("login.err.toomany");
        case "auth/invalid-email":
          return t("form.err.email");
      }
    }
    return t("login.err.generic");
  }

  async function doLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!emailGeldig) {
      setError(t("form.err.email"));
      return;
    }
    setBusy(true);
    try {
      const cred = await signInWithEmailAndPassword(
        getFirebaseAuth(),
        email.trim().toLowerCase(),
        wachtwoord
      );
      // Route op rol: schoonmakers naar hun dagoverzicht, office naar /beheer.
      let rol: Rol | null = null;
      try {
        const snap = await getDoc(doc(getDb(), "users", cred.user.uid));
        if (snap.exists() && snap.data().actief !== false) {
          rol = (snap.data().rol as Rol) ?? null;
        }
      } catch {
        // users-doc niet leesbaar: val terug op allowlist hieronder
      }
      if (!rol) rol = rolVoorEmail(email);
      router.replace(rol === "schoonmaker" ? "/vandaag" : "/beheer/checklists");
    } catch (err) {
      setError(loginErrorTekst(err));
      // Firebase geeft bij onbekend account meestal invalid-credential terug
      // (e-mail-enumeratiebescherming), dus we tonen de eerste-keer-optie bij
      // elke credential-fout zolang het adres in de allowlist staat. Bestaat het
      // account toch al, dan vangt createUser dat af met "email-already-in-use".
      const code = err instanceof FirebaseError ? err.code : "";
      const credentialFout = [
        "auth/user-not-found",
        "auth/invalid-credential",
        "auth/invalid-login-credentials",
        "auth/wrong-password",
      ].includes(code);
      setBootstrapMogelijk(credentialFout && Boolean(allowEntry));
    } finally {
      setBusy(false);
    }
  }

  async function doBootstrap(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const entry = allowlistEntryVoorEmail(email);
    if (!entry) {
      // Zou niet moeten kunnen (mode "first" is alleen bereikbaar via allowlist).
      setMode("login");
      return;
    }
    if (wachtwoord.length < 6) {
      setError(t("login.err.weak"));
      return;
    }
    if (wachtwoord !== wachtwoord2) {
      setError(t("login.first.err.match"));
      return;
    }
    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(
        getFirebaseAuth(),
        email.trim().toLowerCase(),
        wachtwoord
      );
      // Meteen het users-doc schrijven zodat de rol vanaf nu uit Firestore komt.
      await writeTeamUserDoc(cred.user.uid, {
        naam: entry.naam,
        email: email.trim().toLowerCase(),
        rol: entry.rol,
        actief: true,
        aangemaaktOp: new Date().toISOString(),
      });
      router.replace("/beheer/checklists");
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : "";
      if (code === "auth/email-already-in-use") {
        setError(t("login.err.inuse"));
        setMode("login");
        setBootstrapMogelijk(false);
      } else if (code === "auth/weak-password") {
        setError(t("login.err.weak"));
      } else {
        setError(t("login.err.generic"));
      }
    } finally {
      setBusy(false);
    }
  }

  async function doReset() {
    setError(null);
    setInfo(null);
    if (!emailGeldig) {
      setError(t("login.reset.needemail"));
      return;
    }
    setBusy(true);
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), email.trim().toLowerCase());
      setInfo(t("login.reset.sent"));
    } catch {
      setError(t("login.reset.err"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-kliko-navy/[0.03]">
      <header className="border-b border-kliko-navy/10 bg-white">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/">
            <LogoPrimary height={44} priority />
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-kliko-navy/10 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-black tracking-tight text-kliko-navy">
            {mode === "first" ? t("login.first.title") : t("login.title")}
          </h1>

          {!configured ? (
            <p className="mt-4 rounded-xl border border-kliko-yellow bg-kliko-yellow/15 px-4 py-3 text-sm font-semibold text-kliko-navy">
              {t("login.offline")}
            </p>
          ) : officeUser.status === "office" ? (
            <div className="mt-4 flex flex-col gap-3">
              <p className="text-kliko-navy/70">
                {t("login.already")} ({officeUser.email})
              </p>
              <Link
                href="/beheer/checklists"
                className="rounded-full bg-kliko-blue px-5 py-3 text-center font-bold text-white transition-transform hover:scale-[1.02]"
              >
                {t("login.to.beheer")}
              </Link>
              <button
                onClick={() => signOutOffice()}
                className="text-sm font-semibold text-kliko-navy/60 hover:text-kliko-navy"
              >
                {t("login.signout")}
              </button>
            </div>
          ) : officeUser.status === "schoonmaker" ? (
            <div className="mt-4 flex flex-col gap-3">
              <p className="text-kliko-navy/70">
                {t("login.already")} ({officeUser.email})
              </p>
              <Link
                href="/vandaag"
                className="rounded-full bg-kliko-blue px-5 py-3 text-center font-bold text-white transition-transform hover:scale-[1.02]"
              >
                {t("login.to.vandaag")}
              </Link>
              <button
                onClick={() => signOutOffice()}
                className="text-sm font-semibold text-kliko-navy/60 hover:text-kliko-navy"
              >
                {t("login.signout")}
              </button>
            </div>
          ) : officeUser.status === "no-access" ? (
            <div className="mt-4 flex flex-col gap-3">
              <p className="rounded-xl border border-kliko-red/30 bg-kliko-red/10 px-4 py-3 text-sm font-semibold text-kliko-red">
                {t("login.noaccess")} ({officeUser.email})
              </p>
              <button
                onClick={() => signOutOffice()}
                className="text-sm font-semibold text-kliko-navy/60 hover:text-kliko-navy"
              >
                {t("login.signout")}
              </button>
            </div>
          ) : mode === "first" ? (
            <form onSubmit={doBootstrap} noValidate className="mt-4 flex flex-col gap-4">
              <p className="text-sm text-kliko-navy/70">{t("login.first.sub")}</p>
              <p className="rounded-xl bg-kliko-navy/5 px-4 py-2.5 text-sm font-semibold text-kliko-navy">
                {email.trim().toLowerCase()}
              </p>
              <div>
                <label htmlFor="pw1" className={labelCls}>
                  {t("login.first.pw")}
                </label>
                <input
                  id="pw1"
                  type="password"
                  className={inputCls}
                  value={wachtwoord}
                  onChange={(e) => setWachtwoord(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label htmlFor="pw2" className={labelCls}>
                  {t("login.first.pw2")}
                </label>
                <input
                  id="pw2"
                  type="password"
                  className={inputCls}
                  value={wachtwoord2}
                  onChange={(e) => setWachtwoord2(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              {error && (
                <p role="alert" className="text-sm font-semibold text-kliko-red">{error}</p>
              )}
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-kliko-yellow px-5 py-3 font-bold text-black transition-transform hover:scale-[1.02] disabled:opacity-60"
              >
                {busy ? t("login.busy") : t("login.first.submit")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                  setWachtwoord("");
                  setWachtwoord2("");
                }}
                className="text-sm font-semibold text-kliko-navy/60 hover:text-kliko-navy"
              >
                {t("login.first.cancel")}
              </button>
            </form>
          ) : (
            <form onSubmit={doLogin} noValidate className="mt-4 flex flex-col gap-4">
              <p className="text-sm text-kliko-navy/70">{t("login.sub")}</p>
              <div>
                <label htmlFor="email" className={labelCls}>
                  {t("login.email")}
                </label>
                <input
                  id="email"
                  type="email"
                  className={inputCls}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setBootstrapMogelijk(false);
                  }}
                  autoComplete="email"
                  inputMode="email"
                />
              </div>
              <div>
                <label htmlFor="password" className={labelCls}>
                  {t("login.password")}
                </label>
                <input
                  id="password"
                  type="password"
                  className={inputCls}
                  value={wachtwoord}
                  onChange={(e) => setWachtwoord(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              {error && (
                <p role="alert" className="text-sm font-semibold text-kliko-red">{error}</p>
              )}
              {info && (
                <p className="rounded-xl border border-kliko-blue/30 bg-kliko-blue/10 px-4 py-3 text-sm font-semibold text-kliko-navy">
                  {info}
                </p>
              )}
              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-kliko-yellow px-5 py-3 font-bold text-black transition-transform hover:scale-[1.02] disabled:opacity-60"
              >
                {busy ? t("login.busy") : t("login.submit")}
              </button>
              {bootstrapMogelijk && allowEntry && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("first");
                    setError(null);
                    setInfo(null);
                    setWachtwoord("");
                    setWachtwoord2("");
                  }}
                  className="rounded-full border-2 border-kliko-blue px-5 py-2.5 text-sm font-bold text-kliko-blue hover:bg-kliko-blue/5"
                >
                  {t("login.first.btn")}
                </button>
              )}
              <button
                type="button"
                onClick={doReset}
                disabled={busy}
                className="text-sm font-semibold text-kliko-navy/60 hover:text-kliko-navy disabled:opacity-60"
              >
                {t("login.forgot")}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
