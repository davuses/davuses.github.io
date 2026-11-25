# davuses.github.io

Self-maintaining entry point for all published GitHub Pages websites under `davuses`, including an auto-updating `/music/` album hub.

## How it works

1. **Discovery (`scripts/discover-sites.py`)**
   - Uses Python stdlib only (no external packages) and authenticates with `GITHUB_TOKEN`.
   - Paginates public repositories under `davuses` with `has_pages == true` and verifies each live URL (`HTTP 200`).
   - Scans standalone subsites inside `davuses.github.io` (`*/index.html`, e.g. `/music/`, `/intelligence-age/`).
   - Extracts `<title>`, `<meta name="description">`, `og:image`, `og:type`, and (for `music.album` sites) full tracklists & audio preview paths from `album-data.json`.
   - Writes `sites.json` while preserving historical records and keeping the last valid registry intact if GitHub API or network checks temporarily fail.
2. **Optional Customization (`site-overrides.json`)**
   - Strictly optional overrides for bespoke banners, custom titles/descriptions, ordering, featured groups (like `seasonal-tapes`), or `"hidden": true`.
   - New websites and new albums require **zero** entries here to appear with consistent styling.
3. **Build & Deploy (`scripts/build-site.py` + `.github/workflows/pages.yml`)**
   - Runs on every push to `main`, every 4 hours on schedule, and on manual `workflow_dispatch`.
   - Commits `sites.json` only when discovered content changes, assembles a clean `_site/` artifact (excluding `scripts/` and `.github/`), inlines `sites.json` + `site-overrides.json` for zero-flash first paint, and deploys directly via `actions/deploy-pages`.

## Publishing a new site or album

- **Subsite inside `davuses.github.io`:** Push `<folder>/index.html` to `main` — appears automatically on `/` within ~1 minute.
- **Separate GitHub Pages repository:** Enable GitHub Pages and include `<title>`, `<meta name="description">`, and (optional) `<meta property="og:image">`. It will appear on the next scheduled run (every 4 hours) or immediately when you trigger **Discover & Deploy Pages** (`gh workflow run pages.yml -R davuses/davuses.github.io`).
- **New OpenBand album repository:** Include `<meta property="og:type" content="music.album">`, `<meta property="og:image" content="cover.jpg">`, and `album-data.json` (plus `← All Albums` pointing to `../music/`). It will automatically appear on **both** `/` (under **Music**) and `/music/` (with cover art, clickable tracklist, and inline MP3 preview).

## Known limitations

- Private repositories are intentionally ignored so no private metadata is exposed.
- Separate repositories cannot automatically trigger a push webhook in `davuses.github.io` without per-repo tokens, so new separate repos appear on the 4-hour schedule or via manual `workflow_dispatch`.
- Custom domains on separate repos are verified only if reachable over HTTPS (`HTTP 200`).
