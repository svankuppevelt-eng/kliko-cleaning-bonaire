import type { Metadata, Viewport } from "next";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";
import { SwRegister } from "@/components/sw-register";

export const metadata: Metadata = {
  title: "Kliko Cleaning Bonaire - frisse, schone kliko's",
  description:
    "Professionele kliko-reiniging op Bonaire. Abonnement voor huishoudens en bedrijven: geurvrij, hygiënisch, milieuvriendelijk.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon.png",
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    title: "Kliko",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#0d2b6a",
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
        <SwRegister />
      </body>
    </html>
  );
}
