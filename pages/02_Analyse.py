import streamlit as st
import pandas as pd
from models import load_scenarios
from services.calculator import bereken, cumulatief, schaal_resultaten

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
</style>
""", unsafe_allow_html=True)

scenarios = load_scenarios()
if not scenarios:
    st.info("Ga naar de pagina Invoer om scenario's aan te maken.")
    st.stop()

st.title("Garbage Can Bonaire — Analyse")
st.caption("Alle berekeningen zijn gebaseerd op 1 cleaner, tenzij anders vermeld.")

resultaten = [(s, bereken(s)) for s in scenarios]

# ── SAMENVATTING ──────────────────────────────────────────────────────────────
st.markdown('<div class="sec-header">Samenvatting per scenario</div>', unsafe_allow_html=True)

tabel_rows = []
for s, r in resultaten:
    tabel_rows.append({
        "Scenario": s.naam,
        "Investering ($)": f"$ {r.totaal_investering:,.0f}",
        "Maandomzet ($)": f"$ {r.totaal_omzet:,.2f}",
        "Maandkosten ($)": f"$ {r.totaal_kosten:,.2f}",
        "Netto winst/mnd ($)": f"$ {r.netto_winst:,.2f}",
        "Winst/jaar ($)": f"$ {r.netto_winst * 12:,.2f}",
        "Terugverdientijd": (
            f"{r.terugverdien_maanden:.1f} mnd ({r.terugverdien_jaren:.1f} jr)"
            if r.terugverdien_maanden else "niet rendabel"
        ),
        "Rendabel": "Ja" if r.netto_winst > 0 else "Nee",
    })

st.dataframe(pd.DataFrame(tabel_rows), use_container_width=True, hide_index=True)

# ── NETTO WINST BAR CHART ─────────────────────────────────────────────────────
st.markdown('<div class="sec-header">Netto winst per maand</div>', unsafe_allow_html=True)

winst_df = pd.DataFrame({
    "Scenario": [s.naam for s, _ in resultaten],
    "Netto winst per maand ($)": [r.netto_winst for _, r in resultaten],
})
st.bar_chart(winst_df.set_index("Scenario"), use_container_width=True, height=280)

# ── CUMULATIEVE WINST ─────────────────────────────────────────────────────────
st.markdown('<div class="sec-header">Terugverdientijd — cumulatieve winst/verlies</div>', unsafe_allow_html=True)

jaren = st.slider("Projectieperiode (jaren)", 1, 6, 4, key="proj_jaren")
maanden = jaren * 12

# Merge alle scenario's in 1 dataframe
punten_per_scenario = [cumulatief(s, maanden) for s, _ in resultaten]

df_cum = pd.DataFrame({"Maand": list(range(1, maanden + 1))})
for i, (s, _) in enumerate(resultaten):
    df_cum[s.naam] = [p[s.naam] for p in punten_per_scenario[i]]

st.line_chart(df_cum.set_index("Maand"), use_container_width=True, height=320)
st.caption("Startpunt: eenmalige investering als negatief saldo. De lijn die de nullijn kruist, geeft de terugverdientijd.")

# ── OMZET EN KOSTEN DETAIL ────────────────────────────────────────────────────
st.markdown('<div class="sec-header">Omzet- en kostenopbouw per scenario</div>', unsafe_allow_html=True)

detail_cols = st.columns(len(scenarios))
for col, (s, r) in zip(detail_cols, resultaten):
    with col:
        st.write(f"**{s.naam}**")
        omzet_df = pd.DataFrame({
            "Type": ["Los", "Wekelijks abo", "Maandelijks abo"],
            "Omzet ($)": [r.omzet_los, r.omzet_wekelijks, r.omzet_maandelijks],
        })
        st.dataframe(omzet_df, use_container_width=True, hide_index=True)

        kosten_df = pd.DataFrame({
            "Type": ["Variabel", "Vast"],
            "Kosten ($)": [r.variabele_kosten, r.vaste_kosten],
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
        st.metric("Kosten per reiniging", f"$ {r.kosten_per_reiniging:.2f}")
        if r.break_even_reinigingen > 0:
            st.metric(
                "Break-even losse reinigingen/mnd",
                r.break_even_reinigingen,
                help="Minimaal aantal losse reinigingen om vaste kosten te dekken",
            )
        else:
            st.metric("Break-even", "N.v.t.")

# ── UITBREIDING: MEERDERE CLEANERS ────────────────────────────────────────────
st.markdown('<div class="sec-header">Uitbreiding — meerdere cleaners</div>', unsafe_allow_html=True)
st.caption(
    "Lineaire schaling: elke extra cleaner vereist dezelfde investering en genereert dezelfde omzet/kosten. "
    "In de praktijk kunnen vaste overheadkosten gedeeld worden."
)

max_cl = st.slider("Max. aantal cleaners", 2, 10, 5, key="max_cleaners")

# Scenario selector
scenario_namen = [s.naam for s, _ in resultaten]
gekozen = st.selectbox("Toon uitbreiding voor scenario", scenario_namen)
gekozen_s = next(s for s, _ in resultaten if s.naam == gekozen)

schaal = schaal_resultaten(gekozen_s, max_cleaners=max_cl)
df_schaal = pd.DataFrame(schaal)

# Format voor weergave
df_schaal_display = df_schaal.copy()
for col in ["Investering ($)", "Winst/maand ($)", "Winst/jaar ($)"]:
    df_schaal_display[col] = df_schaal_display[col].apply(lambda x: f"$ {x:,.0f}")
df_schaal_display["Terugverdien (mnd)"] = df_schaal_display["Terugverdien (mnd)"].apply(
    lambda x: f"{x} mnd" if x is not None else "niet rendabel"
)
st.dataframe(df_schaal_display, use_container_width=True, hide_index=True)

# Grafiek: winst/jaar vs. cleaners
chart_df = df_schaal[["Aantal cleaners", "Winst/jaar ($)"]].set_index("Aantal cleaners")
st.line_chart(chart_df, use_container_width=True, height=260)

# Vergelijking alle scenario's op N cleaners
st.markdown('<div class="sec-header">Jaarwinst per scenario bij N cleaners</div>', unsafe_allow_html=True)

n_comp = st.slider("Aantal cleaners voor vergelijking", 1, max_cl, 3, key="n_comp")
comp_rows = []
for s, r in resultaten:
    winst_jaar = r.netto_winst * 12 * n_comp
    investering = r.totaal_investering * n_comp
    tv = investering / (r.netto_winst * n_comp) if r.netto_winst > 0 else None
    comp_rows.append({
        "Scenario": s.naam,
        f"Investering {n_comp} cleaners ($)": f"$ {investering:,.0f}",
        f"Winst/jaar {n_comp} cleaners ($)": f"$ {winst_jaar:,.0f}",
        "Terugverdientijd": f"{tv:.1f} mnd ({tv/12:.1f} jr)" if tv else "niet rendabel",
    })

st.dataframe(pd.DataFrame(comp_rows), use_container_width=True, hide_index=True)
