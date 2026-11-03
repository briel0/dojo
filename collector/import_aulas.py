"""Extrai os dias de aula dos demonstrativos de repasse em PDF e junta num JSON só com datas e horários.

O demonstrativo tem valores e nomes de turmas: nada disso é guardado, só o dia e o horário de cada aula dada.
Linhas de vídeo gravado ficam de fora (decisão 14 do AGENTS.md). Rodar de novo com um PDF já importado não
duplica: cada aula é identificada pelo dia e pelo horário de início.

Uso: python collector/import_aulas.py <saida.json> <demonstrativo.pdf> [mais.pdf ...]
Precisa do pdftotext (Poppler; vem com o Git para Windows).
"""

import json
import re
import subprocess
import sys
from pathlib import Path

CLASS_LINE = re.compile(r"\bAula\s+(\d{2})/(\d{2})/(\d{4})\s*\|\s*(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})")


def classes_in(pdf: Path) -> list[dict]:
    text = subprocess.run(
        ["pdftotext", "-layout", str(pdf), "-"], capture_output=True, check=True,
    ).stdout.decode("utf-8", errors="replace")
    return [
        {"day": f"{year}-{month}-{day}", "start": start, "end": end}
        for day, month, year, start, end in CLASS_LINE.findall(text)
    ]


def main() -> int:
    if len(sys.argv) < 3:
        print("Uso: python collector/import_aulas.py <saida.json> <demonstrativo.pdf> [mais.pdf ...]", file=sys.stderr)
        return 2
    output = Path(sys.argv[1])
    try:
        known = json.loads(output.read_text(encoding="utf-8"))["classes"]
    except (OSError, ValueError, KeyError):
        known = []

    merged = {(c["day"], c["start"]): c for c in known}
    for pdf in sys.argv[2:]:
        found = classes_in(Path(pdf))
        print(f"{pdf}: {len(found)} aulas")
        merged.update({(c["day"], c["start"]): c for c in found})

    classes = [merged[key] for key in sorted(merged)]
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({"source": "aulas", "classes": classes}, ensure_ascii=False, indent=1) + "\n",
                      encoding="utf-8")
    days = len({c["day"] for c in classes})
    print(f"{output}: {len(classes)} aulas em {days} dias ({len(classes) - len(known)} novas)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
