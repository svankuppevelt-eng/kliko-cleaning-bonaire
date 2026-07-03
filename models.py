from __future__ import annotations
import json
import uuid
from dataclasses import dataclass, field, asdict
from typing import List
from pathlib import Path

DATA_FILE = Path(__file__).parent / "data" / "scenarios.json"


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

    water_per_reiniging: float = 0.30
    arbeid_per_reiniging: float = 5.00
    overig_per_reiniging: float = 0.50

    vaste_maandkosten: List[Kostenpost] = field(default_factory=list)

    prijs_los: float = 15.00
    prijs_wekelijks_abo: float = 45.00
    prijs_maandelijks_abo: float = 12.00

    losse_reinigingen: int = 0
    wekelijkse_abonnees: int = 0
    maandelijkse_abonnees: int = 0

    @property
    def investering_totaal(self) -> float:
        return sum(k.bedrag for k in self.investeringen)

    @property
    def vaste_kosten_totaal(self) -> float:
        return sum(k.bedrag for k in self.vaste_maandkosten)

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
        return cls(**d)


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
