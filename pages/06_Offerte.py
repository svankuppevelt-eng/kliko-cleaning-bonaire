import streamlit as st
from models import load_scenarios
from services.prijsbeleid_store import load_prijsbeleid

st.markdown("""
<style>
.block-container { padding-top: 1.5rem; }
.sec-header {
    background: #1e2d3d; color: #ffffff;
    padding: 4px 12px; font-size: 10px; font-weight: 700;
    letter-spacing: 2px; text-transform: uppercase;
    margin: 22px 0 8px 0; border-radius: 2px;
}
.offerte-box {
    background: #f8f9fa;
    border: 1px solid #dee2e6;
    border-radius: 6px;
    padding: 20px 24px;
    margin-top: 12px;
}
.offerte-title {
    font-size: 20px; font-weight: 700; color: #1e2d3d;
    border-bottom: 2px solid #1e2d3d; padding-bottom: 8px; margin-bottom: 16px;
}
.offerte-row {
    display: flex; justify-content: space-between;
    padding: 4px 0; font-size: 14px;
}
.offerte-row-label { color: #555; }
.offerte-row-val { font-weight: 600; }
.offerte-subtotal {
    border-top: 1px solid #ccc; margin-top: 8px; padding-top: 8px;
    font-weight: 700; font-size: 15px;
}
.offerte-total {
    background: #1e2d3d; color: white;
    border-radius: 4px; padding: 12px 16px; margin-top: 12px;
    font-size: 16px; font-weight: 700;
}
.offerte-saving {
    background: #e8f5e9; color: #1a7f3c;
    border-radius: 4px; padding: 8px 12px; margin-top: 8px;
    font-weight: 600;
}
.offerte-cadeau {
    background: #fff8e1; border-left: 4px solid #f39c12;
    padding: 8px 12px; margin-top: 8px; border-radius: 2px;
}
.win { color: #1a7f3c; font-weight: 700; }
.ver { color: #c0392b; font-weight: 700; }
</style>
""", unsafe_allow_html=True)

scenarios = load_scenarios()
if not scenarios:
    st.warning("Ga eerst naar Invoer om scenario's met prijzen aan te maken.")
    st.stop()

ref = scenarios[0]
pb = load_prijsbeleid()

st.title("Kliko Cleaning Bonaire — Offerte Tool")
st.caption("Gebruik deze tool tijdens het eerste klantbezoek. Vul de gegevens in en toon de berekening.")

# ── KLANTINFO ────────────────────────────────────────────────────────────────
st.markdown('<div class="sec-header">Klantgegevens</div>', unsafe_allow_html=True)

ki_col1, ki_col2, ki_col3 = st.columns([2, 1.5, 1.5])
with ki_col1:
    klantnaam = st.text_input("Naam / bedrijfsnaam", placeholder="bijv. Hotel Bonaire Breeze")
with ki_col2:
    klanttype = st.radio("Type klant", ["Particulier", "Bedrijf"], horizontal=True)
with ki_col3:
    contractduur = st.radio("Contractduur", ["Maandelijks", "12 maanden (vooruit)"], horizontal=False)

# ── CONTAINERS ────────────────────────────────────────────────────────────────
st.markdown('<div class="sec-header">Containers & Abonnementen</div>', unsafe_allow_html=True)

PRIJZEN = {
    ("klein", 1): ref.prijs_klein_1,
    ("klein", 2): ref.prijs_klein_2,
    ("klein", 4): ref.prijs_klein_4,
    ("bedrijf", 1): ref.prijs_bedrijf_1,
    ("bedrijf", 2): ref.prijs_bedrijf_2,
    ("bedrijf", 4): ref.prijs_bedrijf_4,
}

TYPE_LABELS = {"klein": "Kleine container", "bedrijf": "Bedrijfscontainer"}
FREQ_LABELS = {1: "1x per maand", 2: "2x per maand", 4: "4x per maand"}

if "offerte_containers" not in st.session_state:
    st.session_state.offerte_containers = [{"type": "klein", "freq": 4}]

containers = st.session_state.offerte_containers

add_col, _ = st.columns([1, 3])
with add_col:
    if st.button("+ Container toevoegen"):
        containers.append({"type": "klein", "freq": 4})
        st.rerun()

te_verwijderen = None
for idx, c in enumerate(containers):
    num = idx + 1
    korting_pct = (
        0 if idx == 0
        else pb.korting_2e_container if idx == 1
        else pb.korting_3e_container if idx == 2
        else pb.korting_4e_container
    )
    prijs_basis = PRIJZEN.get((c["type"], c["freq"]), 0.0)
    prijs_na_korting = prijs_basis * (1 - korting_pct / 100)

    with st.container():
        c1, c2, c3, c4, c5 = st.columns([0.3, 1.8, 1.8, 1.6, 0.5])
        with c1:
            st.write(f"**#{num}**")
        with c2:
            type_keuze = st.selectbox(
                "Type", list(TYPE_LABELS.keys()),
                format_func=lambda x: TYPE_LABELS[x],
                index=list(TYPE_LABELS.keys()).index(c["type"]),
                key=f"type_{idx}",
                label_visibility="collapsed"
            )
            containers[idx]["type"] = type_keuze
        with c3:
            freq_options = [1, 2, 4]
            freq_keuze = st.selectbox(
                "Frequentie", freq_options,
                format_func=lambda x: FREQ_LABELS[x],
                index=freq_options.index(c["freq"]) if c["freq"] in freq_options else 2,
                key=f"freq_{idx}",
                label_visibility="collapsed"
            )
            containers[idx]["freq"] = freq_keuze
        with c4:
            if korting_pct > 0:
                st.markdown(
                    f"$ {prijs_basis:.2f}  <span style='color:#1a7f3c'>−{korting_pct:.0f}%</span>"
                    f"  → **$ {prijs_na_korting:.2f}/mnd**",
                    unsafe_allow_html=True
                )
            else:
                st.write(f"**$ {prijs_basis:.2f}/mnd**")
        with c5:
            if len(containers) > 1:
                if st.button("✕", key=f"del_{idx}"):
                    te_verwijderen = idx

if te_verwijderen is not None:
    containers.pop(te_verwijderen)
    st.rerun()

# ── BEREKENING ────────────────────────────────────────────────────────────────
st.markdown('<div class="sec-header">Prijsberekening</div>', unsafe_allow_html=True)

regels = []
for idx, c in enumerate(containers):
    korting_pct = (
        0 if idx == 0
        else pb.korting_2e_container if idx == 1
        else pb.korting_3e_container if idx == 2
        else pb.korting_4e_container
    )
    prijs_basis = PRIJZEN.get((c["type"], c["freq"]), 0.0)
    korting_bedrag = prijs_basis * korting_pct / 100
    prijs_netto = prijs_basis - korting_bedrag
    regels.append({
        "num": idx + 1,
        "type": TYPE_LABELS[c["type"]],
        "freq": FREQ_LABELS[c["freq"]],
        "basis": prijs_basis,
        "korting_pct": korting_pct,
        "korting_bedrag": korting_bedrag,
        "netto": prijs_netto,
    })

subtotaal_per_mnd = sum(r["netto"] for r in regels)
basis_per_mnd     = sum(r["basis"] for r in regels)

jaar_korting_pct    = pb.korting_jaarcontract if contractduur == "12 maanden (vooruit)" else 0.0
jaar_korting_bedrag = subtotaal_per_mnd * jaar_korting_pct / 100
netto_per_mnd       = subtotaal_per_mnd - jaar_korting_bedrag

totaal_jaar = netto_per_mnd * 12
besparing   = (basis_per_mnd - netto_per_mnd) * 12

# Render offerte
naam_display = klantnaam if klantnaam else "(klantnaam)"

lines = []
lines.append(f'<div class="offerte-box">')
lines.append(f'<div class="offerte-title">Kliko Cleaning Bonaire — Aanbieding voor {naam_display}</div>')

for r in regels:
    lines.append(f'<div class="offerte-row">')
    lines.append(f'  <span class="offerte-row-label">Container #{r["num"]}: {r["type"]} — {r["freq"]}</span>')
    lines.append(f'  <span class="offerte-row-val">$ {r["basis"]:.2f}/mnd</span>')
    lines.append(f'</div>')
    if r["korting_pct"] > 0:
        lines.append(f'<div class="offerte-row" style="color:#1a7f3c; padding-left:16px">')
        lines.append(f'  <span>Korting {r["num"]}e container (−{r["korting_pct"]:.0f}%)</span>')
        lines.append(f'  <span>− $ {r["korting_bedrag"]:.2f}</span>')
        lines.append(f'</div>')

if jaar_korting_pct > 0:
    lines.append(f'<div class="offerte-subtotal">')
    lines.append(f'  <div class="offerte-row">')
    lines.append(f'    <span>Subtotaal per maand</span><span>$ {subtotaal_per_mnd:.2f}</span>')
    lines.append(f'  </div>')
    lines.append(f'  <div class="offerte-row" style="color:#1a7f3c">')
    lines.append(f'    <span>Jaarcontractkorting (−{jaar_korting_pct:.0f}%)</span>')
    lines.append(f'    <span>− $ {jaar_korting_bedrag:.2f}/mnd</span>')
    lines.append(f'  </div>')
    lines.append(f'</div>')

lines.append(f'<div class="offerte-total">')
if contractduur == "12 maanden (vooruit)":
    lines.append(f'Totaal per maand: $ {netto_per_mnd:.2f} &nbsp;|&nbsp; Totaal voor 12 maanden: $ {totaal_jaar:.2f}')
else:
    lines.append(f'Maandelijks abonnement: $ {netto_per_mnd:.2f} per maand')
lines.append(f'</div>')

if contractduur == "12 maanden (vooruit)" and besparing > 0:
    lines.append(f'<div class="offerte-saving">U bespaart in totaal $ {besparing:.2f} per jaar ten opzichte van maandelijkse prijs.</div>')

# Cadeaus
cadeaus = [pb.cadeau_welkom]
if contractduur == "12 maanden (vooruit)":
    cadeaus.append(pb.cadeau_jaarcontract)

cad_text = " | ".join(cadeaus)
lines.append(f'<div class="offerte-cadeau"><strong>Welkomstvoordeel:</strong> {cad_text}</div>')

lines.append(f'</div>')

st.markdown("\n".join(lines), unsafe_allow_html=True)

# ── SNEL OVERZICHT ───────────────────────────────────────────────────────────
st.markdown('<div class="sec-header">Snel overzicht</div>', unsafe_allow_html=True)

ov_cols = st.columns(4)
ov_cols[0].metric("Aantal containers", len(regels))
ov_cols[1].metric("Netto per maand", f"$ {netto_per_mnd:.2f}")
if contractduur == "12 maanden (vooruit)":
    ov_cols[2].metric("Totaal per jaar", f"$ {totaal_jaar:.2f}")
    ov_cols[3].metric("Besparing vs. maandelijks", f"$ {besparing:.2f}")
else:
    ov_cols[2].metric("Maandprijs", f"$ {netto_per_mnd:.2f}")
    ov_cols[3].metric("Per jaar (indicatief)", f"$ {netto_per_mnd * 12:.2f}")

# ── VERGELIJKING JAARCONTRACT ─────────────────────────────────────────────────
if contractduur == "Maandelijks":
    st.markdown('<div class="sec-header">Wat levert een jaarcontract op?</div>', unsafe_allow_html=True)
    jaar_prijs = subtotaal_per_mnd * (1 - pb.korting_jaarcontract / 100) * 12
    jaar_besparing = subtotaal_per_mnd * 12 - jaar_prijs
    st.info(
        f"Bij 12-maanden contract betaalt de klant **$ {jaar_prijs:.2f}** voor het hele jaar "
        f"(korting: {pb.korting_jaarcontract:.0f}%). "
        f"Besparing: **$ {jaar_besparing:.2f}** + cadeau: {pb.cadeau_jaarcontract}"
    )
