import streamlit as st

st.set_page_config(
    page_title="Garbage Can Bonaire",
    page_icon=None,
    layout="wide",
    initial_sidebar_state="expanded",
)

pg = st.navigation([
    st.Page("pages/01_Invoer.py",  title="Invoer",  icon=None),
    st.Page("pages/02_Analyse.py", title="Analyse", icon=None),
])
pg.run()
