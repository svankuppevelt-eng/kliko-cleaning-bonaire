import streamlit as st

st.set_page_config(
    page_title="Kliko Cleaning Bonaire",
    page_icon=None,
    layout="wide",
    initial_sidebar_state="expanded",
)

pg = st.navigation([
    st.Page("pages/01_Invoer.py",      title="Invoer",          icon=None),
    st.Page("pages/02_Analyse.py",     title="Analyse",         icon=None),
    st.Page("pages/03_Notities.py",    title="Notities",        icon=None),
    st.Page("pages/04_Markt.py",       title="Marktonderzoek",  icon=None),
    st.Page("pages/05_Prijsbeleid.py", title="Prijsbeleid",     icon=None),
    st.Page("pages/06_Offerte.py",     title="Offerte Tool",    icon=None),
])
pg.run()
