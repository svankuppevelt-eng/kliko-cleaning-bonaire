import streamlit as st

st.set_page_config(
    page_title="Garbage Can Bonaire",
    page_icon="🗑️",
    layout="wide",
    initial_sidebar_state="expanded",
)

pg = st.navigation([
    st.Page("pages/00_Home.py",        title="Dashboard",         icon="🏠"),
    st.Page("pages/01_Scenario.py",    title="Scenario's",        icon="📋"),
    st.Page("pages/02_Investering.py", title="Investering",       icon="💰"),
    st.Page("pages/03_Kosten.py",      title="Kosten per job",    icon="🔧"),
    st.Page("pages/04_Klanten.py",     title="Klanten & Prijs",   icon="👥"),
    st.Page("pages/05_Resultaten.py",  title="Resultaten",        icon="📊"),
    st.Page("pages/06_Vergelijking.py", title="Vergelijking",     icon="⚖️"),
])
pg.run()
