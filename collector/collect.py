"""Coletor do quadrinho: busca as atividades de cada fonte e grava um JSON com as contagens por dia.

Roda por timer na VPS. Só biblioteca padrão (decisão 8 do AGENTS.md). Uma fonte que falha não derruba as
outras: ela mantém as contagens da execução anterior e o erro fica registrado no próprio JSON.

Uso: python3 collector/collect.py   (configuração por variáveis de ambiente ou por um .env na raiz)
"""

import json
import os
import sys
import tempfile
import urllib.parse
import urllib.request
from datetime import date, datetime, time, timedelta, timezone
from pathlib import Path

# Brasília sem horário de verão (abolido em 2019): um deslocamento fixo dispensa a base de fusos, que o
# Python não traz no Windows. Dados anteriores a 2019 poderiam cair no dia errado perto da meia-noite.
BRT = timezone(timedelta(hours=-3), "America/Sao_Paulo")
DAYS = 371  # 53 semanas: o quadrinho mostra o último ano em colunas completas
TIMEOUT_SECONDS = 30
ROOT = Path(__file__).resolve().parent.parent
SOURCES = ("github", "codeforces", "workout")


def load_env_file(path: Path) -> None:
    """Lê KEY=valor de um .env, sem sobrescrever o que já está no ambiente (útil para rodar no PC)."""
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


def request_json(url: str, *, data: dict | None = None, headers: dict | None = None):
    body = json.dumps(data).encode() if data is not None else None
    request = urllib.request.Request(url, data=body, headers={"User-Agent": "painel-collector", **(headers or {})})
    if body is not None:
        request.add_header("Content-Type", "application/json")
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        return json.load(response)


def github_counts(login: str, token: str, start: date, end: date) -> dict[str, int]:
    """Contribuições por dia, como no calendário do perfil (inclui as privadas, porque o token é do dono).

    O GitHub já entrega o total por dia, no calendário dele; não dá para reagrupar no fuso de Brasília.
    """
    query = """
    query($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar { weeks { contributionDays { date contributionCount } } }
        }
      }
    }"""
    counts: dict[str, int] = {}
    # A API aceita no máximo um ano por consulta
    chunk_start = start
    while chunk_start <= end:
        chunk_end = min(end, chunk_start + timedelta(days=360))
        variables = {
            "login": login,
            "from": datetime.combine(chunk_start, time.min, BRT).isoformat(),
            "to": datetime.combine(chunk_end, time.max, BRT).isoformat(),
        }
        result = request_json(
            "https://api.github.com/graphql",
            data={"query": query, "variables": variables},
            headers={"Authorization": f"Bearer {token}"},
        )
        if result.get("errors"):
            raise RuntimeError(result["errors"][0].get("message", "erro na API do GitHub"))
        weeks = result["data"]["user"]["contributionsCollection"]["contributionCalendar"]["weeks"]
        for week in weeks:
            for day in week["contributionDays"]:
                if day["contributionCount"] and start.isoformat() <= day["date"] <= end.isoformat():
                    counts[day["date"]] = day["contributionCount"]
        chunk_start = chunk_end + timedelta(days=1)
    return counts


def codeforces_counts(handle: str, start: date, end: date) -> dict[str, int]:
    """Submissões por dia em Brasília, com qualquer veredito (tentar já conta como ter codado)."""
    url = "https://codeforces.com/api/user.status?" + urllib.parse.urlencode({"handle": handle})
    result = request_json(url)
    if result.get("status") != "OK":
        raise RuntimeError(result.get("comment", "erro na API do Codeforces"))
    counts: dict[str, int] = {}
    for submission in result["result"]:
        day = datetime.fromtimestamp(submission["creationTimeSeconds"], BRT).date()
        if start <= day <= end:
            counts[day.isoformat()] = counts.get(day.isoformat(), 0) + 1
    return counts


def workout_counts(api_url: str, start: date, end: date) -> dict[str, int]:
    """Treinos por dia em Brasília, pelo início de cada treino (qualquer tipo, inclusive cardio)."""
    params = urllib.parse.urlencode({
        "since": datetime.combine(start, time.min, BRT).isoformat(),
        "until": datetime.combine(end + timedelta(days=1), time.min, BRT).isoformat(),
    })
    workouts = request_json(f"{api_url.rstrip('/')}/api/workouts?{params}")
    counts: dict[str, int] = {}
    for workout in workouts:
        day = datetime.fromisoformat(workout["startedAt"]).astimezone(BRT).date().isoformat()
        counts[day] = counts.get(day, 0) + 1
    return counts


def previous_counts(output: Path) -> dict[str, dict[str, int]]:
    """As contagens da última execução, por fonte, para não apagar uma fonte que falhou agora."""
    try:
        days = json.loads(output.read_text(encoding="utf-8"))["days"]
    except (OSError, ValueError, KeyError):
        return {}
    by_source: dict[str, dict[str, int]] = {}
    for day, counts in days.items():
        for source, count in counts.items():
            by_source.setdefault(source, {})[day] = count
    return by_source


def write_atomically(output: Path, content: str) -> None:
    """Grava num arquivo temporário e troca de uma vez: a página nunca lê um JSON pela metade."""
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=output.parent, delete=False, suffix=".tmp") as tmp:
        tmp.write(content)
    os.chmod(tmp.name, 0o644)
    os.replace(tmp.name, output)


def main() -> int:
    load_env_file(ROOT / ".env")
    output = Path(os.environ.get("OUTPUT_PATH") or "data/activity.json")
    if not output.is_absolute():
        output = ROOT / output

    end = datetime.now(BRT).date()
    start = end - timedelta(days=DAYS - 1)
    previous = previous_counts(output)

    fetchers = {
        "github": (
            ("GITHUB_LOGIN", "GITHUB_TOKEN"),
            lambda: github_counts(os.environ["GITHUB_LOGIN"], os.environ["GITHUB_TOKEN"], start, end),
        ),
        "codeforces": (("CODEFORCES_HANDLE",), lambda: codeforces_counts(os.environ["CODEFORCES_HANDLE"], start, end)),
        "workout": (("TREINOS_API_URL",), lambda: workout_counts(os.environ["TREINOS_API_URL"], start, end)),
    }
    counts: dict[str, dict[str, int]] = {}
    status: dict[str, dict] = {}
    for source, (required, fetch) in fetchers.items():
        missing = [name for name in required if not os.environ.get(name)]
        if missing:
            status[source] = {"ok": False, "error": f"não configurado ({', '.join(missing)})"}
            continue
        try:
            counts[source] = fetch()
            status[source] = {"ok": True}
        except Exception as error:  # noqa: BLE001 - uma fonte não pode derrubar as outras
            counts[source] = previous.get(source, {})
            status[source] = {"ok": False, "error": f"{error.__class__.__name__}: {error}"[:300]}
            print(f"{source}: {status[source]['error']}", file=sys.stderr)

    days: dict[str, dict[str, int]] = {}
    for source, by_day in counts.items():
        for day, count in by_day.items():
            if start.isoformat() <= day <= end.isoformat() and count:
                days.setdefault(day, {})[source] = count

    data = {
        "generated_at": datetime.now(BRT).isoformat(timespec="seconds"),
        "timezone": "America/Sao_Paulo",
        "from": start.isoformat(),
        "to": end.isoformat(),
        "sources": status,
        "days": dict(sorted(days.items())),
    }
    write_atomically(output, json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    print(f"{output}: {len(days)} dias com atividade; " + ", ".join(
        f"{source} {'ok' if status[source]['ok'] else 'FALHOU'}" for source in SOURCES))
    return 0 if all(status[source]["ok"] for source in SOURCES if source in counts) else 1


if __name__ == "__main__":
    sys.exit(main())
