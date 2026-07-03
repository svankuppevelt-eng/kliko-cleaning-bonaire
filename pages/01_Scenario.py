import streamlit as st
from models import load_scenarios, upsert_scenario, delete_scenario, Scenario

st.title("📋 Scenario's beheren")

scenarios = load_scenarios()

# ── Nieuw scenario aanmaken ─────────────────────────────────────────────────
with st.expander("➕ Nieuw scenario aanmaken", expanded=not scenarios):
    naam = st.text_input("Naam", placeholder="bijv. Optimistisch — 20 klanten")
    omschrijving = st.text_area("Omschrijving (optioneel)", placeholder="Korte beschrijving van dit scenario...")
    if st.button("Aanmaken", type="primary"):
        if not naam.strip():
            st.error("Geef het scenario een naam.")
        else:
            s = Scenario(naam=naam.strip(), omschrijving=omschrijving.strip())
            upsert_scenario(s)
            st.success(f"Scenario **{naam}** aangemaakt!")
            st.rerun()

st.divider()

if not scenarios:
    st.info("Nog geen scenario's. Maak er een aan via het formulier hierboven.")
    st.stop()

# ── Bestaande scenario's ────────────────────────────────────────────────────
st.subheader("Bestaande scenario's")

for s in scenarios:
    with st.expander(f"**{s.naam}**", expanded=False):
        col1, col2 = st.columns([3, 1])
        with col1:
            nieuwe_naam = st.text_input("Naam", value=s.naam, key=f"naam_{s.id}")
            nieuwe_omschrijving = st.text_area(
                "Omschrijving", value=s.omschrijving, key=f"omschr_{s.id}"
            )
        with col2:
            st.write("")
            st.write("")
            if st.button("Opslaan", key=f"save_{s.id}", type="primary"):
                s.naam = nieuwe_naam.strip()
                s.omschrijving = nieuwe_omschrijving.strip()
                upsert_scenario(s)
                st.success("Opgeslagen!")
                st.rerun()
            st.write("")
            if st.button("🗑️ Verwijderen", key=f"del_{s.id}"):
                delete_scenario(s.id)
                st.warning(f"Scenario **{s.naam}** verwijderd.")
                st.rerun()

        # Kopieer scenario
        if st.button("Kopieer scenario", key=f"copy_{s.id}"):
            import copy, uuid
            kopie = copy.deepcopy(s)
            kopie.id = str(uuid.uuid4())
            kopie.naam = f"{s.naam} (kopie)"
            upsert_scenario(kopie)
            st.success(f"Kopie aangemaakt: **{kopie.naam}**")
            st.rerun()
