"use client";

// Shell + toegangs-gate voor het office-gedeelte (/beheer).
// Navigatie is gegroepeerd in categorieen (Operatie, Financieel, Verkoop,
// Beheer) in een zijbalk op desktop en een uitschuifmenu op mobiel.
// Redirect naar /login wanneer niet ingelogd of geen rol; een schoonmaker
// hoort hier niet en gaat door naar /vandaag.
import { type ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogoPrimary } from "@/components/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/lib/i18n";
import { signOutOffice, useOfficeUser } from "@/lib/use-office-user";

type NavItem = { href: string; label: string };
type NavGroup = { label: string; items: NavItem[] };

export function OfficeShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const user = useOfficeUser();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (user.status === "signed-out" || user.status === "no-access") {
      router.replace("/login");
    }
    if (user.status === "schoonmaker") {
      router.replace("/vandaag");
    }
  }, [user.status, router]);

  if (user.status === "schoonmaker") {
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
    return (
      <div className="grid flex-1 place-items-center py-24 text-kliko-navy/50">
        <span className="text-sm font-semibold">{t("beheer.loading")}</span>
      </div>
    );
  }

  const groups: NavGroup[] = [
    {
      label: t("navgroep.operatie"),
      items: [
        { href: "/beheer/overzicht", label: t("shell.overzicht") },
        { href: "/beheer", label: t("shell.klanten") },
        { href: "/beheer/planning", label: t("shell.planning") },
        { href: "/vandaag", label: t("shell.vandaag") },
      ],
    },
    {
      label: t("navgroep.financieel"),
      items: [
        { href: "/beheer/facturen", label: t("shell.facturen") },
        { href: "/beheer/finance", label: t("shell.finance") },
      ],
    },
    {
      label: t("navgroep.verkoop"),
      items: [{ href: "/beheer/verkoop", label: t("shell.verkoop") }],
    },
    {
      label: t("navgroep.beheer"),
      items: [
        { href: "/beheer/buurten", label: t("shell.buurten") },
        { href: "/beheer/website", label: t("shell.website") },
        { href: "/beheer/mails", label: t("shell.mails") },
        { href: "/beheer/instellingen", label: t("shell.instellingen") },
        ...(user.rol === "eigenaar"
          ? [{ href: "/beheer/team", label: t("shell.team") }]
          : []),
      ],
    },
  ];

  const isActive = (href: string) =>
    href === "/beheer"
      ? pathname === "/beheer"
      : pathname === href || pathname.startsWith(href + "/");

  const signOut = async () => {
    await signOutOffice();
    router.replace("/login");
  };

  const renderNav = (onNavigate?: () => void) => (
    <nav className="flex flex-col gap-5">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="px-3 pb-1.5 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-kliko-navy/40">
            {g.label}
          </p>
          <div className="flex flex-col gap-0.5">
            {g.items.map((it) => {
              const active = isActive(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    active
                      ? "bg-kliko-blue/10 text-kliko-navy"
                      : "text-kliko-navy/70 hover:bg-kliko-navy/5 hover:text-kliko-navy"
                  }`}
                >
                  {it.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-1 bg-kliko-navy/[0.03]">
      {/* Desktop-zijbalk */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-kliko-navy/10 bg-white lg:flex">
        <div className="px-5 py-5">
          <Link href="/beheer/overzicht">
            <LogoPrimary height={38} priority />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-4">{renderNav()}</div>
        <div className="border-t border-kliko-navy/10 p-3">
          <div className="flex items-center justify-between gap-2">
            <LanguageSwitcher />
            <button
              onClick={signOut}
              className="rounded-full border border-kliko-navy/20 px-3.5 py-1.5 text-xs font-bold text-kliko-navy hover:border-kliko-navy/40"
            >
              {t("shell.signout")}
            </button>
          </div>
          {user.naam ? (
            <p className="mt-2 truncate px-1 text-xs text-kliko-navy/50">
              {user.naam}
            </p>
          ) : null}
        </div>
      </aside>

      {/* Rechterkolom */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobiele bovenbalk */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-kliko-navy/10 bg-white px-4 py-3 lg:hidden">
          <button
            aria-label="Menu"
            onClick={() => setMenuOpen(true)}
            className="rounded-lg border border-kliko-navy/15 p-2 text-kliko-navy"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>
          <Link href="/beheer/overzicht">
            <LogoPrimary height={34} />
          </Link>
          <LanguageSwitcher />
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
          {children}
        </main>
      </div>

      {/* Mobiel uitschuifmenu */}
      {menuOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-kliko-navy/40"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-kliko-navy/10 px-5 py-4">
              <LogoPrimary height={34} />
              <button
                aria-label="Sluiten"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg p-2 text-kliko-navy hover:bg-kliko-navy/5"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">
              {renderNav(() => setMenuOpen(false))}
            </div>
            <div className="border-t border-kliko-navy/10 p-3">
              <button
                onClick={signOut}
                className="w-full rounded-full border border-kliko-navy/20 px-4 py-2 text-sm font-bold text-kliko-navy hover:border-kliko-navy/40"
              >
                {t("shell.signout")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
