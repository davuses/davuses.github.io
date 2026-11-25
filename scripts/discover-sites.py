#!/usr/bin/env python3
"""Discover published GitHub Pages repositories and local subsites for davuses.github.io.

Uses only Python's standard library so it runs cleanly locally and in GitHub Actions
with zero external dependencies.

Outputs `sites.json` (schema v2) while preserving historical entries and falling back
gracefully if GitHub API or network checks temporarily fail.
"""

from __future__ import annotations

import datetime
import html
import json
import os
import pathlib
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from typing import Any

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITES_FILE = ROOT / "sites.json"
OWNER = os.environ.get("PAGES_OWNER", "davuses")
BASE_URL = f"https://{OWNER}.github.io/"
USER_AGENT = f"{OWNER}-site-directory/2.0"

IGNORED_SUBDIRS = {
    "assets",
    "covers",
    "docs",
    "node_modules",
    "scripts",
    "vendor",
    "_site",
    "dist",
    "build",
}

MUSIC_KEYWORDS = ("album", "concept album", "lo-fi", "openband", "soundtrack", "ep", "tracks")
WRITING_KEYWORDS = ("field guide", "essay", "guide", "manifesto", "notes", "handbook", "article")
INTERACTIVE_KEYWORDS = (
    "simulation",
    "symplectic",
    "physics",
    "equation",
    "interactive",
    "shader",
    "canvas",
    "visualizer",
    "experiment",
    "generative",
)


class PageMetadataParser(HTMLParser):
    """Extract title, description, OpenGraph metadata, and theme-color from HTML."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._in_title = False
        self.title_parts: list[str] = []
        self.meta: dict[str, str] = {}
        self.og: dict[str, str] = {}

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag_l = tag.lower()
        if tag_l == "title":
            self._in_title = True
            return
        if tag_l != "meta":
            return
        attr_map = {k.lower(): (v or "").strip() for k, v in attrs if k}
        content = attr_map.get("content", "")
        if not content:
            return
        name = attr_map.get("name", "").lower()
        prop = attr_map.get("property", "").lower()
        if name and name not in self.meta:
            self.meta[name] = content
        if prop and prop not in self.og:
            self.og[prop] = content

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == "title":
            self._in_title = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title_parts.append(data)

    @property
    def title(self) -> str:
        raw = "".join(self.title_parts)
        return re.sub(r"\s+", " ", html.unescape(raw)).strip()

    @property
    def description(self) -> str:
        raw = (
            self.meta.get("description")
            or self.og.get("og:description")
            or ""
        )
        return re.sub(r"\s+", " ", html.unescape(raw)).strip()

    @property
    def og_title(self) -> str:
        raw = self.og.get("og:title", "")
        return re.sub(r"\s+", " ", html.unescape(raw)).strip()

    @property
    def og_image(self) -> str:
        return self.og.get("og:image", "").strip()

    @property
    def og_type(self) -> str:
        return self.og.get("og:type", "").strip().lower()

    @property
    def theme_color(self) -> str:
        return self.meta.get("theme-color", "").strip()


def http_request(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    timeout: int = 20,
    max_bytes: int | None = None,
) -> tuple[int, str, bytes]:
    req_headers = {"User-Agent": USER_AGENT}
    if headers:
        req_headers.update(headers)
    req = urllib.request.Request(url, headers=req_headers)
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        final_url = resp.geturl()
        status = getattr(resp, "status", 200)
        data = resp.read(max_bytes) if max_bytes else resp.read()
        return status, final_url, data


def github_api_get(path_or_url: str, token: str | None) -> Any:
    url = (
        path_or_url
        if path_or_url.startswith("https://")
        else f"https://api.github.com/{path_or_url.lstrip('/')}"
    )
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    _, _, body = http_request(url, headers=headers, timeout=25)
    return json.loads(body.decode("utf-8"))


def fetch_owner_repos(owner: str, token: str | None) -> list[dict[str, Any]]:
    repos: list[dict[str, Any]] = []
    page = 1
    while True:
        batch = github_api_get(
            f"users/{owner}/repos?type=owner&per_page=100&page={page}",
            token,
        )
        if not isinstance(batch, list) or not batch:
            break
        repos.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return repos


def parse_html_metadata(raw_html: str, page_url: str) -> dict[str, str]:
    parser = PageMetadataParser()
    try:
        parser.feed(raw_html)
    except Exception:
        pass

    image_url = ""
    if parser.og_image:
        image_url = urllib.parse.urljoin(page_url, parser.og_image)

    return {
        "html_title": parser.title,
        "og_title": parser.og_title,
        "html_description": parser.description,
        "og_image": image_url,
        "og_type": parser.og_type,
        "theme_color": parser.theme_color,
    }


def clean_site_title(slug: str, html_title: str, og_title: str) -> str:
    candidate = html_title or og_title or slug
    # Keep full title if concise; split off redundant " — Demo" suffixes cleanly
    candidate = re.sub(r"\s+[—–-]\s+(?:Summer|Winter|Spring|Autumn)\s+(?:Lo-Fi\s+)?Album\s+Demo$", "", candidate, flags=re.I)
    return candidate.strip() or slug


def format_duration(total_seconds: float) -> str:
    secs = max(0, int(round(total_seconds)))
    mins, rem = divmod(secs, 60)
    return f"{mins}:{rem:02d}"


def url_exists(url: str) -> bool:
    try:
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=12) as resp:
            return 200 <= getattr(resp, "status", 200) < 400
    except Exception:
        return False


def fetch_album_metadata(page_url: str, slug: str, image_url: str) -> dict[str, Any] | None:
    """Attempt to load OpenBand `album-data.json` from a live music album site."""
    data_url = urllib.parse.urljoin(page_url, "album-data.json")
    try:
        status, _, body = http_request(data_url, timeout=15, max_bytes=512_000)
        if status != 200:
            return None
        tracks_raw = json.loads(body.decode("utf-8"))
        if not isinstance(tracks_raw, list) or not tracks_raw:
            return None
    except Exception:
        return None

    tracks: list[dict[str, Any]] = []
    bpms: list[int] = []
    total_duration = 0.0
    for idx, t in enumerate(tracks_raw, start=1):
        if not isinstance(t, dict):
            continue
        title = str(t.get("title") or f"Track {idx}").strip()
        bpm = t.get("bpm")
        if isinstance(bpm, (int, float)) and bpm > 0:
            bpms.append(int(round(bpm)))
        dur = t.get("duration")
        if isinstance(dur, (int, float)) and dur > 0:
            total_duration += float(dur)
        download_name = str(t.get("downloadName") or "").strip()
        tracks.append(
            {
                "num": idx,
                "title": title,
                "bpm": int(round(bpm)) if isinstance(bpm, (int, float)) else None,
                "key": str(t.get("key") or "").strip(),
                "download_name": download_name,
            }
        )

    if not tracks:
        return None

    # Pick a sensible default preview track (middle track or track 2)
    preview_idx = min(len(tracks) - 1, max(0, len(tracks) // 2 - 1))
    # Prefer a track whose title matches the album slug words if possible
    slug_tokens = {w for w in re.split(r"[-_]+", slug.lower()) if len(w) > 2}
    for i, tr in enumerate(tracks):
        t_words = {w for w in re.split(r"[^a-z0-9]+", tr["title"].lower()) if len(w) > 2}
        if len(slug_tokens & t_words) >= 2:
            preview_idx = i
            break

    preview = tracks[preview_idx]
    preview_audio = (
        f"/{urllib.parse.quote(slug)}/audio/{urllib.parse.quote(preview['download_name'])}"
        if preview.get("download_name")
        else ""
    )

    bpm_range = ""
    if bpms:
        lo, hi = min(bpms), max(bpms)
        bpm_range = f"{lo} BPM" if lo == hi else f"{lo}–{hi} BPM"

    # Extract time-of-day arc if track titles contain times like (7 AM) ... (11 PM)
    time_matches = [
        m.group(1)
        for tr in tracks
        for m in [re.search(r"\((\d{1,2}(?::\d{2})?\s*(?:AM|PM))\)", tr["title"], re.I)]
        if m
    ]
    arc = f"{time_matches[0]} → {time_matches[-1]}" if len(time_matches) >= 2 else ""

    cover = image_url
    if not cover:
        candidate_cover = urllib.parse.urljoin(page_url, "cover.jpg")
        if url_exists(candidate_cover):
            cover = candidate_cover

    return {
        "track_count": len(tracks),
        "duration": format_duration(total_duration) if total_duration > 0 else "",
        "bpm_range": bpm_range,
        "arc": arc,
        "cover": cover,
        "preview_track": preview["num"],
        "preview_title": re.sub(r"\s*\([^)]*\)\s*$", "", preview["title"]).strip() or preview["title"],
        "preview_audio": preview_audio,
        "tracks": [
            {
                "num": tr["num"],
                "title": tr["title"],
                "bpm": tr["bpm"],
                "key": tr["key"],
                "audio": (
                    f"/{urllib.parse.quote(slug)}/audio/{urllib.parse.quote(tr['download_name'])}"
                    if tr.get("download_name")
                    else ""
                ),
            }
            for tr in tracks
        ],
    }


def infer_category(
    *,
    slug: str,
    og_type: str,
    topics: list[str],
    title: str,
    description: str,
    is_album: bool,
) -> str:
    if is_album or og_type == "music.album" or slug.lower() == "music":
        return "music"
    topic_set = {t.lower() for t in topics}
    if topic_set & {"music", "album", "audio", "openband"}:
        return "music"
    if og_type == "article" or (topic_set & {"essay", "guide", "writing", "blog", "article"}):
        return "writing"
    if topic_set & {"simulation", "physics", "interactive", "canvas", "webgl", "generative", "art"}:
        return "interactive"

    blob = f"{slug} {title} {description}".lower()
    if any(k in blob for k in WRITING_KEYWORDS):
        return "writing"
    if any(k in blob for k in INTERACTIVE_KEYWORDS):
        return "interactive"
    if any(k in blob for k in MUSIC_KEYWORDS):
        return "music"
    return "apps"


def load_existing_registry() -> dict[str, dict[str, Any]]:
    if not SITES_FILE.exists():
        return {}
    try:
        raw = json.loads(SITES_FILE.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"Warning: could not parse existing {SITES_FILE.name}: {exc}", file=sys.stderr)
        return {}

    items = raw.get("sites", []) if isinstance(raw, dict) else raw
    if not isinstance(items, list):
        return {}

    by_key: dict[str, dict[str, Any]] = {}
    for entry in items:
        if isinstance(entry, dict) and entry.get("url"):
            by_key[entry["url"].lower()] = entry
    return by_key


def resolve_repo_pages_url(repo: dict[str, Any], token: str | None) -> tuple[str, str | None]:
    """Return (pages_url, pages_status). Checks GitHub Pages API when authenticated."""
    name = repo["name"]
    default_url = f"{BASE_URL}{urllib.parse.quote(name)}/"
    pages_status: str | None = None

    if token:
        try:
            pages_info = github_api_get(f"repos/{OWNER}/{name}/pages", token)
            if isinstance(pages_info, dict):
                html_url = str(pages_info.get("html_url") or "").strip()
                pages_status = pages_info.get("status")
                if html_url.startswith("https://"):
                    if not html_url.endswith("/"):
                        html_url += "/"
                    return html_url, pages_status
        except Exception:
            pass

    return default_url, pages_status


def discover() -> dict[str, Any]:
    today = datetime.date.today().isoformat()
    now_iso = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN") or None

    previous_by_key = load_existing_registry()
    records: dict[str, dict[str, Any]] = {}
    seen_repo_keys: set[str] = set()
    seen_subsite_keys: set[str] = set()
    warnings: list[str] = []

    # 1. Discover published GitHub Pages repositories
    repos_fetch_ok = False
    try:
        repos = fetch_owner_repos(OWNER, token)
        repos_fetch_ok = True
    except Exception as exc:
        repos = []
        warnings.append(f"GitHub repository API failed ({exc}); preserving previously discovered repository sites.")
        print(f"Warning: {warnings[-1]}", file=sys.stderr)

    for repo in repos:
        if repo.get("private"):
            continue
        name = str(repo.get("name") or "")
        if not name or name.lower() == f"{OWNER.lower()}.github.io":
            continue
        if not repo.get("has_pages"):
            continue

        pages_url, pages_status = resolve_repo_pages_url(repo, token)
        key = pages_url.lower()
        seen_repo_keys.add(key)
        prev = previous_by_key.get(key, {})

        # Verify live URL & extract HTML metadata
        http_status = 0
        meta: dict[str, str] = {}
        try:
            http_status, _, raw_bytes = http_request(pages_url, timeout=18, max_bytes=256_000)
            if 200 <= http_status < 400:
                meta = parse_html_metadata(raw_bytes.decode("utf-8", errors="replace"), pages_url)
        except urllib.error.HTTPError as exc:
            http_status = exc.code
            warnings.append(f"{name}: live URL returned HTTP {exc.code}")
        except Exception as exc:
            warnings.append(f"{name}: live check failed ({exc})")

        is_live = 200 <= http_status < 400
        topics = [str(t) for t in (repo.get("topics") or []) if isinstance(t, str)]
        repo_desc = str(repo.get("description") or "").strip()

        # If a repo temporarily failed HTTP check but was previously live, keep its good metadata
        if not is_live and prev.get("status") == "published":
            preserved = dict(prev)
            preserved["status"] = "unreachable"
            preserved["http_status"] = http_status
            preserved["last_checked"] = today
            records[key] = preserved
            continue

        raw_title = meta.get("html_title") or meta.get("og_title") or prev.get("title") or name
        title = clean_site_title(name, meta.get("html_title", ""), meta.get("og_title", ""))
        description = meta.get("html_description") or repo_desc or prev.get("description") or ""
        # Avoid tautological descriptions like "TurnRiver" when title is already "TurnRiver"
        if description.lower() == name.lower() and meta.get("html_description"):
            description = meta["html_description"]

        og_image = meta.get("og_image") or prev.get("image") or ""
        og_type = meta.get("og_type") or ""

        album_meta: dict[str, Any] | None = None
        if is_live and (
            og_type == "music.album"
            or "album" in f"{title} {description}".lower()
            or "music" in {t.lower() for t in topics}
        ):
            album_meta = fetch_album_metadata(pages_url, name, og_image)
            if album_meta and album_meta.get("cover") and not og_image:
                og_image = album_meta["cover"]

        is_album = album_meta is not None or og_type == "music.album"
        category = infer_category(
            slug=name,
            og_type=og_type,
            topics=topics,
            title=title,
            description=description,
            is_album=is_album,
        )

        record: dict[str, Any] = {
            "slug": name,
            "url": pages_url,
            "path": urllib.parse.urlparse(pages_url).path or "/",
            "title": title,
            "raw_title": raw_title,
            "description": description,
            "image": og_image,
            "theme_color": meta.get("theme_color", ""),
            "og_type": og_type,
            "kind": "album" if is_album else ("guide" if category == "writing" else "site"),
            "category": category,
            "source": "repository",
            "repository": repo.get("html_url"),
            "language": repo.get("language") or "",
            "topics": topics,
            "pushed_at": repo.get("pushed_at") or "",
            "first_seen": prev.get("first_seen", today),
            "last_seen": today if is_live else prev.get("last_seen", today),
            "http_status": http_status,
            "pages_status": pages_status or ("built" if is_live else "unknown"),
            "status": "published" if is_live else "unpublished",
        }
        if album_meta:
            record["album"] = album_meta

        records[key] = record

    # 2. Discover standalone subsites inside davuses.github.io (e.g., /music/, /intelligence-age/)
    for index_file in sorted(ROOT.glob("*/index.html")):
        folder = index_file.parent.name
        if folder.startswith((".", "_")) or folder in IGNORED_SUBDIRS:
            continue

        pages_url = f"{BASE_URL}{urllib.parse.quote(folder)}/"
        key = pages_url.lower()
        seen_subsite_keys.add(key)
        prev = previous_by_key.get(key, {})

        raw_html = index_file.read_text(encoding="utf-8", errors="replace")
        meta = parse_html_metadata(raw_html, pages_url)
        title = meta.get("og_title") or meta.get("html_title") or folder
        description = meta.get("html_description") or ""
        og_image = meta.get("og_image") or ""
        og_type = meta.get("og_type") or ""

        is_album = og_type == "music.album"
        category = infer_category(
            slug=folder,
            og_type=og_type,
            topics=[],
            title=title,
            description=description,
            is_album=is_album,
        )

        # Subsites in davuses.github.io deploy with this repo; optionally verify live too
        http_status = 200
        records[key] = {
            "slug": folder,
            "url": pages_url,
            "path": f"/{urllib.parse.quote(folder)}/",
            "title": title,
            "raw_title": meta.get("html_title") or title,
            "description": description,
            "image": og_image,
            "theme_color": meta.get("theme_color", ""),
            "og_type": og_type,
            "kind": "hub" if folder.lower() == "music" else ("guide" if category == "writing" else "site"),
            "category": category,
            "source": "subsite",
            "repository": f"https://github.com/{OWNER}/{OWNER}.github.io",
            "language": "HTML",
            "topics": [],
            "pushed_at": "",
            "first_seen": prev.get("first_seen", today),
            "last_seen": today,
            "http_status": http_status,
            "pages_status": "built",
            "status": "published",
        }

    # 3. Preserve historical entries (and preserve repository entries if API failed)
    for key, prev in previous_by_key.items():
        if key in records:
            continue
        preserved = dict(prev)
        if preserved.get("source") == "repository" and not repos_fetch_ok:
            # Keep last known status intact when GitHub API was temporarily unavailable
            records[key] = preserved
        else:
            preserved["status"] = "retired"
            records[key] = preserved

    sorted_sites = sorted(records.values(), key=lambda x: (x.get("slug") or x["url"]).lower())

    return {
        "schema_version": 2,
        "owner": OWNER,
        "base_url": BASE_URL,
        "generated_at": now_iso,
        "discovery_warnings": warnings,
        "sites": sorted_sites,
    }


def main() -> int:
    existing = SITES_FILE.read_text(encoding="utf-8") if SITES_FILE.exists() else ""
    payload = discover()

    # Keep git diffs clean: if nothing in `sites` changed (ignoring generated_at), keep existing generated_at
    if existing:
        try:
            old_data = json.loads(existing)
            if isinstance(old_data, dict) and old_data.get("sites") == payload["sites"]:
                payload["generated_at"] = old_data.get("generated_at", payload["generated_at"])
        except Exception:
            pass

    rendered = json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    if rendered != existing:
        SITES_FILE.write_text(rendered, encoding="utf-8")
        print(f"Updated {SITES_FILE.name}: {len(payload['sites'])} total entries.")
    else:
        print(f"No changes to {SITES_FILE.name} ({len(payload['sites'])} entries).")

    published = [s for s in payload["sites"] if s.get("status") == "published"]
    print(f"Published sites ({len(published)}): " + ", ".join(s["slug"] for s in published))
    if payload["discovery_warnings"]:
        print("Warnings:", "; ".join(payload["discovery_warnings"]), file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
