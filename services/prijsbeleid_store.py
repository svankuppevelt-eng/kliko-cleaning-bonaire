from __future__ import annotations
import json
from dataclasses import dataclass, asdict
from pathlib import Path

DATA_FILE = Path(__file__).parent.parent / "data" / "prijsbeleid.json"


@dataclass
class PrijsBeleid:
    # Multi-container kortingen (% op elke extra container)
    korting_2e_container: float = 10.0
    korting_3e_container: float = 15.0
    korting_4e_container: float = 20.0

    # Jaarcontract (12 maanden vooruit betalen)
    korting_jaarcontract: float = 10.0
    cadeau_jaarcontract: str = "Welkomstpakket + 1 gratis extra reiniging bij aanvang"

    # Welkomstcadeau (iedereen bij eerste afsluiting)
    cadeau_welkom: str = "Eerste reiniging gratis"

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "PrijsBeleid":
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})


def load_prijsbeleid() -> PrijsBeleid:
    if not DATA_FILE.exists():
        return PrijsBeleid()
    try:
        return PrijsBeleid.from_dict(json.loads(DATA_FILE.read_text(encoding="utf-8")))
    except Exception:
        return PrijsBeleid()


def save_prijsbeleid(pb: PrijsBeleid) -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(
        json.dumps(pb.to_dict(), indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
