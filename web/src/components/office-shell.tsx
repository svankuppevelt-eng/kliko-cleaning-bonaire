"use client";

// Shell + toegangs-gate voor het office-gedeelte (/beheer).
// Redirect naar /login wanneer niet ingelogd of geen rol;
// een schoonmaker hoort hier niet en gaat door naar /vandaag.
import { type ReactNode, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogoPrimary } from "@/components/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/lib/i18n";
import { signOutOffice, useOfficeUser } from "@/lib/use-office-user";

export function OfficeShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const router = useRouter();
  const user = useOfficeUser();

  useEffect(() => {
    if (user.status === "signed-out" || user.status === "no-access") {
      router.replace("/login");
    }
    if (user.status === "schoonmaker") {
      router.replace("/vandaag");
    }
  }, [user.status, router]);

  if (user.status === "schoonmaker") {
    // Nette melding terwijl de redirect naar /vandaag loopt.
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16">
        <p className="rounded-xl border border-kliko-yellow bg-kliko-yellow/15 px-4 py-3 text-sm font-semibold text-kliko-navy">
          {t("beheer.alleenkantoor")}
        </p>
        <Link
          href="/vandaag"
          className="mt-4 block rounded-full bg-kliko-blue px-5 py-3 text-center font-bold text-white"
        >
          {t("login.to.vandaag")}
        </Link>
      </div>
    );
  }

  if (user.status === "unconfigured") {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16">
        <p className="rounded-xl border border-kliko-yellow bg-kliko-yellow/15 px-4 py-3 text-sm font-semibold text-kliko-navy">
          {t("login.offline")}
        </p>
      </div>
    );
  }

  if (user.status !== "office") {
    // loading, of bezig met redirect naar /login
    return (
      <div className="grid flex-1 place-items-center py-24 text-kliko-navy/50">
        <span className="text-sm font-semibold">{t("beheer.loading")}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-kliko-navy/[0.03]">
      <header className="sticky top-0 z-30 border-b border-kliko-navy/10 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-5">
            <Link href="/beheer">
              <LogoPrimary height={40} priority />
            </Link>
            <nav className="hidden flex-wrap items-center gap-x-5 gap-y-1 text-sm font-semibold text-kliko-navy sm:flex">
              <Link href="/beheer" className="hover:text-kliko-blue">
                {t("shell.klanten")}
              </Link>
              <Link href="/beheer/planning" className="hover:text-kliko-blue">
                {t("shell.planning")}
              </Link>
              <Link href="/beheer/buurten" className="hover:text-kliko-blue">
                {t("shell.buurten")}
              </Link>
              <Link href="/beheer/instellingen" className="hover:text-kliko-blue">
                {t("shell.instellingen")}
              </Link>
              <Link href="/vandaag" className="hover:text-kliko-blue">
                {t("shell.vandaag")}
              </Link>
              {user.rol === "eigenaar" && (
                <Link href="/beheer/team" className="hover:text-kliko-blue">
                  {t("shell.team")}
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-2.5">
            <LanguageSwitcher />
            <button
              onClick={async () => {
                await signOutOffice();
                router.replace("/login");
              }}
              className="rounded-full border border-kliko-navy/20 px-3.5 py-1.5 text-xs font-bold text-kliko-navy hover:border-kliko-navy/40"
            >
              {t("shell.signout")}
            </button>
          </div>
        </div>
        {/* Mobiele nav-rij (desktop-nav zit hierboven, verborgen op mobiel).
            flex-wrap zodat de rij bij veel items netjes doorloopt op een
            tweede regel in plaats van horizontaal te scrollen. */}
        <nav className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-2.5 text-sm font-semibold text-kliko-navy sm:hidden">
          <Link href="/beheer" className="hover:text-kliko-blue">
            {t("shell.klanten")}
          </Link>
          <Link href="/beheer/planning" className="hover:text-kliko-blue">
            {t("shell.planning")}
          </Link>
          <Link href="/beheer/buurten" className="hover:text-kliko-blue">
            {t("shell.buurten")}
          </Link>
          <Link href="/beheer/instellingen" className="hover:text-kliko-blue">
            {t("shell.instellingen")}
          </Link>
          <Link href="/vandaag" className="hover:text-kliko-blue">
            {t("shell.vandaag")}
          </Link>
          {user.rol === "eigenaar" && (
            <Link href="/beheer/team" className="hover:text-kliko-blue">
              {t("shell.team")}
            </Link>
          )}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
