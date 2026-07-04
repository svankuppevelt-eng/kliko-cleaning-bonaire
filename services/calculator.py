from __future__ import annotations
from dataclasses import dataclass
from models import Scenario


@dataclass
class Resultaat:
    totaal_investering: float

    # Omzet per abonnementsvorm (6 opties: 2 types × 3 frequenties)
    omzet_klein_1: float
    omzet_klein_2: float
    omzet_klein_4: float
    omzet_bedrijf_1: float
    omzet_bedrijf_2: float
    omzet_bedrijf_4: float
    totaal_omzet: float

    # Reinigingen per maand
    reinigingen_klein: int
    reinigingen_bedrijf: int
    totaal_reinigingen: int
    totaal_klanten: int
    capaciteit_mnd: int
    capaciteit_benut: float  # 0.0 – 1.0

    variabele_kosten: float
    personeel_kosten: float
    overige_vaste_kosten: float
    vaste_kosten: float   # personeel + overige
    totaal_kosten: float
    netto_winst: float

    kosten_per_reiniging: float
    gem_opbrengst_per_reiniging: float

    terugverdien_maanden: float | None
    terugverdien_jaren: float | None

    break_even_klanten_mnd1: int  # min. klanten (klein 1x) om kosten te dekken


def bereken(s: Scenario) -> Resultaat:
    investering = s.investering_totaal
    capaciteit = s.capaciteit_per_mnd

    # Reinigingen: freq × klanten
    r_klein_1   = s.klant_klein_1   * 1
    r_klein_2   = s.klant_klein_2   * 2
    r_klein_4   = s.klant_klein_4   * 4
    r_bedrijf_1 = s.klant_bedrijf_1 * 1
    r_bedrijf_2 = s.klant_bedrijf_2 * 2
    r_bedrijf_4 = s.klant_bedrijf_4 * 4

    reinigingen_klein   = r_klein_1   + r_klein_2   + r_klein_4
    reinigingen_bedrijf = r_bedrijf_1 + r_bedrijf_2 + r_bedrijf_4
    totaal_reinigingen  = reinigingen_klein + reinigingen_bedrijf
    totaal_klanten = (
        s.klant_klein_1 + s.klant_klein_2 + s.klant_klein_4 +
        s.klant_bedrijf_1 + s.klant_bedrijf_2 + s.klant_bedrijf_4
    )

    omzet_klein_1   = s.klant_klein_1   * s.prijs_klein_1
    omzet_klein_2   = s.klant_klein_2   * s.prijs_klein_2
    omzet_klein_4   = s.klant_klein_4   * s.prijs_klein_4
    omzet_bedrijf_1 = s.klant_bedrijf_1 * s.prijs_bedrijf_1
    omzet_bedrijf_2 = s.klant_bedrijf_2 * s.prijs_bedrijf_2
    omzet_bedrijf_4 = s.klant_bedrijf_4 * s.prijs_bedrijf_4
    totaal_omzet = (
        omzet_klein_1 + omzet_klein_2 + omzet_klein_4 +
        omzet_bedrijf_1 + omzet_bedrijf_2 + omzet_bedrijf_4
    )

    # Kosten — arbeid is vast (personeel), variabel = water + materialen
    kosten_per_job = s.water_per_reiniging + s.overig_per_reiniging
    variabele_kosten = totaal_reinigingen * kosten_per_job
    overige_vaste_kosten = s.vaste_kosten_totaal
    personeel_kosten = s.personeel_mnd
    vaste_kosten = personeel_kosten + overige_vaste_kosten
    totaal_kosten = variabele_kosten + vaste_kosten
    netto_winst = totaal_omzet - totaal_kosten

    capaciteit_benut = totaal_reinigingen / capaciteit if capaciteit > 0 else 0.0

    gem_opbrengst = totaal_omzet / totaal_reinigingen if totaal_reinigingen > 0 else 0.0

    if netto_winst > 0:
        tv_mnd = investering / netto_winst
        tv_jr  = tv_mnd / 12
    else:
        tv_mnd = None
        tv_jr  = None

    # Break-even: min. klanten met goedkoopste abo (klein 1x)
    marge_klein_1 = s.prijs_klein_1 - kosten_per_job
    be = int(vaste_kosten / marge_klein_1 + 0.999) if marge_klein_1 > 0 else -1

    return Resultaat(
        totaal_investering=investering,
        omzet_klein_1=omzet_klein_1, omzet_klein_2=omzet_klein_2, omzet_klein_4=omzet_klein_4,
        omzet_bedrijf_1=omzet_bedrijf_1, omzet_bedrijf_2=omzet_bedrijf_2, omzet_bedrijf_4=omzet_bedrijf_4,
        totaal_omzet=totaal_omzet,
        reinigingen_klein=reinigingen_klein, reinigingen_bedrijf=reinigingen_bedrijf,
        totaal_reinigingen=totaal_reinigingen, totaal_klanten=totaal_klanten,
        capaciteit_mnd=capaciteit, capaciteit_benut=capaciteit_benut,
        variabele_kosten=variabele_kosten,
        personeel_kosten=personeel_kosten, overige_vaste_kosten=overige_vaste_kosten,
        vaste_kosten=vaste_kosten, totaal_kosten=totaal_kosten, netto_winst=netto_winst,
        kosten_per_reiniging=kosten_per_job,
        gem_opbrengst_per_reiniging=gem_opbrengst,
        terugverdien_maanden=tv_mnd, terugverdien_jaren=tv_jr,
        break_even_klanten_mnd1=be,
    )


def cumulatief(s: Scenario, maanden: int = 48) -> list[dict]:
    r = bereken(s)
    saldo = -r.totaal_investering
    punten = []
    for m in range(1, maanden + 1):
        saldo += r.netto_winst
        punten.append({"Maand": m, s.naam: round(saldo, 2)})
    return punten
