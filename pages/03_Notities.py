import streamlit as st
from services.notes_store import load_notes, upsert_note, delete_note, Notitie

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
    margin: 18px 0 8px 0;
    border-radius: 2px;
}
.notitie-card {
    border: 1px solid #dde2e8;
    border-radius: 4px;
    padding: 12px 16px;
    margin-bottom: 10px;
    background: #fafbfc;
}
.cat-tag {
    display: inline-block;
    background: #e8ecf0;
    color: #3a4a5a;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 10px;
    margin-bottom: 6px;
}
</style>
""", unsafe_allow_html=True)

CATEGORIEEN = ["Algemeen", "Investeringen", "Prijsstelling", "Marketing", "Klanten", "Operationeel", "Vragen"]

st.title("Kliko Cleaning Bonaire — Notities")
st.caption("Brainstorm, ideeen, vragen en aantekeningen")

notes = load_notes()

# ── Nieuwe notitie ────────────────────────────────────────────────────────────
st.markdown('<div class="sec-header">Nieuwe notitie</div>', unsafe_allow_html=True)

with st.form("nieuwe_notitie", clear_on_submit=True):
    c1, c2 = st.columns([3, 1])
    with c1:
        titel = st.text_input("Titel", placeholder="Korte omschrijving")
    with c2:
        categorie = st.selectbox("Categorie", CATEGORIEEN)
    inhoud = st.text_area("Notitie", placeholder="Schrijf hier je idee, vraag of aantekening...", height=120)
    opslaan = st.form_submit_button("Toevoegen", type="primary")

if opslaan:
    if not titel.strip() and not inhoud.strip():
        st.warning("Vul een titel of inhoud in.")
    else:
        upsert_note(Notitie(titel=titel.strip(), inhoud=inhoud.strip(), categorie=categorie))
        st.rerun()

# ── Filter ────────────────────────────────────────────────────────────────────
if notes:
    st.markdown('<div class="sec-header">Notities</div>', unsafe_allow_html=True)

    beschikbare_cats = ["Alle"] + sorted({n.categorie for n in notes})
    filter_cat = st.segmented_control("Categorie", beschikbare_cats, default="Alle")
    gefilterd = notes if filter_cat == "Alle" else [n for n in notes if n.categorie == filter_cat]

    st.caption(f"{len(gefilterd)} notitie{'s' if len(gefilterd) != 1 else ''}")
    st.write("")

    # ── Notities weergeven ────────────────────────────────────────────────────
    for n in reversed(gefilterd):
        with st.expander(n.titel or "(geen titel)", expanded=False):
            st.markdown(f'<span class="cat-tag">{n.categorie}</span>', unsafe_allow_html=True)

            nieuwe_titel = st.text_input("Titel", value=n.titel, key=f"t_{n.id}")
            nieuwe_cat = st.selectbox("Categorie", CATEGORIEEN,
                                      index=CATEGORIEEN.index(n.categorie) if n.categorie in CATEGORIEEN else 0,
                                      key=f"c_{n.id}")
            nieuwe_inhoud = st.text_area("Notitie", value=n.inhoud, height=150, key=f"i_{n.id}")

            b1, b2 = st.columns([1, 5])
            with b1:
                if st.button("Opslaan", key=f"s_{n.id}", type="primary"):
                    n.titel = nieuwe_titel.strip()
                    n.categorie = nieuwe_cat
                    n.inhoud = nieuwe_inhoud.strip()
                    upsert_note(n)
                    st.rerun()
            with b2:
                if st.button("Verwijder", key=f"d_{n.id}"):
                    delete_note(n.id)
                    st.rerun()
else:
    st.info("Nog geen notities. Voeg er een toe via het formulier hierboven.")
