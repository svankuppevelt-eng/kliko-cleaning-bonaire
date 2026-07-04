// Prospect- / marktonderzoeklijst voor Kliko Cleaning Bonaire.
//
// Geport vanuit de Streamlit-marktpagina (pages/04_Markt.py). Bevat alle
// potentiele klanten op Bonaire die daar in aparte Python-lijsten stonden:
// hotels & resorts, supermarkten & toko's, restaurants, vakantieverhuur
// (Airbnb) en overheid/instellingen. Elke rij is 1-op-1 overgenomen.
//
// Bron (caption uit de Python-pagina):
// "Potentiele klanten op Bonaire, onderzoek Juli 2026 | Bronnen:
//  bonaireisland.com (77 accommodaties), bonaire.com (27 supermarkten),
//  CBS 2026, AirROI 2025"
//
// Mapping-notities:
// - Alleen hotels hebben een "Kamers/units"-veld -> `eenheden`. Voor alle
//   andere categorieen is `eenheden` op 0 gezet.
// - Alleen hotels en supermarkten hebben een "Type"-veld. Voor restaurants,
//   vakantieverhuur en instellingen is `type` een lege string.
// - Alleen hotels, supermarkten en instellingen hebben "Telefoon". Restaurants
//   en vakantieverhuur missen dit veld -> lege string.
// - "Website" bestaat alleen bij hotels; overige categorieen -> lege string.
// - Onbekende telefoonnummers/websites in de bron zijn lege string.
// - Prioriteit gebruikt de bronwaarden "Hoog" | "Midden" | "Laag".

export type ProspectCategorie =
  | "hotel"
  | "supermarkt"
  | "restaurant"
  | "vakantieverhuur"
  | "instelling";

export interface Prospect {
  naam: string;
  categorie: ProspectCategorie;
  type: string; // Python "Type" (bijv. "Groot resort"); "" indien afwezig
  adres: string;
  telefoon: string; // "" indien veld afwezig; "" indien onbekend in bron
  website: string; // alleen hotels; "" indien afwezig; "" indien onbekend
  eenheden: number; // Python "Kamers/units"; 0 indien afwezig
  containers: number; // Python "Containers"
  prioriteit: "Hoog" | "Midden" | "Laag" | string; // Python "Prioriteit"
}

export const PROSPECTS: Prospect[] = [
  // ── Hotels, Resorts & Appartementen ──────────────────────────────────────
  { naam: "Van der Valk Plaza Beach & Dive Resort", categorie: "hotel", type: "Groot resort", adres: "J.A. Abraham Boulevard 80, Kralendijk", telefoon: "+599 717 2500", website: "plazaresortbonaire.com", eenheden: 276, containers: 15, prioriteit: "Hoog" },
  { naam: "Delfins Beach Resort (Hilton Tapestry)", categorie: "hotel", type: "Groot resort", adres: "Punt Vierkant, Kralendijk", telefoon: "+599 717 8285", website: "delfinsbeachresort.com", eenheden: 161, containers: 14, prioriteit: "Hoog" },
  { naam: "Divi Flamingo Beach Resort & Casino", categorie: "hotel", type: "Groot resort", adres: "J.A. Abraham Boulevard, Kralendijk", telefoon: "+599 717 8285", website: "divibonaire.com", eenheden: 129, containers: 12, prioriteit: "Hoog" },
  { naam: "Grand Windsock Bonaire", categorie: "hotel", type: "Groot resort", adres: "J.A. Abraham Boulevard 4, Kralendijk", telefoon: "+599 717 2580", website: "grandwindsock.com", eenheden: 72, containers: 10, prioriteit: "Hoog" },
  { naam: "Buddy Dive Resort", categorie: "hotel", type: "Groot resort", adres: "Kaya Gobernador N. Debrot 85, Kralendijk", telefoon: "+599 717 5080", website: "buddydive.com", eenheden: 65, containers: 10, prioriteit: "Hoog" },
  { naam: "Captain Don's Habitat Bonaire", categorie: "hotel", type: "Groot resort", adres: "Kaya Gobernador N. Debrot 103, Kralendijk", telefoon: "+599 717 8290", website: "habitatbonaire.com", eenheden: 60, containers: 9, prioriteit: "Hoog" },
  { naam: "Chogogo Dive & Beach Resort", categorie: "hotel", type: "Groot resort", adres: "Kaya Gobernador N. Debrot 75B, Kralendijk", telefoon: "+599 717 2200", website: "chogogobonaire.com", eenheden: 50, containers: 9, prioriteit: "Hoog" },
  { naam: "Harbour Village Beach Club", categorie: "hotel", type: "Groot resort", adres: "Kaya Gobernador N. Debrot 72, Kralendijk", telefoon: "+599 717 7500", website: "harbourvillage.com", eenheden: 40, containers: 8, prioriteit: "Hoog" },
  { naam: "Sand Dollar Bonaire", categorie: "hotel", type: "Groot resort", adres: "Kaya Gobernador N. Debrot 79, Kralendijk", telefoon: "+599 717 8738", website: "sanddollarbonaire.com", eenheden: 70, containers: 9, prioriteit: "Hoog" },
  { naam: "Bloozz Resort Bonaire", categorie: "hotel", type: "Hotel", adres: "Kaya Gobernador N. Debrot 62, Kralendijk", telefoon: "+599 717 7208", website: "bloozzresort.com", eenheden: 30, containers: 6, prioriteit: "Hoog" },
  { naam: "Sorobon Luxury Beach Resort", categorie: "hotel", type: "Hotel", adres: "Sorobon 64, Lac Bay", telefoon: "+599 717 8080", website: "sorobon.com", eenheden: 30, containers: 6, prioriteit: "Midden" },
  { naam: "Kontiki Beach Resort", categorie: "hotel", type: "Hotel", adres: "Kaya Gobernador N. Debrot 64, Kralendijk", telefoon: "+599 717 8666", website: "kontikibonaire.com", eenheden: 25, containers: 5, prioriteit: "Midden" },
  { naam: "The Bellafonte Luxury Hotel", categorie: "hotel", type: "Hotel", adres: "Kaya Gobernador N. Debrot 10, Kralendijk", telefoon: "+599 717 8163", website: "thebellafonte.com", eenheden: 20, containers: 5, prioriteit: "Hoog" },
  { naam: "Corallium Hotel & Villas", categorie: "hotel", type: "Hotel", adres: "Kaya Simon Bolivar, Kralendijk", telefoon: "+599 717 5525", website: "corallium.com", eenheden: 20, containers: 5, prioriteit: "Midden" },
  { naam: "Windhoek Resort Bonaire", categorie: "hotel", type: "Hotel", adres: "Kaya Gobernador N. Debrot, Kralendijk", telefoon: "+599 717 5050", website: "windhoekbonaire.com", eenheden: 15, containers: 4, prioriteit: "Midden" },
  { naam: "Bamboo Bonaire Boutique Resort", categorie: "hotel", type: "Hotel", adres: "Kaya Gobernador N. Debrot 77, Kralendijk", telefoon: "+599 717 8448", website: "bamboobonaire.com", eenheden: 13, containers: 4, prioriteit: "Midden" },
  { naam: "Coral Paradise Resort", categorie: "hotel", type: "Hotel", adres: "Kaya Gobernador N. Debrot 48, Kralendijk", telefoon: "+599 717 2500", website: "", eenheden: 12, containers: 3, prioriteit: "Midden" },
  { naam: "Tropical Divers Resort", categorie: "hotel", type: "Hotel", adres: "Kaya Gobernador N. Debrot, Kralendijk", telefoon: "+599 717 7201", website: "tropicaldivers.com", eenheden: 12, containers: 3, prioriteit: "Midden" },
  { naam: "Caribbean Club Bonaire", categorie: "hotel", type: "Hotel", adres: "Kaya Playa Lechi 26, Kralendijk", telefoon: "+599 717 7901", website: "", eenheden: 12, containers: 3, prioriteit: "Midden" },
  { naam: "Black Durgon Inn", categorie: "hotel", type: "Hotel", adres: "Kaya Gobernador N. Debrot 145, Kralendijk", telefoon: "+599 717 5736", website: "blackdurgon.com", eenheden: 10, containers: 3, prioriteit: "Midden" },
  { naam: "Hotel Islander", categorie: "hotel", type: "Hotel", adres: "Kaya Grandi, Kralendijk", telefoon: "+599 717 2400", website: "", eenheden: 10, containers: 3, prioriteit: "Midden" },
  { naam: "Belnem House Bonaire", categorie: "hotel", type: "Boutique hotel", adres: "Belnem, Kralendijk", telefoon: "+599 717 4444", website: "belnembonaire.com", eenheden: 31, containers: 5, prioriteit: "Midden" },
  { naam: "SENSES Boutique Hotel", categorie: "hotel", type: "Boutique hotel", adres: "Kaya Grandi, Kralendijk", telefoon: "", website: "sensesbonaire.com", eenheden: 11, containers: 3, prioriteit: "Midden" },
  { naam: "Boutique Hotel Bougainvillea", categorie: "hotel", type: "Boutique hotel", adres: "Kaya Playa Lechi, Kralendijk", telefoon: "+599 717 8980", website: "", eenheden: 8, containers: 2, prioriteit: "Laag" },
  { naam: "Boutique Hotel Sonrisa Bonaire", categorie: "hotel", type: "Boutique hotel", adres: "Kaya Gobernador N. Debrot, Kralendijk", telefoon: "+599 717 6060", website: "", eenheden: 8, containers: 2, prioriteit: "Laag" },
  { naam: "Bridanda Boutique Resort", categorie: "hotel", type: "Boutique hotel", adres: "Kaya Grandi 83, Kralendijk", telefoon: "+599 717 8833", website: "", eenheden: 8, containers: 2, prioriteit: "Laag" },
  { naam: "Puur Bonaire", categorie: "hotel", type: "Boutique hotel", adres: "Kaya Gobernador N. Debrot, Kralendijk", telefoon: "+599 717 7660", website: "", eenheden: 6, containers: 2, prioriteit: "Laag" },
  { naam: "Tala Lodge Bonaire", categorie: "hotel", type: "Boutique hotel", adres: "Kaya Simon Bolivar 6, Kralendijk", telefoon: "+599 717 5460", website: "", eenheden: 6, containers: 2, prioriteit: "Laag" },
  { naam: "Woodz Bonaire", categorie: "hotel", type: "Boutique hotel", adres: "Kaya Gobernador N. Debrot, Kralendijk", telefoon: "", website: "woodzbonaire.com", eenheden: 6, containers: 2, prioriteit: "Laag" },
  { naam: "Oasis Guesthouse Bonaire", categorie: "hotel", type: "Guesthouse", adres: "Belnem, Kralendijk", telefoon: "+599 717 2266", website: "", eenheden: 5, containers: 2, prioriteit: "Laag" },
  { naam: "Heritage Design Inn", categorie: "hotel", type: "Guesthouse", adres: "Rincon, Bonaire", telefoon: "", website: "", eenheden: 4, containers: 2, prioriteit: "Laag" },
  { naam: "Den Laman Condominiums", categorie: "hotel", type: "Appartementen", adres: "Kaya Gobernador N. Debrot 77A, Kralendijk", telefoon: "+599 717 8955", website: "denlaman.com", eenheden: 16, containers: 4, prioriteit: "Midden" },
  { naam: "Divers Paradise N.V.", categorie: "hotel", type: "Appartementen", adres: "J.A. Abraham Boulevard, Kralendijk", telefoon: "+599 717 6080", website: "diversparadise.com", eenheden: 14, containers: 3, prioriteit: "Midden" },
  { naam: "Belmar Oceanfront Apartments", categorie: "hotel", type: "Appartementen", adres: "Kaya Gobernador N. Debrot, Kralendijk", telefoon: "+599 717 8070", website: "", eenheden: 10, containers: 3, prioriteit: "Midden" },
  { naam: "Caribbean Chillout Apartments", categorie: "hotel", type: "Appartementen", adres: "Kaya Gobernador N. Debrot, Kralendijk", telefoon: "+599 717 8630", website: "", eenheden: 8, containers: 2, prioriteit: "Laag" },
  { naam: "All Seasons Apartments", categorie: "hotel", type: "Appartementen", adres: "Kaya Gobernador N. Debrot, Kralendijk", telefoon: "+599 717 8080", website: "", eenheden: 12, containers: 3, prioriteit: "Midden" },
  { naam: "One Ocean Bonaire", categorie: "hotel", type: "Appartementen", adres: "Kaya Gobernador N. Debrot, Kralendijk", telefoon: "", website: "", eenheden: 5, containers: 2, prioriteit: "Laag" },
  { naam: "Eco Lodge Bonaire", categorie: "hotel", type: "Eco lodge", adres: "Kaminda Lac, Cai", telefoon: "+599 717 8018", website: "ecolodgebonaire.com", eenheden: 8, containers: 2, prioriteit: "Laag" },
  { naam: "Red Palm Village", categorie: "hotel", type: "Resort", adres: "Kaminda Sorobon, Lac Bay", telefoon: "+599 717 2800", website: "redpalmvillage.com", eenheden: 12, containers: 3, prioriteit: "Midden" },
  { naam: "Hamlet Oasis Resort", categorie: "hotel", type: "Resort", adres: "Kaya Gobernador N. Debrot, Kralendijk", telefoon: "+599 717 7888", website: "hamletoasis.com", eenheden: 10, containers: 3, prioriteit: "Midden" },

  // ── Supermarkten, Chinese winkels & Toko's ───────────────────────────────
  { naam: "Van den Tweel Supermarkt", categorie: "supermarkt", type: "Grote supermarkt", adres: "Kaya Industria 39, Kralendijk", telefoon: "+599 717 6131", website: "", eenheden: 0, containers: 8, prioriteit: "Hoog" },
  { naam: "Warehouse Bonaire", categorie: "supermarkt", type: "Grote supermarkt", adres: "Kaya Industria 24, Kralendijk", telefoon: "+599 717 8700", website: "", eenheden: 0, containers: 8, prioriteit: "Hoog" },
  { naam: "BonDiGro Supermarkt (Industria)", categorie: "supermarkt", type: "Grote supermarkt", adres: "Kaya Industria 29, Kralendijk", telefoon: "+599 717 4400", website: "", eenheden: 0, containers: 6, prioriteit: "Hoog" },
  { naam: "BonDiGro Supermarkt (Hato)", categorie: "supermarkt", type: "Grote supermarkt", adres: "Hato Noord, Bonaire", telefoon: "+599 717 4400", website: "", eenheden: 0, containers: 4, prioriteit: "Hoog" },
  { naam: "Bonaire Super Store", categorie: "supermarkt", type: "Grote supermarkt", adres: "Kaya Amsterdam, Kralendijk", telefoon: "+599 717 7068", website: "", eenheden: 0, containers: 5, prioriteit: "Hoog" },
  { naam: "Famoso Supermarkt", categorie: "supermarkt", type: "Grote supermarkt", adres: "Kaya Industria, Kralendijk", telefoon: "", website: "", eenheden: 0, containers: 5, prioriteit: "Hoog" },
  { naam: "Top Supermarkt (v/h Cultimara)", categorie: "supermarkt", type: "Grote supermarkt", adres: "Kaya Grandi, Kralendijk", telefoon: "+599 717 8278", website: "", eenheden: 0, containers: 5, prioriteit: "Hoog" },
  { naam: "More For Less Supermarkt", categorie: "supermarkt", type: "Supermarkt", adres: "Kaya Nikiboko Noord, Kralendijk", telefoon: "", website: "", eenheden: 0, containers: 4, prioriteit: "Hoog" },
  { naam: "Lucky Supermarket", categorie: "supermarkt", type: "Chinese supermarkt", adres: "Kaya Industria 28, Kralendijk", telefoon: "", website: "", eenheden: 0, containers: 3, prioriteit: "Hoog" },
  { naam: "Liangxiang Supermarkt", categorie: "supermarkt", type: "Chinese supermarkt", adres: "Kaya Grandi, Kralendijk", telefoon: "", website: "", eenheden: 0, containers: 3, prioriteit: "Hoog" },
  { naam: "Wing Cheung Supermarkt", categorie: "supermarkt", type: "Chinese supermarkt", adres: "Kaya Tintorero, Kralendijk", telefoon: "", website: "", eenheden: 0, containers: 3, prioriteit: "Hoog" },
  { naam: "Zhung Kong Supermarkt", categorie: "supermarkt", type: "Chinese supermarkt", adres: "Kaya Gobernador N. Debrot 98, Kralendijk", telefoon: "", website: "", eenheden: 0, containers: 3, prioriteit: "Hoog" },
  { naam: "Li Hing Supermarkt", categorie: "supermarkt", type: "Chinese supermarkt", adres: "Kaya L.D. Gerharts 3, Kralendijk", telefoon: "+599 717 8226", website: "", eenheden: 0, containers: 3, prioriteit: "Hoog" },
  { naam: "Prices Supermarkt", categorie: "supermarkt", type: "Chinese supermarkt", adres: "Kralendijk centrum", telefoon: "", website: "", eenheden: 0, containers: 2, prioriteit: "Midden" },
  { naam: "Overige Chinese mini-markten / toko's (est. 6–8)", categorie: "supermarkt", type: "Mini-markt / toko", adres: "Verspreid over Bonaire", telefoon: "", website: "", eenheden: 0, containers: 14, prioriteit: "Midden" },

  // ── Restaurants & Horeca ─────────────────────────────────────────────────
  { naam: "It Rains Fishes", categorie: "restaurant", type: "", adres: "Kaya J.N.E. Craane 24, Kralendijk", telefoon: "", website: "", eenheden: 0, containers: 2, prioriteit: "Hoog" },
  { naam: "Capriccio Restaurant", categorie: "restaurant", type: "", adres: "Kaya Isla Riba 1, Kralendijk", telefoon: "", website: "", eenheden: 0, containers: 2, prioriteit: "Hoog" },
  { naam: "Restaurant Bubbles Bonaire", categorie: "restaurant", type: "", adres: "Kaya Grandi 46, Kralendijk", telefoon: "", website: "", eenheden: 0, containers: 2, prioriteit: "Hoog" },
  { naam: "Brass Boer Bonaire", categorie: "restaurant", type: "", adres: "J.A. Abraham Boulevard, Kralendijk", telefoon: "", website: "", eenheden: 0, containers: 2, prioriteit: "Hoog" },
  { naam: "La Cantina Cerveceria", categorie: "restaurant", type: "", adres: "Kaya L.D. Gerharts, Kralendijk", telefoon: "", website: "", eenheden: 0, containers: 2, prioriteit: "Hoog" },
  { naam: "Overige restaurants (est. ~155)", categorie: "restaurant", type: "", adres: "Verspreid over Kralendijk en omgeving", telefoon: "", website: "", eenheden: 0, containers: 155, prioriteit: "Midden" },

  // ── Airbnb & Vakantieverhuur ─────────────────────────────────────────────
  { naam: "Airbnb / vakantieverhuur (141 actieve listings)", categorie: "vakantieverhuur", type: "", adres: "Verspreid over heel Bonaire", telefoon: "", website: "", eenheden: 0, containers: 141, prioriteit: "Midden" },
  { naam: "Overige vakantiehuizen niet op Airbnb (est. 60)", categorie: "vakantieverhuur", type: "", adres: "Verspreid over Bonaire", telefoon: "", website: "", eenheden: 0, containers: 60, prioriteit: "Laag" },

  // ── Overheid & Instellingen ──────────────────────────────────────────────
  { naam: "Ziekenhuis Fundashon Mariadal", categorie: "instelling", type: "", adres: "Kaya Soeur Bartola 2, Kralendijk", telefoon: "+599 715 8900", website: "", eenheden: 0, containers: 10, prioriteit: "Hoog" },
  { naam: "Openbaar Lichaam Bonaire", categorie: "instelling", type: "", adres: "Kaya Simon Bolivar 1, Kralendijk", telefoon: "+599 715 8300", website: "", eenheden: 0, containers: 8, prioriteit: "Hoog" },
  { naam: "Rijksdienst Caribisch Nederland (RCN)", categorie: "instelling", type: "", adres: "Bulevar Gobernador N. Debrot 17", telefoon: "+599 715 8300", website: "", eenheden: 0, containers: 6, prioriteit: "Hoog" },
  { naam: "WEB Bonaire (water & energie)", categorie: "instelling", type: "", adres: "Kaya Industria 5, Kralendijk", telefoon: "+599 717 8244", website: "", eenheden: 0, containers: 5, prioriteit: "Hoog" },
  { naam: "STINAPA Bonaire (Nationaal Park)", categorie: "instelling", type: "", adres: "Kaya Gobernador N. Debrot 2, Kralendijk", telefoon: "+599 717 8444", website: "", eenheden: 0, containers: 4, prioriteit: "Midden" },
  { naam: "Scholen Bonaire (est. 10 scholen)", categorie: "instelling", type: "", adres: "Verspreid over Bonaire", telefoon: "", website: "", eenheden: 0, containers: 15, prioriteit: "Midden" },
  { naam: "Brandweer / Politie Bonaire", categorie: "instelling", type: "", adres: "Kralendijk", telefoon: "", website: "", eenheden: 0, containers: 6, prioriteit: "Laag" },
];
