import streamlit as st
from models import load_scenarios, upsert_scenario

st.title("👥 Klanten & Prijsstelling")

scenarios = load_scenarios()
if not scenarios:
    st.warning("Maak eerst een scenario aan via de pagina **Scenario's**.")
    st.stop()

scenario_namen = {s.naam: s for s in scenarios}
keuze = st.selectbox("Scenario", list(scenario_namen.keys()))
s = scenario_namen[keuze]

st.divider()

# ── Prijsstelling ───────────────────────────────────────────────────────────
st.subheader("Prijsstelling")

c1, c2, c3 = st.columns(3)
with c1:
    prijs_los = st.number_input(
        "Losse reiniging ($)",
        value=float(s.prijs_los), min_value=0.0, step=1.0, format="%.2f",
        help="Prijs voor een eenmalige schoonmaak"
    )
with c2:
    prijs_wekelijks = st.number_input(
        "Wekelijks abonnement ($/maand)",
        value=float(s.prijs_wekelijks_abo), min_value=0.0, step=1.0, format="%.2f",
        help="Maandprijs voor wekelijkse schoonmaak (4× per maand)"
    )
with c3:
    prijs_maandelijks = st.number_input(
        "Maandelijks abonnement ($/maand)",
        value=float(s.prijs_maandelijks_abo), min_value=0.0, step=1.0, format="%.2f",
        help="Maandprijs voor 1× per maand schoonmaak"
    )

kosten_per_job = s.water_per_reiniging + s.arbeid_per_reiniging + s.overig_per_reiniging

with st.expander("📊 Margeoverzicht op basis van ingevoerde prijzen"):
    mc1, mc2, mc3 = st.columns(3)
    with mc1:
        marge_los = prijs_los - kosten_per_job
        st.metric("Marge losse reiniging", f"$ {marge_los:.2f}",
                  delta=f"{(marge_los/prijs_los*100):.0f}%" if prijs_los else None)
    with mc2:
        prijs_per_job_w = prijs_wekelijks / 4
        marge_w = prijs_per_job_w - kosten_per_job
        st.metric("Marge p/job (wekelijks abo)", f"$ {marge_w:.2f}",
                  delta=f"{(marge_w/prijs_per_job_w*100):.0f}%" if prijs_per_job_w else None)
    with mc3:
        marge_m = prijs_maandelijks - kosten_per_job
        st.metric("Marge maandelijks abo", f"$ {marge_m:.2f}",
                  delta=f"{(marge_m/prijs_maandelijks*100):.0f}%" if prijs_maandelijks else None)

st.divider()

# ── Klantenprognose ─────────────────────────────────────────────────────────
st.subheader("Klantenprognose per maand")

c1, c2, c3 = st.columns(3)
with c1:
    los = st.number_input(
        "Losse reinigingen",
        value=int(s.losse_reinigingen), min_value=0, step=1,
        help="Aantal losse opdrachten per maand"
    )
with c2:
    wekelijks = st.number_input(
        "Wekelijkse abonnees",
        value=int(s.wekelijkse_abonnees), min_value=0, step=1,
        help="Klanten met wekelijks abo → 4 reinigingen per maand"
    )
with c3:
    maandelijks = st.number_input(
        "Maandelijkse abonnees",
        value=int(s.maandelijkse_abonnees), min_value=0, step=1,
        help="Klanten met maandelijks abo → 1 reiniging per maand"
    )

totaal_reinigingen = los + (wekelijks * 4) + maandelijks
totaal_omzet = (los * prijs_los) + (wekelijks * prijs_wekelijks) + (maandelijks * prijs_maandelijks)

rc1, rc2 = st.columns(2)
with rc1:
    st.metric("Totaal reinigingen/maand", totaal_reinigingen)
with rc2:
    st.metric("Verwachte maandomzet", f"$ {totaal_omzet:,.2f}")

# Tijdschatting
if totaal_reinigingen > 0:
    with st.expander("⏱️ Tijdschatting"):
        min_per_job = st.slider("Minuten per reiniging", 15, 90, 30)
        totaal_uren = (totaal_reinigingen * min_per_job) / 60
        st.info(f"**{totaal_reinigingen} reinigingen** à {min_per_job} min = **{totaal_uren:.1f} uur/maand** ({totaal_uren/4:.1f} uur/week gemiddeld)")

st.divider()

if st.button("Opslaan", type="primary"):
    s.prijs_los = prijs_los
    s.prijs_wekelijks_abo = prijs_wekelijks
    s.prijs_maandelijks_abo = prijs_maandelijks
    s.losse_reinigingen = int(los)
    s.wekelijkse_abonnees = int(wekelijks)
    s.maandelijkse_abonnees = int(maandelijks)
    upsert_scenario(s)
    st.success("Klanten & prijzen opgeslagen!")
