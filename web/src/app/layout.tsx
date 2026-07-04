import type { Metadata } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Kliko Cleaning Bonaire - frisse, schone kliko's",
  description:
    "Professionele kliko-reiniging op Bonaire. Abonnement voor huishoudens en bedrijven: geurvrij, hygiënisch, milieuvriendelijk.",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nl" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-white text-kliko-navy">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
