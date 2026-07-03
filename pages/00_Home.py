import streamlit as st
from models import load_scenarios
from services.calculator import bereken

st.title("🗑️ Garbage Can Bonaire — Dashboard")
st.caption("Business feasibility calculator voor container reiniging op Bonaire")

scenarios = load_scenarios()

if not scenarios:
    st.info("Nog geen scenario's aangemaakt. Ga naar **Scenario's** om te beginnen.")
    st.stop()

st.subheader(f"{len(scenarios)} scenario{'s' if len(scenarios) != 1 else ''} aangemaakt")

cols = st.columns(3)
rendabel = 0
verlieslatend = 0
beste_winst = None

for s in scenarios:
    r = bereken(s)
    if r.netto_winst > 0:
        rendabel += 1
        if beste_winst is None or r.netto_winst > beste_winst[1]:
            beste_winst = (s.naam, r.netto_winst, r.terugverdien_maanden)
    else:
        verlieslatend += 1

with cols[0]:
    st.metric("Rendabele scenario's", rendabel)
with cols[1]:
    st.metric("Verlieslatende scenario's", verlieslatend)
with cols[2]:
    if beste_winst:
        st.metric("Beste maandwinst", f"$ {beste_winst[1]:,.2f}", delta=beste_winst[0])

st.divider()
st.subheader("Overzicht alle scenario's")

for s in scenarios:
    r = bereken(s)
    winstkleur = "normal" if r.netto_winst > 0 else "inverse"
    terugverdien = (
        f"{r.terugverdien_maanden:.1f} maanden ({r.terugverdien_jaren:.1f} jaar)"
        if r.terugverdien_maanden else "❌ verlieslatend"
    )
    with st.expander(f"**{s.naam}** — $ {r.netto_winst:,.2f}/maand", expanded=False):
        c1, c2, c3, c4 = st.columns(4)
        c1.metric("Maandomzet", f"$ {r.totaal_omzet:,.2f}")
        c2.metric("Maandkosten", f"$ {r.totaal_kosten:,.2f}")
        c3.metric("Netto winst/maand", f"$ {r.netto_winst:,.2f}", delta_color=winstkleur)
        c4.metric("Terugverdientijd", terugverdien)
        if s.omschrijving:
            st.caption(s.omschrijving)
