import streamlit as st
from models import load_scenarios, upsert_scenario, Kostenpost

st.title("💰 Eenmalige investering")
st.caption("Voer alle kosten in die je eenmalig moet maken om het bedrijf op te starten.")

scenarios = load_scenarios()
if not scenarios:
    st.warning("Maak eerst een scenario aan via de pagina **Scenario's**.")
    st.stop()

scenario_namen = {s.naam: s for s in scenarios}
keuze = st.selectbox("Scenario", list(scenario_namen.keys()))
s = scenario_namen[keuze]

st.divider()

# ── Investeringsposten bewerken ─────────────────────────────────────────────
st.subheader("Investeringsposten")
st.caption("Denk aan: hogedrukreiniger, aanhanger, slangen, reinigingsmiddelen, werkkleding, vervoer, registratie bedrijf, etc.")

investeringen = list(s.investeringen)
verwijder_idx = None

for i, k in enumerate(investeringen):
    c1, c2, c3 = st.columns([3, 2, 1])
    with c1:
        investeringen[i].naam = st.text_input(
            "Omschrijving", value=k.naam, key=f"inv_naam_{i}", label_visibility="collapsed",
            placeholder="Omschrijving"
        )
    with c2:
        investeringen[i].bedrag = st.number_input(
            "Bedrag ($)", value=k.bedrag, min_value=0.0, step=10.0,
            key=f"inv_bed_{i}", label_visibility="collapsed", format="%.2f"
        )
    with c3:
        if st.button("✕", key=f"inv_del_{i}"):
            verwijder_idx = i

if verwijder_idx is not None:
    investeringen.pop(verwijder_idx)
    s.investeringen = investeringen
    upsert_scenario(s)
    st.rerun()

if st.button("➕ Investeringspost toevoegen"):
    investeringen.append(Kostenpost(naam="", bedrag=0.0))
    s.investeringen = investeringen
    upsert_scenario(s)
    st.rerun()

st.divider()

totaal = sum(k.bedrag for k in investeringen)
st.metric("Totale investering", f"$ {totaal:,.2f}")

if st.button("Opslaan", type="primary"):
    s.investeringen = [k for k in investeringen if k.naam.strip()]
    upsert_scenario(s)
    st.success("Investeringen opgeslagen!")

# ── Suggesties ──────────────────────────────────────────────────────────────
with st.expander("💡 Mogelijke investeringsposten"):
    st.markdown("""
| Post | Geschatte kosten |
|------|-----------------|
| Hogedrukreiniger | $ 500 – 2.000 |
| Aanhanger / kar | $ 300 – 1.500 |
| Slangen & accessoires | $ 100 – 400 |
| Reinigingsmiddelen (startvoorraad) | $ 50 – 200 |
| Werkkleding & PBM | $ 100 – 300 |
| Bedrijfsregistratie Bonaire | $ 50 – 150 |
| Marketing / visitekaartjes / website | $ 100 – 500 |
| Vervoer / auto aanpassing | $ 0 – 1.000 |

*Bedragen zijn schattingen. Vul jouw werkelijke offertes in.*
    """)
