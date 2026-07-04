import streamlit as st
import pandas as pd
from models import load_scenarios
from services.prijsbeleid_store import load_prijsbeleid, save_prijsbeleid, PrijsBeleid

st.markdown("""
<style>
.block-container { padding-top: 1.5rem; }
.sec-header {
    background: #1e2d3d; color: #ffffff;
    padding: 4px 12px; font-size: 10px; font-weight: 700;
    letter-spacing: 2px; text-transform: uppercase;
    margin: 22px 0 8px 0; border-radius: 2px;
}
.win { color: #1a7f3c; font-weight: 700; }
.ver { color: #c0392b; font-weight: 700; }
</style>
""", unsafe_allow_html=True)

st.title("Kliko Cleaning Bonaire — Prijsbeleid")
st.caption("Prijzen worden beheerd op de Invoer pagina. Hier stel je kortingen en cadeaus in.")

scenarios = load_scenarios()
if not scenarios:
    st.warning("Ga eerst naar Invoer om scenario's aan te maken met prijzen.")
    st.stop()

ref = scenarios[0]
pb = load_prijsbeleid()
w = {}

# ── ABONNEMENTSPRIJZEN (readonly, uit Invoer) ─────────────────────────────────
st.markdown('<div class="sec-header">Abonnementsprijzen (ingesteld via Invoer)</div>', unsafe_allow_html=True)

st.write("""
**Popcorn-principe**: 3 opties per containertype.
- **1x/mnd** = basisprijs (anker)
- **2x/mnd** = bewust minder aantrekkelijk (hoge prijs per reiniging)
- **4x/mnd** = slechts een klein beetje meer dan 2x/mnd → klanten kiezen vanzelf voor het beste pakket
""")

def popcorn_tabel(naam, p1, p2, p4):
    diff_1_naar_2 = p2 - p1
    diff_2_naar_4 = p4 - p2
    rows = [
        {
            "Pakket": "Basis — 1x/mnd",
            "Prijs/mnd": f"$ {p1:.2f}",
            "Per reiniging": f"$ {p1/1:.2f}",
            "Meerprijs t.o.v. vorige": "—",
        },
        {
            "Pakket": "Medium — 2x/mnd",
            "Prijs/mnd": f"$ {p2:.2f}",
            "Per reiniging": f"$ {p2/2:.2f}",
            "Meerprijs t.o.v. vorige": f"+ $ {diff_1_naar_2:.2f}  (voor 1 extra/mnd)",
        },
        {
            "Pakket": "Beste deal — 4x/mnd",
            "Prijs/mnd": f"$ {p4:.2f}",
            "Per reiniging": f"$ {p4/4:.2f}",
            "Meerprijs t.o.v. vorige": f"+ $ {diff_2_naar_4:.2f}  (voor 2 extra/mnd)",
        },
    ]
    st.write(f"**{naam}**")
    st.dataframe(pd.DataFrame(rows), use_container_width=True, hide_index=True)

    if diff_2_naar_4 < diff_1_naar_2:
        st.success(
            f"Popcorn-principe werkt: 4x/mnd is maar $ {diff_2_naar_4:.2f} meer dan 2x/mnd, "
            f"maar geeft dubbel zo veel reinigingen."
        )
    else:
        st.warning(
            f"Overweeg 4x/mnd dichter bij 2x/mnd te prijzen (nu meerprijs $ {diff_2_naar_4:.2f} "
            f"vs. $ {diff_1_naar_2:.2f} bij stap 1→2). Pas aan op de Invoer pagina."
        )

col_t1, col_t2 = st.columns(2)
with col_t1:
    popcorn_tabel("Kleine container",
                  ref.prijs_klein_1, ref.prijs_klein_2, ref.prijs_klein_4)
with col_t2:
    popcorn_tabel("Bedrijfscontainer",
                  ref.prijs_bedrijf_1, ref.prijs_bedrijf_2, ref.prijs_bedrijf_4)

# ── KORTINGEN ────────────────────────────────────────────────────────────────
st.markdown('<div class="sec-header">Kortingen</div>', unsafe_allow_html=True)

kor_col, jaar_col = st.columns(2)

with kor_col:
    st.subheader("Multi-container korting")
    st.caption("Korting op de abonnementsprijs van elke extra container bij dezelfde klant.")
    w["korting_2e"] = st.number_input("2e container (% korting)", value=float(pb.korting_2e_container),
                                       min_value=0.0, max_value=50.0, step=1.0, format="%.1f")
    w["korting_3e"] = st.number_input("3e container (% korting)", value=float(pb.korting_3e_container),
                                       min_value=0.0, max_value=50.0, step=1.0, format="%.1f")
    w["korting_4e"] = st.number_input("4e container en meer (% korting)", value=float(pb.korting_4e_container),
                                       min_value=0.0, max_value=50.0, step=1.0, format="%.1f")

with jaar_col:
    st.subheader("Jaarcontract")
    st.caption("Klant betaalt 12 maanden vooruit en ontvangt korting op het totaalbedrag.")
    w["korting_jaar"] = st.number_input("Korting jaarcontract (%)", value=float(pb.korting_jaarcontract),
                                         min_value=0.0, max_value=30.0, step=0.5, format="%.1f")

# ── CADEAUS ──────────────────────────────────────────────────────────────────
st.markdown('<div class="sec-header">Welkomstvoordelen & Cadeaus</div>', unsafe_allow_html=True)

cad_col1, cad_col2 = st.columns(2)

with cad_col1:
    st.subheader("Welkomstcadeau (iedereen)")
    w["cadeau_welkom"] = st.text_input(
        "Omschrijving", value=pb.cadeau_welkom, key="cw",
        help="Geldt voor alle nieuwe klanten bij afsluiten van een abonnement"
    )

with cad_col2:
    st.subheader("Jaarcontract cadeau")
    w["cadeau_jaar"] = st.text_input(
        "Omschrijving", value=pb.cadeau_jaarcontract, key="cj",
        help="Extra voordeel bij afsluiting van 12-maanden contract"
    )

# ── OPSLAAN ──────────────────────────────────────────────────────────────────
st.write("")
if st.button("Kortingen & cadeaus opslaan", type="primary"):
    save_prijsbeleid(PrijsBeleid(
        korting_2e_container=w["korting_2e"],
        korting_3e_container=w["korting_3e"],
        korting_4e_container=w["korting_4e"],
        korting_jaarcontract=w["korting_jaar"],
        cadeau_jaarcontract=w["cadeau_jaar"],
        cadeau_welkom=w["cadeau_welkom"],
    ))
    st.success("Opgeslagen.")
