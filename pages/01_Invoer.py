import streamlit as st
from models import load_scenarios, save_scenarios, Scenario, upsert_scenario, delete_scenario
from services.calculator import bereken

# ── Styling ─────────────────────────────────────────────────────────────────
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
    margin: 18px 0 6px 0;
    border-radius: 2px;
}
.calc-label {
    color: #555;
    font-size: 13px;
    padding-top: 6px;
}
.calc-value {
    font-weight: 700;
    font-size: 14px;
}
.win { color: #1a7f3c; }
.ver { color: #c0392b; }
</style>
""", unsafe_allow_html=True)

# ── Scenarios laden ──────────────────────────────────────────────────────────
scenarios = load_scenarios()

# ── Header ──────────────────────────────────────────────────────────────────
h1, h2 = st.columns([3, 1])
with h1:
    st.title("Garbage Can Bonaire")
    st.caption("Business feasibility calculator — 1 garbage cleaner")
with h2:
    st.write("")
    if st.button("Scenario toevoegen", use_container_width=True):
        n = len(scenarios) + 1
        nieuw = Scenario(naam=f"Scenario {n}")
        upsert_scenario(nieuw)
        st.rerun()

if not scenarios:
    st.info("Klik op 'Scenario toevoegen' om te beginnen.")
    st.stop()

n = len(scenarios)
col_w = [1.6] + [1.2] * n
cols = st.columns(col_w)

# ── Grid helpers ─────────────────────────────────────────────────────────────
def sec(label: str):
    st.markdown(f'<div class="sec-header">{label}</div>', unsafe_allow_html=True)

def lbl(text: str, sub: str = ""):
    if sub:
        st.caption(sub)
    else:
        st.write(text)

def calc(val: str, kleur: str = ""):
    st.markdown(f'<div class="calc-value {kleur}">{val}</div>', unsafe_allow_html=True)

# ── Collect widget values for save ───────────────────────────────────────────
widget_vals = {}

# ── NAMEN ────────────────────────────────────────────────────────────────────
cols = st.columns(col_w)
with cols[0]:
    st.write("")
for i, s in enumerate(scenarios):
    with cols[i + 1]:
        widget_vals[f"naam_{i}"] = st.text_input(
            "Scenario naam", value=s.naam, key=f"naam_{s.id}", label_visibility="collapsed"
        )
        if n > 1:
            if st.button("Verwijder", key=f"del_{s.id}", use_container_width=True):
                delete_scenario(s.id)
                st.rerun()

# ── INVESTERING ───────────────────────────────────────────────────────────────
cols = st.columns(col_w)
with cols[0]:
    st.markdown('<div class="sec-header">Investering (eenmalig)</div>', unsafe_allow_html=True)
    st.caption("Aanschaf apparatuur, materiaal, registratie")
for i, s in enumerate(scenarios):
    with cols[i + 1]:
        st.markdown('<div class="sec-header">&nbsp;</div>', unsafe_allow_html=True)
        widget_vals[f"inv_{i}"] = st.number_input(
            "Investering ($)", value=float(s.investering_totaal),
            min_value=0.0, step=500.0, format="%.0f",
            key=f"inv_{s.id}", label_visibility="collapsed"
        )

# ── KOSTEN PER REINIGING ──────────────────────────────────────────────────────
st.markdown('<div class="sec-header">Kosten per reiniging</div>', unsafe_allow_html=True)

for veld, label, sub in [
    ("water", "Water", "verbruik per beurt"),
    ("arbeid", "Arbeid", "loon per beurt"),
    ("overig", "Overig", "middelen, slijtage"),
]:
    cols = st.columns(col_w)
    with cols[0]:
        st.write(label)
        st.caption(sub)
    for i, s in enumerate(scenarios):
        with cols[i + 1]:
            default = {
                "water": s.water_per_reiniging,
                "arbeid": s.arbeid_per_reiniging,
                "overig": s.overig_per_reiniging,
            }[veld]
            widget_vals[f"{veld}_{i}"] = st.number_input(
                label, value=float(default), min_value=0.0,
                step=0.25, format="%.2f",
                key=f"{veld}_{s.id}", label_visibility="collapsed"
            )

# Berekend totaal per reiniging
cols = st.columns(col_w)
with cols[0]:
    st.markdown('<span class="calc-label">Totaal per reiniging</span>', unsafe_allow_html=True)
for i, s in enumerate(scenarios):
    with cols[i + 1]:
        totaal_job = (
            widget_vals[f"water_{i}"] +
            widget_vals[f"arbeid_{i}"] +
            widget_vals[f"overig_{i}"]
        )
        calc(f"$ {totaal_job:.2f}")

# ── VASTE MAANDKOSTEN ─────────────────────────────────────────────────────────
st.markdown('<div class="sec-header">Vaste maandkosten</div>', unsafe_allow_html=True)
cols = st.columns(col_w)
with cols[0]:
    st.write("Vaste kosten per maand")
    st.caption("telefoon, brandstof, admin, etc.")
for i, s in enumerate(scenarios):
    with cols[i + 1]:
        widget_vals[f"vast_{i}"] = st.number_input(
            "Vaste kosten", value=float(s.vaste_kosten_totaal),
            min_value=0.0, step=10.0, format="%.2f",
            key=f"vast_{s.id}", label_visibility="collapsed"
        )

# ── PRIJSSTELLING ─────────────────────────────────────────────────────────────
st.markdown('<div class="sec-header">Prijsstelling</div>', unsafe_allow_html=True)

for veld, label, sub in [
    ("prijs_los", "Losse reiniging", "per beurt"),
    ("prijs_wk", "Wekelijks abonnement", "per maand — 4 beurten"),
    ("prijs_mnd", "Maandelijks abonnement", "per maand — 1 beurt"),
]:
    cols = st.columns(col_w)
    with cols[0]:
        st.write(label)
        st.caption(sub)
    for i, s in enumerate(scenarios):
        with cols[i + 1]:
            default = {
                "prijs_los": s.prijs_los,
                "prijs_wk": s.prijs_wekelijks_abo,
                "prijs_mnd": s.prijs_maandelijks_abo,
            }[veld]
            widget_vals[f"{veld}_{i}"] = st.number_input(
                label, value=float(default), min_value=0.0,
                step=1.0, format="%.2f",
                key=f"{veld}_{s.id}", label_visibility="collapsed"
            )

# Marge losse reiniging
cols = st.columns(col_w)
with cols[0]:
    st.markdown('<span class="calc-label">Marge losse reiniging</span>', unsafe_allow_html=True)
for i in range(n):
    with cols[i + 1]:
        marge = widget_vals[f"prijs_los_{i}"] - (
            widget_vals[f"water_{i}"] + widget_vals[f"arbeid_{i}"] + widget_vals[f"overig_{i}"]
        )
        kleur = "win" if marge > 0 else "ver"
        calc(f"$ {marge:.2f}", kleur)

# ── KLANTEN PER MAAND ─────────────────────────────────────────────────────────
st.markdown('<div class="sec-header">Klanten per maand</div>', unsafe_allow_html=True)

for veld, label, sub in [
    ("klant_los", "Losse opdrachten", "eenmalige klanten"),
    ("klant_wk", "Wekelijkse abonnees", "x 4 beurten/maand"),
    ("klant_mnd", "Maandelijkse abonnees", "x 1 beurt/maand"),
]:
    cols = st.columns(col_w)
    with cols[0]:
        st.write(label)
        st.caption(sub)
    for i, s in enumerate(scenarios):
        with cols[i + 1]:
            default = {
                "klant_los": s.losse_reinigingen,
                "klant_wk": s.wekelijkse_abonnees,
                "klant_mnd": s.maandelijkse_abonnees,
            }[veld]
            widget_vals[f"{veld}_{i}"] = int(st.number_input(
                label, value=int(default), min_value=0, step=1,
                key=f"{veld}_{s.id}", label_visibility="collapsed"
            ))

# Totaal reinigingen
cols = st.columns(col_w)
with cols[0]:
    st.markdown('<span class="calc-label">Totaal reinigingen/maand</span>', unsafe_allow_html=True)
for i in range(n):
    with cols[i + 1]:
        tot = widget_vals[f"klant_los_{i}"] + widget_vals[f"klant_wk_{i}"] * 4 + widget_vals[f"klant_mnd_{i}"]
        calc(str(tot))

# ── SNEL OVERZICHT ────────────────────────────────────────────────────────────
st.markdown('<div class="sec-header">Maandoverzicht</div>', unsafe_allow_html=True)

# Build live scenario objects from current widget values for live preview
live = []
for i, s in enumerate(scenarios):
    ls = Scenario(
        id=s.id,
        naam=widget_vals[f"naam_{i}"],
        water_per_reiniging=widget_vals[f"water_{i}"],
        arbeid_per_reiniging=widget_vals[f"arbeid_{i}"],
        overig_per_reiniging=widget_vals[f"overig_{i}"],
        prijs_los=widget_vals[f"prijs_los_{i}"],
        prijs_wekelijks_abo=widget_vals[f"prijs_wk_{i}"],
        prijs_maandelijks_abo=widget_vals[f"prijs_mnd_{i}"],
        losse_reinigingen=widget_vals[f"klant_los_{i}"],
        wekelijkse_abonnees=widget_vals[f"klant_wk_{i}"],
        maandelijkse_abonnees=widget_vals[f"klant_mnd_{i}"],
    )
    ls.set_investering(widget_vals[f"inv_{i}"])
    ls.set_vaste_kosten(widget_vals[f"vast_{i}"])
    live.append(ls)

for label, getter, kleur_fn in [
    ("Maandomzet", lambda r: f"$ {r.totaal_omzet:,.2f}", lambda r: ""),
    ("Maandkosten", lambda r: f"$ {r.totaal_kosten:,.2f}", lambda r: ""),
    ("Netto winst/maand", lambda r: f"$ {r.netto_winst:,.2f}", lambda r: "win" if r.netto_winst > 0 else "ver"),
    ("Terugverdientijd", lambda r: f"{r.terugverdien_maanden:.1f} mnd / {r.terugverdien_jaren:.1f} jr" if r.terugverdien_maanden else "niet rendabel", lambda r: "" if r.terugverdien_maanden else "ver"),
]:
    cols = st.columns(col_w)
    with cols[0]:
        st.markdown(f'<span class="calc-label">{label}</span>', unsafe_allow_html=True)
    for i, ls in enumerate(live):
        with cols[i + 1]:
            r = bereken(ls)
            calc(getter(r), kleur_fn(r))

# ── OPSLAAN ───────────────────────────────────────────────────────────────────
st.write("")
cols = st.columns(col_w)
with cols[0]:
    save = st.button("Opslaan", type="primary", use_container_width=True)

if save:
    for i, s in enumerate(scenarios):
        s.naam = widget_vals[f"naam_{i}"]
        s.water_per_reiniging = widget_vals[f"water_{i}"]
        s.arbeid_per_reiniging = widget_vals[f"arbeid_{i}"]
        s.overig_per_reiniging = widget_vals[f"overig_{i}"]
        s.prijs_los = widget_vals[f"prijs_los_{i}"]
        s.prijs_wekelijks_abo = widget_vals[f"prijs_wk_{i}"]
        s.prijs_maandelijks_abo = widget_vals[f"prijs_mnd_{i}"]
        s.losse_reinigingen = widget_vals[f"klant_los_{i}"]
        s.wekelijkse_abonnees = widget_vals[f"klant_wk_{i}"]
        s.maandelijkse_abonnees = widget_vals[f"klant_mnd_{i}"]
        s.set_investering(widget_vals[f"inv_{i}"])
        s.set_vaste_kosten(widget_vals[f"vast_{i}"])
    save_scenarios(scenarios)
    st.success("Opgeslagen.")
