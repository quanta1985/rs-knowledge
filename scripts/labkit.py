"""Shared helper for the lab-notebook generators (scripts/build_lab_chNN.py)."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MD, PY = "markdown", "code"
PLACEHOLDER = "YOUR-CLOUD-PROJECT-ID"
LOCAL_PROJECT = "claudev1-503808"


def notebook(cells: list[tuple[str, str]]) -> dict:
    out = []
    for kind, src in cells:
        cell = {"cell_type": kind, "metadata": {}, "source": src.splitlines(keepends=True)}
        if kind == PY:
            cell.update(execution_count=None, outputs=[])
        out.append(cell)
    return {"cells": out, "metadata": {"kernelspec": {"name": "python3", "display_name": "Python 3"},
                                       "language_info": {"name": "python"}, "colab": {"provenance": []}},
            "nbformat": 4, "nbformat_minor": 5}


def main(cells: list[tuple[str, str]], name: str) -> None:
    """Write labs/<name>.ipynb; with --run also execute every code cell locally (needs EE auth)."""
    out = ROOT / "labs" / f"{name}.ipynb"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(notebook(cells), ensure_ascii=False, indent=1), "utf-8")
    print("wrote", out)
    if "--run" in sys.argv:
        import matplotlib
        matplotlib.use("Agg")
        code = "\n\n".join(src for kind, src in cells if kind == PY).replace(PLACEHOLDER, LOCAL_PROJECT)
        exec(compile(code, name, "exec"), {"__name__": "__lab__"})
        print("all code cells ran OK")
