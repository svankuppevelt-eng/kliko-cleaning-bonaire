from __future__ import annotations
import json
import uuid
from dataclasses import dataclass, field, asdict
from pathlib import Path

NOTES_FILE = Path(__file__).parent.parent / "data" / "notes.json"


@dataclass
class Notitie:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    titel: str = ""
    inhoud: str = ""
    categorie: str = "Algemeen"

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, d: dict) -> "Notitie":
        return cls(**d)


def load_notes() -> list[Notitie]:
    if not NOTES_FILE.exists():
        return []
    try:
        return [Notitie.from_dict(n) for n in json.loads(NOTES_FILE.read_text(encoding="utf-8"))]
    except Exception:
        return []


def save_notes(notes: list[Notitie]) -> None:
    NOTES_FILE.parent.mkdir(parents=True, exist_ok=True)
    NOTES_FILE.write_text(
        json.dumps([n.to_dict() for n in notes], indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


def upsert_note(note: Notitie) -> None:
    notes = load_notes()
    idx = next((i for i, n in enumerate(notes) if n.id == note.id), None)
    if idx is not None:
        notes[idx] = note
    else:
        notes.append(note)
    save_notes(notes)


def delete_note(note_id: str) -> None:
    save_notes([n for n in load_notes() if n.id != note_id])
