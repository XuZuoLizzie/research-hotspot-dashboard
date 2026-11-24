"""Optional: build data/bundle.js so index.html also works when opened via file:// (double-click).

Usage (from the site root):  python tools/build_bundle.py
Re-run whenever data/articles.json or data/journals.json changes.
"""
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
data = {
    "articles": json.loads((root / "data/articles.json").read_text(encoding="utf-8")),
    "journals": json.loads((root / "data/journals.json").read_text(encoding="utf-8")),
}
out = root / "data/bundle.js"
out.write_text("window.DASHBOARD_DATA=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
print(f"wrote {out} ({out.stat().st_size/1024:.0f} KB)")
