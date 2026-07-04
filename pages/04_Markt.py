import streamlit as st
import pandas as pd

st.markdown("""
<style>
.block-container { padding-top: 1.5rem; }
.sec-header {
    background: #1e2d3d;
    color: #ffffff;
    padding: 4px 12px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin: 22px 0 8px 0;
    border-radius: 2px;
}
.note { font-size: 12px; color: #666; font-style: italic; }
</style>
""", unsafe_allow_html=True)

st.title("Kliko Cleaning Bonaire — Marktonderzoek")
st.caption("Potentiële klanten op Bonaire — onderzoek Juli 2026 | Bronnen: bonaireisland.com (77 accommodaties), bonaire.com (27 supermarkten), CBS 2026, AirROI 2025")

# ─────────────────────────────────────────────────────────────────────────────
# DATA — HOTELS & RESORTS
# ─────────────────────────────────────────────────────────────────────────────

hotels = [
    # GROTE RESORTS
    {"Naam": "Van der Valk Plaza Beach & Dive Resort", "Type": "Groot resort", "Adres": "J.A. Abraham Boulevard 80, Kralendijk", "Telefoon": "+599 717 2500", "Website": "plazaresortbonaire.com", "Kamers/units": 276, "Containers": 15, "Prioriteit": "Hoog"},
    {"Naam": "Delfins Beach Resort (Hilton Tapestry)", "Type": "Groot resort", "Adres": "Punt Vierkant, Kralendijk", "Telefoon": "+599 717 8285", "Website": "delfinsbeachresort.com", "Kamers/units": 161, "Containers": 14, "Prioriteit": "Hoog"},
    {"Naam": "Divi Flamingo Beach Resort & Casino", "Type": "Groot resort", "Adres": "J.A. Abraham Boulevard, Kralendijk", "Telefoon": "+599 717 8285", "Website": "divibonaire.com", "Kamers/units": 129, "Containers": 12, "Prioriteit": "Hoog"},
    {"Naam": "Grand Windsock Bonaire", "Type": "Groot resort", "Adres": "J.A. Abraham Boulevard 4, Kralendijk", "Telefoon": "+599 717 2580", "Website": "grandwindsock.com", "Kamers/units": 72, "Containers": 10, "Prioriteit": "Hoog"},
    {"Naam": "Buddy Dive Resort", "Type": "Groot resort", "Adres": "Kaya Gobernador N. Debrot 85, Kralendijk", "Telefoon": "+599 717 5080", "Website": "buddydive.com", "Kamers/units": 65, "Containers": 10, "Prioriteit": "Hoog"},
    {"Naam": "Captain Don's Habitat Bonaire", "Type": "Groot resort", "Adres": "Kaya Gobernador N. Debrot 103, Kralendijk", "Telefoon": "+599 717 8290", "Website": "habitatbonaire.com", "Kamers/units": 60, "Containers": 9, "Prioriteit": "Hoog"},
    {"Naam": "Chogogo Dive & Beach Resort", "Type": "Groot resort", "Adres": "Kaya Gobernador N. Debrot 75B, Kralendijk", "Telefoon": "+599 717 2200", "Website": "chogogobonaire.com", "Kamers/units": 50, "Containers": 9, "Prioriteit": "Hoog"},
    {"Naam": "Harbour Village Beach Club", "Type": "Groot resort", "Adres": "Kaya Gobernador N. Debrot 72, Kralendijk", "Telefoon": "+599 717 7500", "Website": "harbourvillage.com", "Kamers/units": 40, "Containers": 8, "Prioriteit": "Hoog"},
    {"Naam": "Sand Dollar Bonaire", "Type": "Groot resort", "Adres": "Kaya Gobernador N. Debrot 79, Kralendijk", "Telefoon": "+599 717 8738", "Website": "sanddollarbonaire.com", "Kamers/units": 70, "Containers": 9, "Prioriteit": "Hoog"},
    # MIDDELGROTE HOTELS
    {"Naam": "Bloozz Resort Bonaire", "Type": "Hotel", "Adres": "Kaya Gobernador N. Debrot 62, Kralendijk", "Telefoon": "+599 717 7208", "Website": "bloozzresort.com", "Kamers/units": 30, "Containers": 6, "Prioriteit": "Hoog"},
    {"Naam": "Sorobon Luxury Beach Resort", "Type": "Hotel", "Adres": "Sorobon 64, Lac Bay", "Telefoon": "+599 717 8080", "Website": "sorobon.com", "Kamers/units": 30, "Containers": 6, "Prioriteit": "Midden"},
    {"Naam": "Kontiki Beach Resort", "Type": "Hotel", "Adres": "Kaya Gobernador N. Debrot 64, Kralendijk", "Telefoon": "+599 717 8666", "Website": "kontikibonaire.com", "Kamers/units": 25, "Containers": 5, "Prioriteit": "Midden"},
    {"Naam": "The Bellafonte Luxury Hotel", "Type": "Hotel", "Adres": "Kaya Gobernador N. Debrot 10, Kralendijk", "Telefoon": "+599 717 8163", "Website": "thebellafonte.com", "Kamers/units": 20, "Containers": 5, "Prioriteit": "Hoog"},
    {"Naam": "Corallium Hotel & Villas", "Type": "Hotel", "Adres": "Kaya Simon Bolivar, Kralendijk", "Telefoon": "+599 717 5525", "Website": "corallium.com", "Kamers/units": 20, "Containers": 5, "Prioriteit": "Midden"},
    {"Naam": "Windhoek Resort Bonaire", "Type": "Hotel", "Adres": "Kaya Gobernador N. Debrot, Kralendijk", "Telefoon": "+599 717 5050", "Website": "windhoekbonaire.com", "Kamers/units": 15, "Containers": 4, "Prioriteit": "Midden"},
    {"Naam": "Bamboo Bonaire Boutique Resort", "Type": "Hotel", "Adres": "Kaya Gobernador N. Debrot 77, Kralendijk", "Telefoon": "+599 717 8448", "Website": "bamboobonaire.com", "Kamers/units": 13, "Containers": 4, "Prioriteit": "Midden"},
    {"Naam": "Coral Paradise Resort", "Type": "Hotel", "Adres": "Kaya Gobernador N. Debrot 48, Kralendijk", "Telefoon": "+599 717 2500", "Website": "—", "Kamers/units": 12, "Containers": 3, "Prioriteit": "Midden"},
    {"Naam": "Tropical Divers Resort", "Type": "Hotel", "Adres": "Kaya Gobernador N. Debrot, Kralendijk", "Telefoon": "+599 717 7201", "Website": "tropicaldivers.com", "Kamers/units": 12, "Containers": 3, "Prioriteit": "Midden"},
    {"Naam": "Caribbean Club Bonaire", "Type": "Hotel", "Adres": "Kaya Playa Lechi 26, Kralendijk", "Telefoon": "+599 717 7901", "Website": "—", "Kamers/units": 12, "Containers": 3, "Prioriteit": "Midden"},
    {"Naam": "Black Durgon Inn", "Type": "Hotel", "Adres": "Kaya Gobernador N. Debrot 145, Kralendijk", "Telefoon": "+599 717 5736", "Website": "blackdurgon.com", "Kamers/units": 10, "Containers": 3, "Prioriteit": "Midden"},
    {"Naam": "Hotel Islander", "Type": "Hotel", "Adres": "Kaya Grandi, Kralendijk", "Telefoon": "+599 717 2400", "Website": "—", "Kamers/units": 10, "Containers": 3, "Prioriteit": "Midden"},
    # BOUTIQUE / KLEIN
    {"Naam": "Belnem House Bonaire", "Type": "Boutique hotel", "Adres": "Belnem, Kralendijk", "Telefoon": "+599 717 4444", "Website": "belnembonaire.com", "Kamers/units": 31, "Containers": 5, "Prioriteit": "Midden"},
    {"Naam": "SENSES Boutique Hotel", "Type": "Boutique hotel", "Adres": "Kaya Grandi, Kralendijk", "Telefoon": "—", "Website": "sensesbonaire.com", "Kamers/units": 11, "Containers": 3, "Prioriteit": "Midden"},
    {"Naam": "Boutique Hotel Bougainvillea", "Type": "Boutique hotel", "Adres": "Kaya Playa Lechi, Kralendijk", "Telefoon": "+599 717 8980", "Website": "—", "Kamers/units": 8, "Containers": 2, "Prioriteit": "Laag"},
    {"Naam": "Boutique Hotel Sonrisa Bonaire", "Type": "Boutique hotel", "Adres": "Kaya Gobernador N. Debrot, Kralendijk", "Telefoon": "+599 717 6060", "Website": "—", "Kamers/units": 8, "Containers": 2, "Prioriteit": "Laag"},
    {"Naam": "Bridanda Boutique Resort", "Type": "Boutique hotel", "Adres": "Kaya Grandi 83, Kralendijk", "Telefoon": "+599 717 8833", "Website": "—", "Kamers/units": 8, "Containers": 2, "Prioriteit": "Laag"},
    {"Naam": "Puur Bonaire", "Type": "Boutique hotel", "Adres": "Kaya Gobernador N. Debrot, Kralendijk", "Telefoon": "+599 717 7660", "Website": "—", "Kamers/units": 6, "Containers": 2, "Prioriteit": "Laag"},
    {"Naam": "Tala Lodge Bonaire", "Type": "Boutique hotel", "Adres": "Kaya Simon Bolivar 6, Kralendijk", "Telefoon": "+599 717 5460", "Website": "—", "Kamers/units": 6, "Containers": 2, "Prioriteit": "Laag"},
    {"Naam": "Woodz Bonaire", "Type": "Boutique hotel", "Adres": "Kaya Gobernador N. Debrot, Kralendijk", "Telefoon": "—", "Website": "woodzbonaire.com", "Kamers/units": 6, "Containers": 2, "Prioriteit": "Laag"},
    {"Naam": "Oasis Guesthouse Bonaire", "Type": "Guesthouse", "Adres": "Belnem, Kralendijk", "Telefoon": "+599 717 2266", "Website": "—", "Kamers/units": 5, "Containers": 2, "Prioriteit": "Laag"},
    {"Naam": "Heritage Design Inn", "Type": "Guesthouse", "Adres": "Rincon, Bonaire", "Telefoon": "—", "Website": "—", "Kamers/units": 4, "Containers": 2, "Prioriteit": "Laag"},
    # APPARTEMENTEN / CONDOS MET CENTRALE FACILITEITEN
    {"Naam": "Den Laman Condominiums", "Type": "Appartementen", "Adres": "Kaya Gobernador N. Debrot 77A, Kralendijk", "Telefoon": "+599 717 8955", "Website": "denlaman.com", "Kamers/units": 16, "Containers": 4, "Prioriteit": "Midden"},
    {"Naam": "Divers Paradise N.V.", "Type": "Appartementen", "Adres": "J.A. Abraham Boulevard, Kralendijk", "Telefoon": "+599 717 6080", "Website": "diversparadise.com", "Kamers/units": 14, "Containers": 3, "Prioriteit": "Midden"},
    {"Naam": "Belmar Oceanfront Apartments", "Type": "Appartementen", "Adres": "Kaya Gobernador N. Debrot, Kralendijk", "Telefoon": "+599 717 8070", "Website": "—", "Kamers/units": 10, "Containers": 3, "Prioriteit": "Midden"},
    {"Naam": "Caribbean Chillout Apartments", "Type": "Appartementen", "Adres": "Kaya Gobernador N. Debrot, Kralendijk", "Telefoon": "+599 717 8630", "Website": "—", "Kamers/units": 8, "Containers": 2, "Prioriteit": "Laag"},
    {"Naam": "All Seasons Apartments", "Type": "Appartementen", "Adres": "Kaya Gobernador N. Debrot, Kralendijk", "Telefoon": "+599 717 8080", "Website": "—", "Kamers/units": 12, "Containers": 3, "Prioriteit": "Midden"},
    {"Naam": "One Ocean Bonaire", "Type": "Appartementen", "Adres": "Kaya Gobernador N. Debrot, Kralendijk", "Telefoon": "—", "Website": "—", "Kamers/units": 5, "Containers": 2, "Prioriteit": "Laag"},
    {"Naam": "Eco Lodge Bonaire", "Type": "Eco lodge", "Adres": "Kaminda Lac, Cai", "Telefoon": "+599 717 8018", "Website": "ecolodgebonaire.com", "Kamers/units": 8, "Containers": 2, "Prioriteit": "Laag"},
    {"Naam": "Red Palm Village", "Type": "Resort", "Adres": "Kaminda Sorobon, Lac Bay", "Telefoon": "+599 717 2800", "Website": "redpalmvillage.com", "Kamers/units": 12, "Containers": 3, "Prioriteit": "Midden"},
    {"Naam": "Hamlet Oasis Resort", "Type": "Resort", "Adres": "Kaya Gobernador N. Debrot, Kralendijk", "Telefoon": "+599 717 7888", "Website": "hamletoasis.com", "Kamers/units": 10, "Containers": 3, "Prioriteit": "Midden"},
]

# ─────────────────────────────────────────────────────────────────────────────
# DATA — SUPERMARKTEN
# ─────────────────────────────────────────────────────────────────────────────

supermarkten = [
    # GROTE SUPERMARKTEN
    {"Naam": "Van den Tweel Supermarkt", "Type": "Grote supermarkt", "Adres": "Kaya Industria 39, Kralendijk", "Telefoon": "+599 717 6131", "Containers": 8, "Prioriteit": "Hoog"},
    {"Naam": "Warehouse Bonaire", "Type": "Grote supermarkt", "Adres": "Kaya Industria 24, Kralendijk", "Telefoon": "+599 717 8700", "Containers": 8, "Prioriteit": "Hoog"},
    {"Naam": "BonDiGro Supermarkt (Industria)", "Type": "Grote supermarkt", "Adres": "Kaya Industria 29, Kralendijk", "Telefoon": "+599 717 4400", "Containers": 6, "Prioriteit": "Hoog"},
    {"Naam": "BonDiGro Supermarkt (Hato)", "Type": "Grote supermarkt", "Adres": "Hato Noord, Bonaire", "Telefoon": "+599 717 4400", "Containers": 4, "Prioriteit": "Hoog"},
    {"Naam": "Bonaire Super Store", "Type": "Grote supermarkt", "Adres": "Kaya Amsterdam, Kralendijk", "Telefoon": "+599 717 7068", "Containers": 5, "Prioriteit": "Hoog"},
    {"Naam": "Famoso Supermarkt", "Type": "Grote supermarkt", "Adres": "Kaya Industria, Kralendijk", "Telefoon": "—", "Containers": 5, "Prioriteit": "Hoog"},
    {"Naam": "Top Supermarkt (v/h Cultimara)", "Type": "Grote supermarkt", "Adres": "Kaya Grandi, Kralendijk", "Telefoon": "+599 717 8278", "Containers": 5, "Prioriteit": "Hoog"},
    {"Naam": "More For Less Supermarkt", "Type": "Supermarkt", "Adres": "Kaya Nikiboko Noord, Kralendijk", "Telefoon": "—", "Containers": 4, "Prioriteit": "Hoog"},
    # CHINESE SUPERMARKTEN / TOKO'S
    {"Naam": "Lucky Supermarket", "Type": "Chinese supermarkt", "Adres": "Kaya Industria 28, Kralendijk", "Telefoon": "—", "Containers": 3, "Prioriteit": "Hoog"},
    {"Naam": "Liangxiang Supermarkt", "Type": "Chinese supermarkt", "Adres": "Kaya Grandi, Kralendijk", "Telefoon": "—", "Containers": 3, "Prioriteit": "Hoog"},
    {"Naam": "Wing Cheung Supermarkt", "Type": "Chinese supermarkt", "Adres": "Kaya Tintorero, Kralendijk", "Telefoon": "—", "Containers": 3, "Prioriteit": "Hoog"},
    {"Naam": "Zhung Kong Supermarkt", "Type": "Chinese supermarkt", "Adres": "Kaya Gobernador N. Debrot 98, Kralendijk", "Telefoon": "—", "Containers": 3, "Prioriteit": "Hoog"},
    {"Naam": "Li Hing Supermarkt", "Type": "Chinese supermarkt", "Adres": "Kaya L.D. Gerharts 3, Kralendijk", "Telefoon": "+599 717 8226", "Containers": 3, "Prioriteit": "Hoog"},
    {"Naam": "Prices Supermarkt", "Type": "Chinese supermarkt", "Adres": "Kralendijk centrum", "Telefoon": "—", "Containers": 2, "Prioriteit": "Midden"},
    {"Naam": "Overige Chinese mini-markten / toko's (est. 6–8)", "Type": "Mini-markt / toko", "Adres": "Verspreid over Bonaire", "Telefoon": "—", "Containers": 14, "Prioriteit": "Midden"},
]

restaurants = [
    {"Naam": "It Rains Fishes", "Adres": "Kaya J.N.E. Craane 24, Kralendijk", "Containers": 2, "Prioriteit": "Hoog"},
    {"Naam": "Capriccio Restaurant", "Adres": "Kaya Isla Riba 1, Kralendijk", "Containers": 2, "Prioriteit": "Hoog"},
    {"Naam": "Restaurant Bubbles Bonaire", "Adres": "Kaya Grandi 46, Kralendijk", "Containers": 2, "Prioriteit": "Hoog"},
    {"Naam": "Brass Boer Bonaire", "Adres": "J.A. Abraham Boulevard, Kralendijk", "Containers": 2, "Prioriteit": "Hoog"},
    {"Naam": "La Cantina Cerveceria", "Adres": "Kaya L.D. Gerharts, Kralendijk", "Containers": 2, "Prioriteit": "Hoog"},
    {"Naam": "Overige restaurants (est. ~155)", "Adres": "Verspreid over Kralendijk en omgeving", "Containers": 155, "Prioriteit": "Midden"},
]

airbnb = [
    {"Naam": "Airbnb / vakantieverhuur (141 actieve listings)", "Adres": "Verspreid over heel Bonaire", "Containers": 141, "Prioriteit": "Midden"},
    {"Naam": "Overige vakantiehuizen niet op Airbnb (est. 60)", "Adres": "Verspreid over Bonaire", "Containers": 60, "Prioriteit": "Laag"},
]

instellingen = [
    {"Naam": "Ziekenhuis Fundashon Mariadal", "Adres": "Kaya Soeur Bartola 2, Kralendijk", "Telefoon": "+599 715 8900", "Containers": 10, "Prioriteit": "Hoog"},
    {"Naam": "Openbaar Lichaam Bonaire", "Adres": "Kaya Simon Bolivar 1, Kralendijk", "Telefoon": "+599 715 8300", "Containers": 8, "Prioriteit": "Hoog"},
    {"Naam": "Rijksdienst Caribisch Nederland (RCN)", "Adres": "Bulevar Gobernador N. Debrot 17", "Telefoon": "+599 715 8300", "Containers": 6, "Prioriteit": "Hoog"},
    {"Naam": "WEB Bonaire (water & energie)", "Adres": "Kaya Industria 5, Kralendijk", "Telefoon": "+599 717 8244", "Containers": 5, "Prioriteit": "Hoog"},
    {"Naam": "STINAPA Bonaire (Nationaal Park)", "Adres": "Kaya Gobernador N. Debrot 2, Kralendijk", "Telefoon": "+599 717 8444", "Containers": 4, "Prioriteit": "Midden"},
    {"Naam": "Scholen Bonaire (est. 10 scholen)", "Adres": "Verspreid over Bonaire", "Telefoon": "—", "Containers": 15, "Prioriteit": "Midden"},
    {"Naam": "Brandweer / Politie Bonaire", "Adres": "Kralendijk", "Telefoon": "—", "Containers": 6, "Prioriteit": "Laag"},
]

# ─────────────────────────────────────────────────────────────────────────────
# BEREKENINGEN
# ─────────────────────────────────────────────────────────────────────────────

totaal_hotels   = sum(r["Containers"] for r in hotels)
totaal_super    = sum(r["Containers"] for r in supermarkten)
totaal_rest     = sum(r["Containers"] for r in restaurants)
totaal_airbnb   = sum(r["Containers"] for r in airbnb)
totaal_inst     = sum(r["Containers"] for r in instellingen)
totaal_part_min = 494
totaal_part_max = 1480
totaal_commercieel = totaal_hotels + totaal_super + totaal_rest + totaal_inst

# ─────────────────────────────────────────────────────────────────────────────
# MARKTOVERZICHT
# ─────────────────────────────────────────────────────────────────────────────

st.markdown('<div class="sec-header">Marktpotentieel — totaaloverzicht</div>', unsafe_allow_html=True)

overzicht_df = pd.DataFrame([
    {"Segment": "Hotels & Resorts",          "Locaties (bekend)": len(hotels),        "Containers": totaal_hotels,  "Frequentie": "Wekelijks"},
    {"Segment": "Supermarkten & toko's",     "Locaties (bekend)": len(supermarkten),  "Containers": totaal_super,   "Frequentie": "Wekelijks"},
    {"Segment": "Restaurants & horeca",      "Locaties (bekend)": "~160",             "Containers": totaal_rest,    "Frequentie": "Wekelijks"},
    {"Segment": "Airbnb / Vakantieverhuur",  "Locaties (bekend)": "~200",             "Containers": totaal_airbnb,  "Frequentie": "Maandelijks"},
    {"Segment": "Overheid & Instellingen",   "Locaties (bekend)": len(instellingen),  "Containers": totaal_inst,    "Frequentie": "Wekelijks"},
    {"Segment": "Particulieren (5–15%)",     "Locaties (bekend)": "494 – 1.480",      "Containers": f"{totaal_part_min} – {totaal_part_max}", "Frequentie": "Maandelijks"},
])
st.dataframe(overzicht_df, use_container_width=True, hide_index=True)

c1, c2, c3 = st.columns(3)
c1.metric("Commercieel potentieel", f"~{totaal_commercieel} containers",
          help="Hotels + supermarkten + restaurants + instellingen")
c2.metric("Totaal incl. vakantieverhuur + particulieren (min)", f"~{totaal_commercieel + totaal_airbnb + totaal_part_min:,}")
c3.metric("Totaal incl. vakantieverhuur + particulieren (max)", f"~{totaal_commercieel + totaal_airbnb + totaal_part_max:,}")

# ─────────────────────────────────────────────────────────────────────────────
# HOTELS
# ─────────────────────────────────────────────────────────────────────────────

st.markdown('<div class="sec-header">Hotels, Resorts & Appartementen</div>', unsafe_allow_html=True)

df_hotels = pd.DataFrame(hotels)
st.caption(
    f"{len(hotels)} accommodaties in kaart gebracht — totaal ~{totaal_hotels} containers geschat. "
    f"Bonaireisland.com (officieel toerismekantoor) telt 77 geregistreerde accommodaties; bonaire.com telt 408 inclusief alle vakantieverhuur."
)

c1, c2 = st.columns([2, 1])
with c1:
    type_filter = st.multiselect(
        "Filter op type",
        sorted(df_hotels["Type"].unique()),
        default=list(df_hotels["Type"].unique()),
        key="hotel_type"
    )
with c2:
    prio_filter = st.selectbox("Filter op prioriteit", ["Alle", "Hoog", "Midden", "Laag"], key="hotel_prio")

mask = df_hotels["Type"].isin(type_filter)
if prio_filter != "Alle":
    mask &= df_hotels["Prioriteit"] == prio_filter
df_show = df_hotels[mask].drop(columns=["Type"])
st.dataframe(df_show, use_container_width=True, hide_index=True)
st.caption(f"{len(df_show)} van {len(hotels)} getoond — {df_show['Containers'].sum()} containers in selectie")

# ─────────────────────────────────────────────────────────────────────────────
# SUPERMARKTEN
# ─────────────────────────────────────────────────────────────────────────────

st.markdown('<div class="sec-header">Supermarkten, Chinese winkels & Toko\'s</div>', unsafe_allow_html=True)
st.caption(
    f"{len(supermarkten)} vestigingen in kaart gebracht — totaal ~{totaal_super} containers. "
    f"Bonaire.com telt 27 supermarkten totaal. Chinese toko's zijn klein maar produceren regelmatig afval en zijn makkelijk te benaderen."
)

type_s = st.multiselect(
    "Filter op type",
    sorted(set(r["Type"] for r in supermarkten)),
    default=sorted(set(r["Type"] for r in supermarkten)),
    key="super_type"
)
df_super = pd.DataFrame(supermarkten)
st.dataframe(df_super[df_super["Type"].isin(type_s)], use_container_width=True, hide_index=True)

# ─────────────────────────────────────────────────────────────────────────────
# RESTAURANTS
# ─────────────────────────────────────────────────────────────────────────────

st.markdown('<div class="sec-header">Restaurants & Horeca</div>', unsafe_allow_html=True)
st.caption(f"~160 restaurants op Bonaire — totaal ~{totaal_rest} containers. Wekelijkse reiniging sterk aanbevolen vanwege organisch afval.")
st.dataframe(pd.DataFrame(restaurants), use_container_width=True, hide_index=True)
st.info(
    "Tripadvisor telt 188 eetgelegenheden in Kralendijk. Bonaire.com telt ~160 restaurants. "
    "Aanpak via directe bezoeken aan de keukenmanager of eigenaar, aanwezig zijn bij horeca-netwerken, en mond-tot-mond via vroege klanten."
)

# ─────────────────────────────────────────────────────────────────────────────
# AIRBNB
# ─────────────────────────────────────────────────────────────────────────────

st.markdown('<div class="sec-header">Airbnb & Vakantieverhuur</div>', unsafe_allow_html=True)
st.caption(f"~{totaal_airbnb} vakantieverblijven — maandelijks pakket meest logisch")
st.dataframe(pd.DataFrame(airbnb), use_container_width=True, hide_index=True)
st.info(
    "AirROI (2025): 141 actieve Airbnb listings op Bonaire — 92,9% volledige woningen/appartementen. "
    "Eigenaren zijn sterk gemotiveerd: schone accommodaties = betere beoordelingen = meer boekingen. "
    "Benadering via: Facebook-groepen Bonaire expats & hosts, flyeractie in vakantiewijken, samenwerking met verhuurkantoren (Qvillas, SunRentals, Happy Homes)."
)

# ─────────────────────────────────────────────────────────────────────────────
# OVERHEID & INSTELLINGEN
# ─────────────────────────────────────────────────────────────────────────────

st.markdown('<div class="sec-header">Overheid & Instellingen</div>', unsafe_allow_html=True)
st.caption(f"{len(instellingen)} instellingen — ~{totaal_inst} containers — stabiele contractpartners")
st.dataframe(pd.DataFrame(instellingen), use_container_width=True, hide_index=True)
st.info(
    "De overheid is de grootste werkgever op Bonaire (~1.700 ambtenaren). "
    "Contracten met overheidsinstanties bieden stabiliteit en zekerheid van betaling. "
    "Aanpak via formele offerteaanvraag bij facility management / inkoopafdeling."
)

# ─────────────────────────────────────────────────────────────────────────────
# PARTICULIEREN
# ─────────────────────────────────────────────────────────────────────────────

st.markdown('<div class="sec-header">Particulieren</div>', unsafe_allow_html=True)

pc1, pc2, pc3 = st.columns(3)
pc1.metric("Inwoners Bonaire (jan 2026)", "27.611")
pc2.metric("Geschat aantal huishoudens", "~9.870")
pc3.metric("Bevolkingsgroei 2011–2026", "+70%")

st.markdown("""
| Scenario | Marktaandeel | Klanten | Containers/maand |
|----------|-------------|---------|-----------------|
| Conservatief | 5% | ~494 | 494 |
| Realistisch | 10% | ~987 | 987 |
| Optimistisch | 15% | ~1.481 | 1.481 |
""")

st.info(
    "Bonaire groeit sterk en trekt veel expats aan. Groeiende middenklasse is een kansrijke doelgroep. "
    "Aanpak via: flyers in wijken, samenwerking met woningstichtingen, Facebook-groepen, aanwezigheid bij lokale markten."
)

# ─────────────────────────────────────────────────────────────────────────────
# AANPAK PER SEGMENT
# ─────────────────────────────────────────────────────────────────────────────

st.markdown('<div class="sec-header">Aanbevolen aanpak per segment</div>', unsafe_allow_html=True)

strategie = pd.DataFrame([
    {"Segment": "Hotels & Resorts",       "Aanpak": "Directe acquisitie bij facility manager / eigenaar",      "Product": "Wekelijks abonnement", "Containers/klant": "5–15", "Opbrengst/klant": "$ 45–180/mnd"},
    {"Segment": "Supermarkten & toko's",  "Aanpak": "Bezoek aan manager, offerte op maat",                      "Product": "Wekelijks abonnement", "Containers/klant": "2–8",  "Opbrengst/klant": "$ 45–135/mnd"},
    {"Segment": "Restaurants",            "Aanpak": "Flyers, cold calling, mond-tot-mond",                      "Product": "Wekelijks abonnement", "Containers/klant": "1–3",  "Opbrengst/klant": "$ 45–90/mnd"},
    {"Segment": "Airbnb / Verhuurkantoor","Aanpak": "Facebook groepen, samenwerking verhuurkantoren",           "Product": "Maandelijks abonnement","Containers/klant": "1",   "Opbrengst/klant": "$ 12–15/mnd"},
    {"Segment": "Overheid & Instellingen","Aanpak": "Offerteaanvraag via facility management / inkoop",         "Product": "Wekelijks contract",   "Containers/klant": "4–10", "Opbrengst/klant": "$ 90–225/mnd"},
    {"Segment": "Particulieren",          "Aanpak": "Flyers, sociale media (Facebook Bonaire), wijkacties",     "Product": "Maandelijks abonnement","Containers/klant": "1",   "Opbrengst/klant": "$ 12/mnd"},
])
st.dataframe(strategie, use_container_width=True, hide_index=True)
