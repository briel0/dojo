"""Envia os check-ins extraídos do GymRats para o Treinos, como treinos sem exercícios (só data, hora e nota).

Pula os dias que já têm treino no Treinos (o registro de lá é mais completo). Os ids são UUID v7 derivados do
horário e do id do check-in, então rodar de novo não duplica nada: a API devolve o treino que já existe.

Uso: python collector/gymrats_to_treinos.py <checkins.json> <url da API> [--apply]
     (sem --apply, só mostra o que faria)
"""

import hashlib
import json
import sys
import urllib.parse
import urllib.request
import uuid
from datetime import date, datetime, time, timedelta
from pathlib import Path

from collect import BRT, request_json  # mesma regra de fuso e de chamadas do coletor


def stable_uuid7(occurred: datetime, gymrats_id: int) -> str:
    """UUID v7 com o horário do check-in e o resto tirado do id dele: o mesmo check-in gera sempre o mesmo id."""
    millis = int(occurred.timestamp() * 1000)
    rest = int.from_bytes(hashlib.sha256(f"gymrats:{gymrats_id}".encode()).digest()[:10], "big")
    value = (millis & ((1 << 48) - 1)) << 80
    value |= 0x7 << 76                                  # versão 7
    value |= ((rest >> 62) & 0xFFF) << 64               # rand_a, 12 bits
    value |= 0b10 << 62                                 # variante RFC 9562
    value |= rest & ((1 << 62) - 1)                     # rand_b, 62 bits
    return str(uuid.UUID(int=value))


def note_for(title: str | None) -> str:
    # Títulos sem letras (".") não dizem nada; os outros costumam ser o grupo muscular
    if title and any(char.isalpha() for char in title):
        return f"Importado do GymRats: {title}"
    return "Importado do GymRats"


def existing_days(api_url: str, first: date, last: date) -> set[str]:
    params = urllib.parse.urlencode({
        "since": datetime.combine(first, time.min, BRT).isoformat(),
        "until": datetime.combine(last + timedelta(days=1), time.min, BRT).isoformat(),
    })
    workouts = request_json(f"{api_url.rstrip('/')}/api/workouts?{params}")
    return {datetime.fromisoformat(w["startedAt"]).astimezone(BRT).date().isoformat() for w in workouts}


def post(api_url: str, body: dict) -> int:
    request = urllib.request.Request(
        f"{api_url.rstrip('/')}/api/workouts", data=json.dumps(body).encode(), method="POST",
        headers={"Content-Type": "application/json", "User-Agent": "dojo-gymrats-import"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.status


def main() -> int:
    if len(sys.argv) not in (3, 4) or (len(sys.argv) == 4 and sys.argv[3] != "--apply"):
        print("Uso: python collector/gymrats_to_treinos.py <checkins.json> <url da API> [--apply]", file=sys.stderr)
        return 2
    check_ins = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))["check_ins"]
    api_url, apply = sys.argv[2], len(sys.argv) == 4
    if not check_ins:
        print("Nenhum check-in.")
        return 0

    taken = existing_days(api_url, date.fromisoformat(check_ins[0]["day"]), date.fromisoformat(check_ins[-1]["day"]))
    to_send = [c for c in check_ins if c["day"] not in taken]
    print(f"{len(check_ins)} check-ins; {len(check_ins) - len(to_send)} pulados (dia já tem treino: "
          f"{', '.join(sorted(taken & {c['day'] for c in check_ins})) or 'nenhum'}); {len(to_send)} a enviar")
    if not apply:
        for check_in in to_send[:3]:
            print("  exemplo:", check_in["occurred_at"], "|", note_for(check_in["title"]))
        print("Nada foi enviado (use --apply).")
        return 0

    statuses: dict[int, int] = {}
    for check_in in to_send:
        occurred = datetime.fromisoformat(check_in["occurred_at"])
        body = {
            "id": stable_uuid7(occurred, check_in["gymrats_id"]),
            "startedAt": occurred.isoformat(),
            "note": note_for(check_in["title"]),
            "exercises": [],
        }
        status = post(api_url, body)
        statuses[status] = statuses.get(status, 0) + 1
    print("Respostas da API:", ", ".join(f"{count}× {status}" for status, count in sorted(statuses.items())),
          "(201 criado, 200 já existia)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
