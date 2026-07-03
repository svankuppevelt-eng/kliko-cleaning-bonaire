from __future__ import annotations
from dataclasses import dataclass
from models import Scenario


@dataclass
class Resultaat:
    totaal_investering: float
    omzet_los: float
    omzet_wekelijks: float
    omzet_maandelijks: float
    totaal_omzet: float
    variabele_kosten: float
    vaste_kosten: float
    totaal_kosten: float
    netto_winst: float
    terugverdien_maanden: float | None
    terugverdien_jaren: float | None
    aantal_reinigingen: int
    kosten_per_reiniging: float
    break_even_reinigingen: int


def bereken(s: Scenario) -> Resultaat:
    investering = s.investering_totaal

    reinigingen_los = s.losse_reinigingen
    reinigingen_wk = s.wekelijkse_abonnees * 4
    reinigingen_mnd = s.maandelijkse_abonnees
    totaal_reinigingen = reinigingen_los + reinigingen_wk + reinigingen_mnd

    omzet_los = reinigingen_los * s.prijs_los
    omzet_wk = s.wekelijkse_abonnees * s.prijs_wekelijks_abo
    omzet_mnd = s.maandelijkse_abonnees * s.prijs_maandelijks_abo
    totaal_omzet = omzet_los + omzet_wk + omzet_mnd

    kosten_per_job = s.water_per_reiniging + s.arbeid_per_reiniging + s.overig_per_reiniging
    variabele_kosten = totaal_reinigingen * kosten_per_job
    vaste_kosten = s.vaste_kosten_totaal
    totaal_kosten = variabele_kosten + vaste_kosten
    netto_winst = totaal_omzet - totaal_kosten

    if netto_winst > 0:
        tv_maanden = investering / netto_winst
        tv_jaren = tv_maanden / 12
    else:
        tv_maanden = None
        tv_jaren = None

    marge_per_job = s.prijs_los - kosten_per_job
    break_even = int((vaste_kosten / marge_per_job) + 0.999) if marge_per_job > 0 else -1

    return Resultaat(
        totaal_investering=investering,
        omzet_los=omzet_los,
        omzet_wekelijks=omzet_wk,
        omzet_maandelijks=omzet_mnd,
        totaal_omzet=totaal_omzet,
        variabele_kosten=variabele_kosten,
        vaste_kosten=vaste_kosten,
        totaal_kosten=totaal_kosten,
        netto_winst=netto_winst,
        terugverdien_maanden=tv_maanden,
        terugverdien_jaren=tv_jaren,
        aantal_reinigingen=totaal_reinigingen,
        kosten_per_reiniging=kosten_per_job,
        break_even_reinigingen=break_even,
    )


def cumulatief(s: Scenario, maanden: int = 48) -> list[dict]:
    r = bereken(s)
    saldo = -r.totaal_investering
    punten = []
    for m in range(1, maanden + 1):
        saldo += r.netto_winst
        punten.append({"Maand": m, s.naam: round(saldo, 2)})
    return punten


def schaal_resultaten(s: Scenario, max_cleaners: int = 6) -> list[dict]:
    """Lineaire schaling: N cleaners = N × alles."""
    r = bereken(s)
    rows = []
    for n in range(1, max_cleaners + 1):
        investering_n = r.totaal_investering * n
        winst_mnd_n = r.netto_winst * n
        winst_jaar_n = winst_mnd_n * 12
        tv = investering_n / winst_mnd_n if winst_mnd_n > 0 else None
        rows.append({
            "Aantal cleaners": n,
            "Investering ($)": round(investering_n, 0),
            "Winst/maand ($)": round(winst_mnd_n, 0),
            "Winst/jaar ($)": round(winst_jaar_n, 0),
            "Terugverdien (mnd)": round(tv, 1) if tv else None,
        })
    return rows
