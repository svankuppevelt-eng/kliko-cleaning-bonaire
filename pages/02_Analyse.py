import streamlit as st
import pandas as pd
import altair as alt
from models import load_scenarios
from services.calculator import bereken, cumulatief

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
.win { color: #1a7f3c; font-weight: 700; }
.ver { color: #c0392b; font-weight: 700; }
.warn { color: #e67e22; font-weight: 700; }
</style>
""", unsafe_allow_html=True)

scenarios = load_scenarios()
if not scenarios:
    st.info("Ga naar de pagina Invoer om scenario's aan te maken.")
    st.stop()

st.title("Kliko Cleaning Bonaire — Analyse")
st.caption("Alle berekeningen zijn gebaseerd op 1 cleaner met een vast maandsalaris.")

resultaten = [(s, bereken(s)) for s in scenarios]

# ── SAMENVATTING ──────────────────────────────────────────────────────────────
st.markdown('<div class="sec-header">Samenvatting per scenario</div>', unsafe_allow_html=True)

tabel_rows = []
for s, r in resultaten:
    cap_kleur = "OVER CAPACITEIT" if r.capaciteit_benut > 1.0 else f"{r.capaciteit_benut:.0%}"
    tabel_rows.append({
        "Scenario": s.naam,
        "Klanten": r.totaal_klanten,
        "Reinigingen/mnd": r.totaal_reinigingen,
        "Capaciteit": cap_kleur,
        "Investering ($)": f"$ {r.totaal_investering:,.0f}",
        "Maandomzet ($)": f"$ {r.totaal_omzet:,.2f}",
        "Maandkosten ($)": f"$ {r.totaal_kosten:,.2f}",
        "Netto winst/mnd ($)": f"$ {r.netto_winst:,.2f}",
        "Terugverdientijd": (
            f"{r.terugverdien_maanden:.1f} mnd ({r.terugverdien_jaren:.1f} jr)"
            if r.terugverdien_maanden else "niet rendabel"
        ),
    })

st.dataframe(pd.DataFrame(tabel_rows), use_container_width=True, hide_index=True)

# ── CAPACITEITSWAARSCHUWING ───────────────────────────────────────────────────
over_cap = [(s.naam, r.totaal_reinigingen, r.capaciteit_mnd)
            for s, r in resultaten if r.capaciteit_benut > 1.0]
if over_cap:
    for naam, rein, cap in over_cap:
        st.warning(
            f"**{naam}** vereist {rein} reinigingen/mnd maar capaciteit is {cap}. "
            "Tweede cleaner nodig of klantenaantallen verlagen."
        )

# ── CUMULATIEVE WINST ─────────────────────────────────────────────────────────
st.markdown('<div class="sec-header">Terugverdientijd — cumulatieve winst/verlies</div>', unsafe_allow_html=True)

jaren = st.slider("Projectieperiode (jaren)", 1, 6, 4, key="proj_jaren")
maanden = jaren * 12

punten_per_scenario = [cumulatief(s, maanden) for s, _ in resultaten]

df_cum = pd.DataFrame({"Maand": list(range(1, maanden + 1))})
for i, (s, _) in enumerate(resultaten):
    df_cum[s.naam] = [p[s.naam] for p in punten_per_scenario[i]]

df_melted = df_cum.melt("Maand", var_name="Scenario", value_name="Cumulatief ($)")

lijnen = alt.Chart(df_melted).mark_line(strokeWidth=2).encode(
    x=alt.X("Maand:Q", title="Maand"),
    y=alt.Y("Cumulatief ($):Q", title="Cumulatief ($)"),
    color=alt.Color("Scenario:N"),
    tooltip=["Maand:Q", "Scenario:N", "Cumulatief ($):Q"],
)

nul_lijn = alt.Chart(pd.DataFrame({"y": [0]})).mark_rule(
    color="#c0392b", strokeWidth=2, strokeDash=[6, 3]
).encode(y="y:Q")

st.altair_chart(lijnen + nul_lijn, use_container_width=True)
st.caption("Startpunt: eenmalige investering als negatief saldo. De lijn die de rode nullijn kruist, geeft de terugverdientijd.")

# ── OMZET EN KOSTEN DETAIL ────────────────────────────────────────────────────
st.markdown('<div class="sec-header">Omzet- en kostenopbouw per scenario</div>', unsafe_allow_html=True)

detail_cols = st.columns(len(scenarios))

ABO_LABELS = {
    "omzet_klein_1":   "Kleine container — 1x/mnd",
    "omzet_klein_2":   "Kleine container — 2x/mnd",
    "omzet_klein_4":   "Kleine container — 4x/mnd",
    "omzet_bedrijf_1": "Bedrijfscontainer — 1x/mnd",
    "omzet_bedrijf_2": "Bedrijfscontainer — 2x/mnd",
    "omzet_bedrijf_4": "Bedrijfscontainer — 4x/mnd",
}

for col, (s, r) in zip(detail_cols, resultaten):
    with col:
        st.write(f"**{s.naam}**")

        omzet_rows = [
            {"Abonnement": lbl, "Omzet ($)": getattr(r, veld)}
            for veld, lbl in ABO_LABELS.items()
            if getattr(r, veld) > 0
        ]
        if omzet_rows:
            st.dataframe(pd.DataFrame(omzet_rows), use_container_width=True, hide_index=True)

        kosten_df = pd.DataFrame({
            "Type": ["Personeel", "Overige vast", "Variabel"],
            "Kosten ($)": [r.personeel_kosten, r.overige_vaste_kosten, r.variabele_kosten],
        })
        st.dataframe(kosten_df, use_container_width=True, hide_index=True)

        kleur = "win" if r.netto_winst >= 0 else "ver"
        st.markdown(
            f'Netto winst/mnd: <span class="{kleur}">$ {r.netto_winst:,.2f}</span>',
            unsafe_allow_html=True,
        )

# ── BREAK-EVEN ────────────────────────────────────────────────────────────────
st.markdown('<div class="sec-header">Break-even analyse</div>', unsafe_allow_html=True)

be_cols = st.columns(len(scenarios))
for col, (s, r) in zip(be_cols, resultaten):
    with col:
        st.write(f"**{s.naam}**")
        st.metric("Var. kosten per reiniging", f"$ {r.kosten_per_reiniging:.2f}")
        st.metric("Gem. opbrengst per reiniging", f"$ {r.gem_opbrengst_per_reiniging:.2f}")
        st.metric("Capaciteitsbenutting", f"{r.capaciteit_benut:.0%}")
        if r.break_even_klanten_mnd1 > 0:
            st.metric(
                "Break-even (klein 1x klanten)",
                r.break_even_klanten_mnd1,
                help="Min. aantal klanten (kleine container, 1x/mnd) om alle vaste kosten te dekken",
            )
        else:
            st.metric("Break-even", "N.v.t.")
