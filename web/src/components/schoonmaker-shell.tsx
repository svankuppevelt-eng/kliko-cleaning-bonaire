"use client";

// Minimale mobiele shell voor de schoonmaker-app (/vandaag).
// Geen office-navigatie: alleen logo, naam, taal-switcher en uitloggen.
// Toegang: rol schoonmaker EN office (eigenaar/kantoor kijken mee).
import { type ReactNode, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogoMark } from "@/components/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useI18n } from "@/lib/i18n";
import { signOutOffice, useHuidigeGebruiker } from "@/lib/use-office-user";

export function SchoonmakerShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const router = useRouter();
  const gebruiker = useHuidigeGebruiker();

  useEffect(() => {
    if (gebruiker.status === "signed-out") {
      router.replace("/login");
    }
  }, [gebruiker.status, router]);

  if (gebruiker.status === "unconfigured") {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16">
        <p className="rounded-xl border border-kliko-yellow bg-kliko-yellow/15 px-4 py-3 text-sm font-semibold text-kliko-navy">
          {t("login.offline")}
        </p>
      </div>
    );
  }

  if (gebruiker.status === "geen-rol") {
    // Ingelogd maar geen (actieve) rol: nette melding, geen redirect-loop.
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16">
        <p className="rounded-xl border border-kliko-red/30 bg-kliko-red/10 px-4 py-3 text-sm font-semibold text-kliko-red">
          {t("vandaag.geenrol")} ({gebruiker.email})
        </p>
        <button
          onClick={async () => {
            await signOutOffice();
            router.replace("/login");
          }}
          className="mt-4 w-full rounded-full border border-kliko-navy/20 px-5 py-3 font-bold text-kliko-navy"
        >
          {t("shell.signout")}
        </button>
      </div>
    );
  }

  if (gebruiker.status !== "ingelogd") {
    // loading, of bezig met redirect naar /login
    return (
      <div className="grid flex-1 place-items-center py-24 text-kliko-navy/50">
        <span className="text-sm font-semibold">{t("vandaag.loading")}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-kliko-navy/[0.03]">
      <header className="sticky top-0 z-30 border-b border-kliko-navy/10 bg-white">
        <div className="mx-auto flex w-full max-w-md items-center justify-between gap-2 px-4 py-2.5">
          <Link href="/vandaag" className="flex min-w-0 items-center gap-2.5">
            <LogoMark size={36} priority />
            <span className="truncate text-sm font-bold text-kliko-navy">
              {gebruiker.naam || gebruiker.email}
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <LanguageSwitcher />
            <button
              onClick={async () => {
                await signOutOffice();
                router.replace("/login");
              }}
              className="rounded-full border border-kliko-navy/20 px-3 py-1.5 text-xs font-bold text-kliko-navy hover:border-kliko-navy/40"
            >
              {t("shell.signout")}
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-5">{children}</main>
    </div>
  );
}
