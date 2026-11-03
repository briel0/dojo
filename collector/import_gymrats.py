"""Extrai os check-ins de uma pessoa do JSON exportado de um desafio do GymRats.

A exportação (GymRats Pro: configurações do desafio → exportar) traz o desafio inteiro: membros, mensagens e
os check-ins de todo mundo. Este script guarda só os check-ins da conta pedida, com os campos úteis, para virar
histórico de treinos. Entrada e saída ficam em data/ (fora do Git): têm dados pessoais.

Uso: python collector/import_gymrats.py <export.json> <account_id> <saida.json>
     (sem account_id, lista as contas com o número de check-ins para achar a sua)
"""

import json
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

BRT = timezone(timedelta(hours=-3), "America/Sao_Paulo")  # mesma regra do coletor (decisão 11)


def parse_instant(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def list_accounts(export: dict) -> None:
    counts = Counter(check_in["account_id"] for check_in in export["check_ins"])
    names = {member["id"]: member.get("full_name") or "?" for member in export["members"]}
    for account, count in counts.most_common():
        print(f"{account}\t{count} check-ins\t{names.get(account, '?')}")


def extract(export: dict, account_id: int) -> list[dict]:
    check_ins = []
    for check_in in export["check_ins"]:
        if check_in["account_id"] != account_id:
            continue
        occurred = parse_instant(check_in["occurred_at"]).astimezone(BRT)
        millis = check_in.get("duration_millis")
        check_ins.append({
            "gymrats_id": check_in["id"],
            "day": occurred.date().isoformat(),
            "occurred_at": occurred.isoformat(timespec="minutes"),
            "title": (check_in.get("title") or "").strip() or None,
            "description": (check_in.get("description") or "").strip() or None,
            "duration_min": round(millis / 60000) if millis else None,
        })
    return sorted(check_ins, key=lambda item: item["occurred_at"])


def main() -> int:
    if len(sys.argv) not in (2, 4):
        print(__doc__.strip().splitlines()[-2:][0].strip(), file=sys.stderr)
        return 2
    export = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    if len(sys.argv) == 2:
        list_accounts(export)
        return 0

    check_ins = extract(export, int(sys.argv[2]))
    output = Path(sys.argv[3])
    output.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "source": "gymrats",
        "challenge_id": export["id"],
        "account_id": int(sys.argv[2]),
        "exported_until": max((c["occurred_at"] for c in check_ins), default=None),
        "check_ins": check_ins,
    }
    output.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    days = len({c["day"] for c in check_ins})
    print(f"{output}: {len(check_ins)} check-ins em {days} dias")
    return 0


if __name__ == "__main__":
    sys.exit(main())
