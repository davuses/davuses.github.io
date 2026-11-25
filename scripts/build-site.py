#!/usr/bin/env python3
"""Assemble a clean public `_site` directory for GitHub Pages deployment.

- Copies only public web assets (excludes `.git`, `.github`, `scripts`, `README.md`, etc.)
- Inlines `sites.json` and `site-overrides.json` into `_site/index.html` and
  `_site/music/index.html` for instant zero-flash rendering while still keeping
  the standalone JSON files accessible for debugging or external use.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent

EXCLUDED_NAMES = {
    ".git",
    ".github",
    ".gitignore",
    "_site",
    "scripts",
    "README.md",
    "__pycache__",
}


def safe_inline_json(data: object) -> str:
    # Escape `</` so inline <script type="application/json"> can never close prematurely
    return json.dumps(data, ensure_ascii=False).replace("</", "<\\/")


def inject_bootstrap_data(html_path: pathlib.Path, sites_data: object, overrides_data: object) -> None:
    if not html_path.exists():
        return
    content = html_path.read_text(encoding="utf-8")
    snippet = (
        f'<script id="sites-data" type="application/json">{safe_inline_json(sites_data)}</script>\n'
        f'  <script id="overrides-data" type="application/json">{safe_inline_json(overrides_data)}</script>\n'
        "</body>"
    )
    marker = "</body>"
    if marker in content and 'id="sites-data"' not in content:
        idx = content.rfind(marker)
        content = content[:idx] + snippet + content[idx + len(marker) :]
        html_path.write_text(content, encoding="utf-8")


def build(out_dir: pathlib.Path) -> None:
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    for entry in ROOT.iterdir():
        if entry.name in EXCLUDED_NAMES or entry.name.startswith(".DS_Store"):
            continue
        dest = out_dir / entry.name
        if entry.is_dir():
            shutil.copytree(
                entry,
                dest,
                ignore=shutil.ignore_patterns(".git", "__pycache__", "*.pyc", ".DS_Store"),
            )
        else:
            shutil.copy2(entry, dest)

    sites_path = ROOT / "sites.json"
    overrides_path = ROOT / "site-overrides.json"
    sites_data = json.loads(sites_path.read_text(encoding="utf-8")) if sites_path.exists() else {"sites": []}
    overrides_data = json.loads(overrides_path.read_text(encoding="utf-8")) if overrides_path.exists() else {}

    inject_bootstrap_data(out_dir / "index.html", sites_data, overrides_data)
    inject_bootstrap_data(out_dir / "music" / "index.html", sites_data, overrides_data)
    print(f"Built static site into {out_dir}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Build public _site directory for GitHub Pages.")
    parser.add_argument("--out", default="_site", help="Output directory relative to repo root")
    args = parser.parse_args()
    out_dir = (ROOT / args.out).resolve()
    build(out_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
