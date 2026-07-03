import streamlit as st
from models import load_scenarios, upsert_scenario, Kostenpost

st.title("🔧 Kosten per reiniging & vaste maandkosten")

scenarios = load_scenarios()
if not scenarios:
    st.warning("Maak eerst een scenario aan via de pagina **Scenario's**.")
    st.stop()

scenario_namen = {s.naam: s for s in scenarios}
keuze = st.selectbox("Scenario", list(scenario_namen.keys()))
s = scenario_namen[keuze]

st.divider()

# ── Kosten per reiniging ────────────────────────────────────────────────────
st.subheader("Variabele kosten — per reiniging")
st.caption("Deze kosten worden gemaakt bij élke schoonmaakbeurt.")

c1, c2, c3 = st.columns(3)
with c1:
    water = st.number_input(
        "Water per reiniging ($)",
        value=float(s.water_per_reiniging), min_value=0.0, step=0.25, format="%.2f",
        help="Waterverbruik (liter × prijs per liter) per schoonmaak"
    )
with c2:
    arbeid = st.number_input(
        "Arbeid per reiniging ($)",
        value=float(s.arbeid_per_reiniging), min_value=0.0, step=0.50, format="%.2f",
        help="Loon medewerker per schoonmaak (uurloon × tijdsduur)"
    )
with c3:
    overig = st.number_input(
        "Overig per reiniging ($)",
        value=float(s.overig_per_reiniging), min_value=0.0, step=0.25, format="%.2f",
        help="Reinigingsmiddel, brandstof, slijtage"
    )

totaal_per_job = water + arbeid + overig
st.metric("Totale kosten per reiniging", f"$ {totaal_per_job:.2f}")

with st.expander("💡 Hulp bij berekening arbeid"):
    col_a, col_b = st.columns(2)
    with col_a:
        uurloon = st.number_input("Uurloon medewerker ($)", value=5.0, min_value=0.0, step=0.50)
    with col_b:
        minuten = st.number_input("Tijdsduur per job (minuten)", value=30, min_value=1)
    berekend_arbeid = (uurloon / 60) * minuten
    st.info(f"Berekende arbeidskosten per job: **$ {berekend_arbeid:.2f}**")
    if st.button("Gebruik deze waarde"):
        arbeid = berekend_arbeid
        st.rerun()

with st.expander("💡 Hulp bij berekening water"):
    col_w1, col_w2 = st.columns(2)
    with col_w1:
        liter = st.number_input("Waterverbruik per job (liter)", value=50, min_value=1)
    with col_w2:
        prijs_per_liter = st.number_input("Prijs water per liter ($)", value=0.05, min_value=0.0, step=0.01, format="%.3f")
    berekend_water = liter * prijs_per_liter
    st.info(f"Berekende waterkosten per job: **$ {berekend_water:.2f}**")
    if st.button("Gebruik deze waarde", key="water_btn"):
        water = berekend_water
        st.rerun()

st.divider()

# ── Vaste maandelijkse kosten ───────────────────────────────────────────────
st.subheader("Vaste maandkosten")
st.caption("Kosten die elke maand terugkomen, ongeacht het aantal klanten.")

vaste = list(s.vaste_maandkosten)
verwijder_idx = None

for i, k in enumerate(vaste):
    c1, c2, c3 = st.columns([3, 2, 1])
    with c1:
        vaste[i].naam = st.text_input(
            "Omschrijving", value=k.naam, key=f"vm_naam_{i}", label_visibility="collapsed",
            placeholder="Omschrijving"
        )
    with c2:
        vaste[i].bedrag = st.number_input(
            "Bedrag ($)", value=k.bedrag, min_value=0.0, step=5.0,
            key=f"vm_bed_{i}", label_visibility="collapsed", format="%.2f"
        )
    with c3:
        if st.button("✕", key=f"vm_del_{i}"):
            verwijder_idx = i

if verwijder_idx is not None:
    vaste.pop(verwijder_idx)
    s.vaste_maandkosten = vaste
    upsert_scenario(s)
    st.rerun()

if st.button("➕ Vaste kostenpost toevoegen"):
    vaste.append(Kostenpost(naam="", bedrag=0.0))
    s.vaste_maandkosten = vaste
    upsert_scenario(s)
    st.rerun()

totaal_vast = sum(k.bedrag for k in vaste)
st.metric("Totale vaste maandkosten", f"$ {totaal_vast:,.2f}")

with st.expander("💡 Mogelijke vaste kosten"):
    st.markdown("""
| Post | Geschat |
|------|---------|
| Telefoon / data abonnement | $ 30 – 60 |
| Brandstof auto (maand) | $ 50 – 150 |
| Onderhoud apparatuur | $ 20 – 50 |
| Administratie / boekhouding | $ 50 – 100 |
| Verzekering | $ 30 – 80 |
| Marketing / flyers | $ 20 – 50 |
    """)

st.divider()

if st.button("Opslaan", type="primary"):
    s.water_per_reiniging = water
    s.arbeid_per_reiniging = arbeid
    s.overig_per_reiniging = overig
    s.vaste_maandkosten = [k for k in vaste if k.naam.strip()]
    upsert_scenario(s)
    st.success("Kosten opgeslagen!")
