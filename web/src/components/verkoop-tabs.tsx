"use client";

// Tab-navigatie voor het office-onderdeel Verkoop (/beheer/verkoop/*).
// De actieve tab wordt bepaald via het pad, zodat elke sub-pagina zijn eigen
// route houdt (deelbaar, back-knop werkt).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";

// Prijsbeleid is opgegaan in Instellingen (/beheer/instellingen) en heeft
// hier geen eigen tab meer; de oude route verwijst daarnaartoe door.
const TABS: { href: string; key: string }[] = [
  { href: "/beheer/verkoop/offertes", key: "verkoop.tab.offertes" },
  { href: "/beheer/verkoop/prospects", key: "verkoop.tab.prospects" },
  { href: "/beheer/verkoop/calculator", key: "verkoop.tab.calculator" },
  { href: "/beheer/verkoop/notities", key: "verkoop.tab.notities" },
];

export function VerkoopTabs() {
  const { t } = useI18n();
  const pad = usePathname();

  return (
    <nav className="mb-6 flex flex-wrap gap-1.5 border-b border-kliko-navy/10 pb-3">
      {TABS.map((tab) => {
        const actief = pad === tab.href || pad.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              actief
                ? "rounded-full bg-kliko-blue px-4 py-1.5 text-sm font-bold text-white"
                : "rounded-full px-4 py-1.5 text-sm font-semibold text-kliko-navy/70 hover:bg-kliko-navy/5 hover:text-kliko-navy"
            }
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}
