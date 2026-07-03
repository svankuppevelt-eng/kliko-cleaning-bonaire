from __future__ import annotations
from dataclasses import dataclass
from models import Scenario


@dataclass
class BerekeningResultaat:
    # Investeringen
    totaal_investering: float

    # Maandelijkse omzet
    omzet_los: float
    omzet_wekelijks_abo: float
    omzet_maandelijks_abo: float
    totaal_omzet: float

    # Maandelijkse kosten
    variabele_kosten: float       # water + arbeid + overig per reiniging × aantal
    vaste_kosten: float           # vaste maandkosten
    totaal_kosten: float

    # Winst
    bruto_winst: float
    netto_winst: float            # zelfde als bruto hier (geen belasting berekend)

    # Terugverdientijd
    terugverdien_maanden: float | None   # None als verlieslatend
    terugverdien_jaren: float | None

    # Extra statistieken
    aantal_reinigingen_per_maand: int
    kosten_per_reiniging: float
    break_even_reinigingen: int  # hoeveel reinigingen nodig om quitte te spelen


def bereken(scenario: Scenario) -> BerekeningResultaat:
    totaal_investering = sum(k.bedrag for k in scenario.investeringen)

    # Aantal reinigingen per maand
    reinigingen_los = scenario.losse_reinigingen
    reinigingen_wekelijks = scenario.wekelijkse_abonnees * 4  # ~4 weken per maand
    reinigingen_maandelijks = scenario.maandelijkse_abonnees
    totaal_reinigingen = reinigingen_los + reinigingen_wekelijks + reinigingen_maandelijks

    # Omzet
    omzet_los = reinigingen_los * scenario.prijs_los
    omzet_wekelijks = scenario.wekelijkse_abonnees * scenario.prijs_wekelijks_abo
    omzet_maandelijks = scenario.maandelijkse_abonnees * scenario.prijs_maandelijks_abo
    totaal_omzet = omzet_los + omzet_wekelijks + omzet_maandelijks

    # Variabele kosten
    kosten_per_reiniging = (
        scenario.water_per_reiniging
        + scenario.arbeid_per_reiniging
        + scenario.overig_per_reiniging
    )
    variabele_kosten = totaal_reinigingen * kosten_per_reiniging

    # Vaste kosten
    vaste_kosten = sum(k.bedrag for k in scenario.vaste_maandkosten)

    totaal_kosten = variabele_kosten + vaste_kosten
    netto_winst = totaal_omzet - totaal_kosten

    # Terugverdientijd
    if netto_winst > 0:
        terugverdien_maanden = totaal_investering / netto_winst
        terugverdien_jaren = terugverdien_maanden / 12
    else:
        terugverdien_maanden = None
        terugverdien_jaren = None

    # Break-even: hoeveel losse reinigingen om vaste kosten te dekken (bij 0 abonnees)
    marge_per_reiniging = scenario.prijs_los - kosten_per_reiniging
    if marge_per_reiniging > 0:
        break_even = int((vaste_kosten / marge_per_reiniging) + 0.999)
    else:
        break_even = -1

    return BerekeningResultaat(
        totaal_investering=totaal_investering,
        omzet_los=omzet_los,
        omzet_wekelijks_abo=omzet_wekelijks,
        omzet_maandelijks_abo=omzet_maandelijks,
        totaal_omzet=totaal_omzet,
        variabele_kosten=variabele_kosten,
        vaste_kosten=vaste_kosten,
        totaal_kosten=totaal_kosten,
        bruto_winst=netto_winst,
        netto_winst=netto_winst,
        terugverdien_maanden=terugverdien_maanden,
        terugverdien_jaren=terugverdien_jaren,
        aantal_reinigingen_per_maand=totaal_reinigingen,
        kosten_per_reiniging=kosten_per_reiniging,
        break_even_reinigingen=break_even,
    )


def projecteer_cumulatief(scenario: Scenario, maanden: int = 36) -> list[dict]:
    """Geeft maand-voor-maand cumulatieve winst/verlies terug (na investering)."""
    totaal_investering = sum(k.bedrag for k in scenario.investeringen)
    res = bereken(scenario)

    punten = []
    cumulatief = -totaal_investering
    for m in range(1, maanden + 1):
        cumulatief += res.netto_winst
        punten.append({"maand": m, "cumulatief": round(cumulatief, 2)})
    return punten
