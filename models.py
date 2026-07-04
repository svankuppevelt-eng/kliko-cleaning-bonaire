from __future__ import annotations
import json
import uuid
from dataclasses import dataclass, field, asdict
from typing import List
from pathlib import Path

DATA_FILE = Path(__file__).parent / "data" / "scenarios.json"

_VEROUDERDE_VELDEN = {
    "prijs_los", "prijs_wekelijks_abo", "prijs_maandelijks_abo",
    "losse_reinigingen", "wekelijkse_abonnees", "maandelijkse_abonnees",
    "prijs_wk_1", "prijs_wk_2", "prijs_wk_3",
    "prijs_mnd_1", "prijs_mnd_2", "prijs_mnd_3",
    "klant_wk_1", "klant_wk_2", "klant_wk_3",
    "klant_mnd_1", "klant_mnd_2", "klant_mnd_3",
    "prijs_klein_mnd", "prijs_klein_wk", "prijs_bedrijf_mnd", "prijs_bedrijf_wk",
    "klant_klein_mnd", "klant_klein_wk", "klant_bedrijf_mnd", "klant_bedrijf_wk",
    "arbeid_per_reiniging",
}


@dataclass
class Kostenpost:
    naam: str
    bedrag: float


@dataclass
class Scenario:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    naam: str = ""
    omschrijving: str = ""

    investeringen: List[Kostenpost] = field(default_factory=list)

    # Kosten per reiniging — arbeid is nu vast (personeel)
    water_per_reiniging: float = 0.30
    overig_per_reiniging: float = 0.50  # middelen, slijtage

    # Vaste maandkosten
    vaste_maandkosten: List[Kostenpost] = field(default_factory=list)
    personeel_mnd: float = 2500.00  # salaris cleaner(s)

    # Capaciteit
    containers_per_dag: int = 60
    werkdagen_per_mnd: int = 20

    # Prijsstelling (prijs per maand per klant, per container)
    # frequentie: 1 = 1x/mnd, 2 = 2x/mnd, 4 = 4x/mnd
    prijs_klein_1: float = 10.00
    prijs_klein_2: float = 18.00
    prijs_klein_4: float = 22.00
    prijs_bedrijf_1: float = 18.00
    prijs_bedrijf_2: float = 30.00
    prijs_bedrijf_4: float = 36.00

    # Klanten per abonnementsvorm
    klant_klein_1: int = 0
    klant_klein_2: int = 0
    klant_klein_4: int = 0
    klant_bedrijf_1: int = 0
    klant_bedrijf_2: int = 0
    klant_bedrijf_4: int = 0

    @property
    def investering_totaal(self) -> float:
        return sum(k.bedrag for k in self.investeringen)

    @property
    def vaste_kosten_totaal(self) -> float:
        return sum(k.bedrag for k in self.vaste_maandkosten)

    @property
    def capaciteit_per_mnd(self) -> int:
        return self.containers_per_dag * self.werkdagen_per_mnd

    def set_investering(self, bedrag: float) -> None:
        self.investeringen = [Kostenpost("Investering", bedrag)]

    def set_vaste_kosten(self, bedrag: float) -> None:
        self.vaste_maandkosten = [Kostenpost("Vaste lasten", bedrag)]

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "Scenario":
        d = dict(d)
        d["investeringen"] = [Kostenpost(**k) for k in d.get("investeringen", [])]
        d["vaste_maandkosten"] = [Kostenpost(**k) for k in d.get("vaste_maandkosten", [])]
        for veld in _VEROUDERDE_VELDEN:
            d.pop(veld, None)
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


def load_scenarios() -> List[Scenario]:
    if not DATA_FILE.exists():
        return []
    try:
        raw = json.loads(DATA_FILE.read_text(encoding="utf-8"))
        return [Scenario.from_dict(s) for s in raw]
    except Exception:
        return []


def save_scenarios(scenarios: List[Scenario]) -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(
        json.dumps([s.to_dict() for s in scenarios], indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def upsert_scenario(scenario: Scenario) -> None:
    scenarios = load_scenarios()
    idx = next((i for i, s in enumerate(scenarios) if s.id == scenario.id), None)
    if idx is not None:
        scenarios[idx] = scenario
    else:
        scenarios.append(scenario)
    save_scenarios(scenarios)


def delete_scenario(scenario_id: str) -> None:
    save_scenarios([s for s in load_scenarios() if s.id != scenario_id])
