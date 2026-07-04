import streamlit as st
from models import load_scenarios, save_scenarios, Scenario, upsert_scenario, delete_scenario
from services.calculator import bereken

st.markdown("""
<style>
.block-container { padding-top: 1.5rem; }
.sec-header {
    background: #1e2d3d; color: #ffffff;
    padding: 4px 12px; font-size: 10px; font-weight: 700;
    letter-spacing: 2px; text-transform: uppercase;
    margin: 22px 0 8px 0; border-radius: 2px;
}
.sec-sub {
    background: #3a5068; color: #ffffff;
    padding: 3px 12px; font-size: 10px; font-weight: 600;
    letter-spacing: 1px; text-transform: uppercase;
    margin: 10px 0 4px 0; border-radius: 2px;
}
.calc-label { color: #555; font-size: 13px; padding-top: 6px; }
.calc-value { font-weight: 700; font-size: 14px; }
.win { color: #1a7f3c; }
.ver { color: #c0392b; }
.warn { color: #e67e22; }
</style>
""", unsafe_allow_html=True)

scenarios = load_scenarios()

h1, h2 = st.columns([3, 1])
with h1:
    st.title("Kliko Cleaning Bonaire")
    st.caption("Business feasibility calculator — 1 kliko cleaner")
with h2:
    st.write("")
    if st.button("Scenario toevoegen", use_container_width=True):
        upsert_scenario(Scenario(naam=f"Scenario {len(scenarios) + 1}"))
        st.rerun()

if not scenarios:
    st.info("Klik op 'Scenario toevoegen' om te beginnen.")
    st.stop()

ref = scenarios[0]
n = len(scenarios)
col_w = [1.6] + [1.2] * n

def sec(label):
    st.markdown(f'<div class="sec-header">{label}</div>', unsafe_allow_html=True)

def calc(val, kleur=""):
    st.markdown(f'<div class="calc-value {kleur}">{val}</div>', unsafe_allow_html=True)

w = {}

# ═══════════════════════════════════════════════════════════════════════════════
# GEDEELDE PARAMETERS
# ═══════════════════════════════════════════════════════════════════════════════

left, right = st.columns([1, 1], gap="large")

with left:
    st.markdown('<div class="sec-header">Investering (eenmalig)</div>', unsafe_allow_html=True)
    w["inv"] = st.number_input(
        "Totale investering ($)", value=float(ref.investering_totaal),
        min_value=0.0, step=500.0, format="%.0f",
        help="Aanschaf apparatuur, materiaal, registratie"
    )

    st.markdown('<div class="sec-header">Personeel</div>', unsafe_allow_html=True)
    w["personeel"] = st.number_input(
        "Salaris cleaner per maand ($)", value=float(ref.personeel_mnd),
        min_value=0.0, step=100.0, format="%.0f",
        help="Vast maandsalaris — 1 persoon"
    )
    cap_dag_col, cap_dag_label = st.columns([1, 2])
    with cap_dag_col:
        w["cap_dag"] = int(st.number_input(
            "Containers/dag", value=int(ref.containers_per_dag),
            min_value=1, step=5, key="cap_dag"
        ))
    with cap_dag_label:
        w["werkdagen"] = int(st.number_input(
            "Werkdagen/mnd", value=int(ref.werkdagen_per_mnd),
            min_value=1, step=1, key="werkdagen"
        ))
    cap_mnd = w["cap_dag"] * w["werkdagen"]
    st.markdown(f'<div class="calc-value">Capaciteit: {cap_mnd} reinigingen/mnd</div>', unsafe_allow_html=True)

    st.markdown('<div class="sec-header">Variabele kosten per reiniging</div>', unsafe_allow_html=True)
    w["water"]  = st.number_input("Water ($)",  value=float(ref.water_per_reiniging),  min_value=0.0, step=0.10, format="%.2f")
    w["overig"] = st.number_input("Overig ($)", value=float(ref.overig_per_reiniging), min_value=0.0, step=0.25, format="%.2f", help="Reinigingsmiddel, slijtage")
    kosten_per_job = w["water"] + w["overig"]
    st.markdown(f'<div class="calc-value">Totaal: $ {kosten_per_job:.2f} per reiniging</div>', unsafe_allow_html=True)

    st.markdown('<div class="sec-header">Overige vaste maandkosten</div>', unsafe_allow_html=True)
    w["vast"] = st.number_input(
        "Overige vaste kosten per maand ($)", value=float(ref.vaste_kosten_totaal),
        min_value=0.0, step=10.0, format="%.2f",
        help="Brandstof, telefoon, administratie, etc. — excl. personeel"
    )
    totaal_vast = w["personeel"] + w["vast"]
    st.markdown(f'<div class="calc-value">Totaal vast/mnd (incl. personeel): $ {totaal_vast:,.0f}</div>', unsafe_allow_html=True)

with right:
    st.markdown('<div class="sec-header">Abonnementsprijzen (per maand per container)</div>', unsafe_allow_html=True)
    st.caption("Popcorn-principe: 4x/mnd is licht duurder dan 2x/mnd → mensen kiezen vanzelf het beste pakket.")

    header_cols = st.columns([2.2, 2, 1.4, 1.4])
    header_cols[0].caption("Abonnement")
    header_cols[1].caption("Prijs/maand ($)")
    header_cols[2].caption("Per reiniging")
    header_cols[3].caption("Marge")

    ABOS = [
        ("klein_1",   "Kleine container — 1x/mnd",   "prijs_klein_1",   1),
        ("klein_2",   "Kleine container — 2x/mnd",   "prijs_klein_2",   2),
        ("klein_4",   "Kleine container — 4x/mnd",   "prijs_klein_4",   4),
        ("bedrijf_1", "Bedrijfscontainer — 1x/mnd",  "prijs_bedrijf_1", 1),
        ("bedrijf_2", "Bedrijfscontainer — 2x/mnd",  "prijs_bedrijf_2", 2),
        ("bedrijf_4", "Bedrijfscontainer — 4x/mnd",  "prijs_bedrijf_4", 4),
    ]

    for veld, label, attr, freq in ABOS:
        rc = st.columns([2.2, 2, 1.4, 1.4])
        with rc[0]:
            st.write(label)
        with rc[1]:
            w[f"p_{veld}"] = st.number_input(
                label, value=float(getattr(ref, attr)),
                min_value=0.0, step=1.0, format="%.2f",
                key=f"p_{veld}", label_visibility="collapsed"
            )
        with rc[2]:
            per_r = w[f"p_{veld}"] / freq
            st.markdown(f'<div class="calc-value">$ {per_r:.2f}</div>', unsafe_allow_html=True)
        with rc[3]:
            m = per_r - kosten_per_job
            kleur = "win" if m > 0 else "ver"
            st.markdown(f'<div class="calc-value {kleur}">$ {m:.2f}</div>', unsafe_allow_html=True)

st.divider()

# ═══════════════════════════════════════════════════════════════════════════════
# SCENARIO'S — klantaantallen
# ═══════════════════════════════════════════════════════════════════════════════

sec("Scenario's — klanten per abonnement")

cols = st.columns(col_w)
with cols[0]:
    st.write("")
for i, s in enumerate(scenarios):
    with cols[i + 1]:
        w[f"naam_{i}"] = st.text_input("Naam", value=s.naam, key=f"naam_{s.id}", label_visibility="collapsed")
        if n > 1:
            if st.button("Verwijder", key=f"del_{s.id}", use_container_width=True):
                delete_scenario(s.id)
                st.rerun()

KLANT_VELDEN = [
    ("klein_1",   "Kleine container — 1x/mnd",  "klant_klein_1",   1),
    ("klein_2",   "Kleine container — 2x/mnd",  "klant_klein_2",   2),
    ("klein_4",   "Kleine container — 4x/mnd",  "klant_klein_4",   4),
    ("bedrijf_1", "Bedrijfscontainer — 1x/mnd", "klant_bedrijf_1", 1),
    ("bedrijf_2", "Bedrijfscontainer — 2x/mnd", "klant_bedrijf_2", 2),
    ("bedrijf_4", "Bedrijfscontainer — 4x/mnd", "klant_bedrijf_4", 4),
]

for veld, label, attr, freq in KLANT_VELDEN:
    cols = st.columns(col_w)
    with cols[0]:
        st.write(label)
    for i, s in enumerate(scenarios):
        with cols[i + 1]:
            w[f"k{veld}_{i}"] = int(st.number_input(
                label, value=int(getattr(s, attr)), min_value=0, step=1,
                key=f"k{veld}_{s.id}", label_visibility="collapsed"
            ))

# Totalen
cols = st.columns(col_w)
with cols[0]:
    st.markdown('<span class="calc-label">Totaal klanten</span>', unsafe_allow_html=True)
for i in range(n):
    with cols[i + 1]:
        tot = sum(w[f"k{v}_{i}"] for v, _, __, ___ in KLANT_VELDEN)
        calc(str(tot))

cols = st.columns(col_w)
with cols[0]:
    st.markdown('<span class="calc-label">Reinigingen/maand</span>', unsafe_allow_html=True)
for i in range(n):
    with cols[i + 1]:
        r_tot = sum(w[f"k{v}_{i}"] * freq for v, _, __, freq in KLANT_VELDEN)
        bezet = r_tot / cap_mnd if cap_mnd > 0 else 0
        kleur = "ver" if bezet > 1.0 else ("warn" if bezet > 0.85 else "")
        calc(f"{r_tot} ({bezet:.0%})", kleur)

# ── Maandoverzicht ────────────────────────────────────────────────────────────
sec("Maandoverzicht")

live = []
for i, s in enumerate(scenarios):
    ls = Scenario(
        id=s.id, naam=w[f"naam_{i}"],
        water_per_reiniging=w["water"],
        overig_per_reiniging=w["overig"],
        personeel_mnd=w["personeel"],
        containers_per_dag=w["cap_dag"],
        werkdagen_per_mnd=w["werkdagen"],
        prijs_klein_1=w["p_klein_1"], prijs_klein_2=w["p_klein_2"], prijs_klein_4=w["p_klein_4"],
        prijs_bedrijf_1=w["p_bedrijf_1"], prijs_bedrijf_2=w["p_bedrijf_2"], prijs_bedrijf_4=w["p_bedrijf_4"],
        klant_klein_1=w[f"kklein_1_{i}"], klant_klein_2=w[f"kklein_2_{i}"], klant_klein_4=w[f"kklein_4_{i}"],
        klant_bedrijf_1=w[f"kbedrijf_1_{i}"], klant_bedrijf_2=w[f"kbedrijf_2_{i}"], klant_bedrijf_4=w[f"kbedrijf_4_{i}"],
    )
    ls.set_investering(w["inv"])
    ls.set_vaste_kosten(w["vast"])
    live.append(ls)

for label, getter, kleur_fn in [
    ("Maandomzet",       lambda r: f"$ {r.totaal_omzet:,.2f}",    lambda r: ""),
    ("Personeel",        lambda r: f"$ {r.personeel_kosten:,.0f}", lambda r: ""),
    ("Overige vast",     lambda r: f"$ {r.overige_vaste_kosten:,.2f}", lambda r: ""),
    ("Variabele kosten", lambda r: f"$ {r.variabele_kosten:,.2f}", lambda r: ""),
    ("Totaal kosten",    lambda r: f"$ {r.totaal_kosten:,.2f}",    lambda r: ""),
    ("Netto winst/mnd",  lambda r: f"$ {r.netto_winst:,.2f}",      lambda r: "win" if r.netto_winst > 0 else "ver"),
    ("Terugverdientijd",
        lambda r: f"{r.terugverdien_maanden:.1f} mnd  ({r.terugverdien_jaren:.1f} jr)" if r.terugverdien_maanden else "niet rendabel",
        lambda r: "" if r.terugverdien_maanden else "ver"),
]:
    cols = st.columns(col_w)
    with cols[0]:
        st.markdown(f'<span class="calc-label">{label}</span>', unsafe_allow_html=True)
    for i, ls in enumerate(live):
        with cols[i + 1]:
            r = bereken(ls)
            calc(getter(r), kleur_fn(r))

# ── Opslaan ───────────────────────────────────────────────────────────────────
st.write("")
cols = st.columns(col_w)
with cols[0]:
    save = st.button("Opslaan", type="primary", use_container_width=True)

if save:
    for i, s in enumerate(scenarios):
        s.naam                  = w[f"naam_{i}"]
        s.water_per_reiniging   = w["water"]
        s.overig_per_reiniging  = w["overig"]
        s.personeel_mnd         = w["personeel"]
        s.containers_per_dag    = w["cap_dag"]
        s.werkdagen_per_mnd     = w["werkdagen"]
        s.prijs_klein_1   = w["p_klein_1"]
        s.prijs_klein_2   = w["p_klein_2"]
        s.prijs_klein_4   = w["p_klein_4"]
        s.prijs_bedrijf_1 = w["p_bedrijf_1"]
        s.prijs_bedrijf_2 = w["p_bedrijf_2"]
        s.prijs_bedrijf_4 = w["p_bedrijf_4"]
        s.klant_klein_1   = w[f"kklein_1_{i}"]
        s.klant_klein_2   = w[f"kklein_2_{i}"]
        s.klant_klein_4   = w[f"kklein_4_{i}"]
        s.klant_bedrijf_1 = w[f"kbedrijf_1_{i}"]
        s.klant_bedrijf_2 = w[f"kbedrijf_2_{i}"]
        s.klant_bedrijf_4 = w[f"kbedrijf_4_{i}"]
        s.set_investering(w["inv"])
        s.set_vaste_kosten(w["vast"])
    save_scenarios(scenarios)
    st.success("Opgeslagen.")
