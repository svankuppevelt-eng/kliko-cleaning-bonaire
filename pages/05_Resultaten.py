import streamlit as st
import pandas as pd
from models import load_scenarios
from services.calculator import bereken, projecteer_cumulatief

st.title("📊 Resultaten")

scenarios = load_scenarios()
if not scenarios:
    st.warning("Maak eerst een scenario aan via de pagina **Scenario's**.")
    st.stop()

scenario_namen = {s.naam: s for s in scenarios}
keuze = st.selectbox("Scenario", list(scenario_namen.keys()))
s = scenario_namen[keuze]
r = bereken(s)

st.divider()

# ── Samenvatting ────────────────────────────────────────────────────────────
kleur = "normal" if r.netto_winst >= 0 else "inverse"

c1, c2, c3, c4 = st.columns(4)
c1.metric("Totale investering", f"$ {r.totaal_investering:,.2f}")
c2.metric("Maandomzet", f"$ {r.totaal_omzet:,.2f}")
c3.metric("Maandkosten", f"$ {r.totaal_kosten:,.2f}")
c4.metric("Netto winst/maand", f"$ {r.netto_winst:,.2f}", delta_color=kleur,
          delta="✅ rendabel" if r.netto_winst > 0 else "❌ verlieslatend")

st.divider()

# ── Omzetopbouw ─────────────────────────────────────────────────────────────
col_l, col_r = st.columns(2)

with col_l:
    st.subheader("Omzetopbouw")
    omzet_data = {
        "Type": ["Losse reinigingen", "Wekelijks abonnement", "Maandelijks abonnement"],
        "Bedrag ($)": [r.omzet_los, r.omzet_wekelijks_abo, r.omzet_maandelijks_abo],
    }
    df_omzet = pd.DataFrame(omzet_data)
    df_omzet["% van totaal"] = (df_omzet["Bedrag ($)"] / r.totaal_omzet * 100).round(1) if r.totaal_omzet else 0
    st.dataframe(df_omzet, use_container_width=True, hide_index=True)

with col_r:
    st.subheader("Kostenopbouw")
    kosten_data = {
        "Type": ["Variabele kosten (per job)", "Vaste maandkosten"],
        "Bedrag ($)": [r.variabele_kosten, r.vaste_kosten],
    }
    df_kosten = pd.DataFrame(kosten_data)
    df_kosten["% van totaal"] = (df_kosten["Bedrag ($)"] / r.totaal_kosten * 100).round(1) if r.totaal_kosten else 0
    st.dataframe(df_kosten, use_container_width=True, hide_index=True)

st.divider()

# ── Terugverdientijd ────────────────────────────────────────────────────────
st.subheader("Terugverdientijd investering")

if r.terugverdien_maanden is not None:
    tc1, tc2 = st.columns(2)
    with tc1:
        st.metric("Terugverdientijd", f"{r.terugverdien_maanden:.1f} maanden")
    with tc2:
        st.metric("In jaren", f"{r.terugverdien_jaren:.2f} jaar")

    # Grafiek cumulatieve winst/verlies
    jaren = st.slider("Projectieperiode (jaren)", 1, 5, 3)
    punten = projecteer_cumulatief(s, maanden=jaren * 12)
    df_proj = pd.DataFrame(punten)
    df_proj.columns = ["Maand", "Cumulatieve winst ($)"]

    st.line_chart(df_proj.set_index("Maand"), use_container_width=True)
    st.caption("Startpunt: −investering. De lijn kruist 0 bij de terugverdientijd.")
else:
    st.error("Dit scenario is verlieslatend — de investering wordt nooit terugverdiend op basis van de huidige cijfers.")

st.divider()

# ── Break-even ──────────────────────────────────────────────────────────────
st.subheader("Break-even analyse")

c1, c2 = st.columns(2)
with c1:
    st.metric("Kosten per reiniging", f"$ {r.kosten_per_reiniging:.2f}")
with c2:
    if r.break_even_reinigingen > 0:
        st.metric("Break-even (losse reinigingen/maand)", r.break_even_reinigingen,
                  help="Aantal losse reinigingen nodig om de vaste maandkosten te dekken")
    else:
        st.metric("Break-even", "niet haalbaar", help="Prijs per reiniging is lager dan de kosten per reiniging")

st.divider()

# ── Gedetailleerd overzicht ─────────────────────────────────────────────────
with st.expander("📋 Volledig overzicht"):
    st.markdown(f"""
**Reinigingen per maand**
- Losse reinigingen: {s.losse_reinigingen}
- Wekelijkse abonnees × 4: {s.wekelijkse_abonnees * 4}
- Maandelijkse abonnees: {s.maandelijkse_abonnees}
- **Totaal: {r.aantal_reinigingen_per_maand}**

**Omzet**
- Losse reinigingen: $ {r.omzet_los:,.2f}
- Wekelijks abonnement: $ {r.omzet_wekelijks_abo:,.2f}
- Maandelijks abonnement: $ {r.omzet_maandelijks_abo:,.2f}
- **Totale omzet: $ {r.totaal_omzet:,.2f}**

**Kosten**
- Variabele kosten: $ {r.variabele_kosten:,.2f} ({r.aantal_reinigingen_per_maand} × $ {r.kosten_per_reiniging:.2f})
- Vaste kosten: $ {r.vaste_kosten:,.2f}
- **Totale kosten: $ {r.totaal_kosten:,.2f}**

**Resultaat**
- Netto winst/maand: $ {r.netto_winst:,.2f}
- Netto winst/jaar: $ {r.netto_winst * 12:,.2f}
- Totale investering: $ {r.totaal_investering:,.2f}
- Terugverdientijd: {f"{r.terugverdien_maanden:.1f} maanden" if r.terugverdien_maanden else "N.v.t. (verlieslatend)"}
    """)
