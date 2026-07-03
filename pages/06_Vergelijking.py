import streamlit as st
import pandas as pd
from models import load_scenarios
from services.calculator import bereken

st.title("⚖️ Scenario vergelijking")
st.caption("Vergelijk alle scenario's naast elkaar om te zien welke het meest rendabel is.")

scenarios = load_scenarios()
if len(scenarios) < 2:
    st.info("Maak minimaal 2 scenario's aan om te kunnen vergelijken.")
    st.stop()

# ── Selecteer scenario's ────────────────────────────────────────────────────
alle_namen = [s.naam for s in scenarios]
geselecteerd = st.multiselect(
    "Selecteer scenario's om te vergelijken",
    alle_namen,
    default=alle_namen[:min(4, len(alle_namen))],
)

if not geselecteerd:
    st.warning("Selecteer minimaal 1 scenario.")
    st.stop()

sel_scenarios = [s for s in scenarios if s.naam in geselecteerd]

# ── Vergelijkingstabel ──────────────────────────────────────────────────────
st.divider()
st.subheader("Vergelijkingstabel")

rows = []
for s in sel_scenarios:
    r = bereken(s)
    rows.append({
        "Scenario": s.naam,
        "Investering ($)": round(r.totaal_investering, 2),
        "Maandomzet ($)": round(r.totaal_omzet, 2),
        "Maandkosten ($)": round(r.totaal_kosten, 2),
        "Netto winst/mnd ($)": round(r.netto_winst, 2),
        "Jaarwinst ($)": round(r.netto_winst * 12, 2),
        "Terugverdien (mnd)": round(r.terugverdien_maanden, 1) if r.terugverdien_maanden else "N.v.t.",
        "Reinigingen/mnd": r.aantal_reinigingen_per_maand,
        "Rendabel": "✅" if r.netto_winst > 0 else "❌",
    })

df = pd.DataFrame(rows)
st.dataframe(df, use_container_width=True, hide_index=True)

# ── Grafieken ───────────────────────────────────────────────────────────────
st.divider()
st.subheader("Maandelijkse netto winst per scenario")

winst_data = {s["Scenario"]: s["Netto winst/mnd ($)"] for s in rows}
df_winst = pd.DataFrame.from_dict(winst_data, orient="index", columns=["Netto winst ($)"])
st.bar_chart(df_winst, use_container_width=True)

st.subheader("Terugverdientijd (maanden)")
terugverdien_data = {}
for s in rows:
    tv = s["Terugverdien (mnd)"]
    if tv != "N.v.t.":
        terugverdien_data[s["Scenario"]] = tv

if terugverdien_data:
    df_tv = pd.DataFrame.from_dict(terugverdien_data, orient="index", columns=["Maanden"])
    st.bar_chart(df_tv, use_container_width=True)
else:
    st.info("Geen van de geselecteerde scenario's is rendabel.")

# ── Beste keuze ─────────────────────────────────────────────────────────────
st.divider()
rendabele = [r for r in rows if r["Rendabel"] == "✅"]
if rendabele:
    beste_winst = max(rendabele, key=lambda x: x["Netto winst/mnd ($)"])
    snelste_tv = min(
        [r for r in rendabele if r["Terugverdien (mnd)"] != "N.v.t."],
        key=lambda x: x["Terugverdien (mnd)"],
        default=None,
    )
    st.success(f"**Hoogste maandwinst:** {beste_winst['Scenario']} — $ {beste_winst['Netto winst/mnd ($)']:,.2f}/maand")
    if snelste_tv:
        st.info(f"**Snelste terugverdientijd:** {snelste_tv['Scenario']} — {snelste_tv['Terugverdien (mnd)']} maanden")
else:
    st.error("Geen van de geselecteerde scenario's is rendabel. Pas de parameters aan.")
