(function () {
  const grid = document.getElementById('pagesGrid');
  const filterBar = document.getElementById('filterBar');
  const pagesSub = document.getElementById('pagesSub');
  const footerStatus = document.getElementById('footerStatus');
  const themeBtn = document.getElementById('themeToggle');

  const ARROW_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="14" height="14" aria-hidden="true">' +
    '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';

  const BESPOKE_BANNERS = {
    turnriver: {
      cls: 'banner-turnriver',
      svg:
        '<svg class="banner-mark" viewBox="0 0 64 64" width="44" height="44" aria-hidden="true">' +
        '<path d="M32 10C23 21 13 28 13 37c0 6 4.6 10.4 10.3 10.4 3.3 0 6-1.4 7.3-3.5-.3 3.9-1.7 7.1-4.6 9.6h12c-2.9-2.5-4.3-5.7-4.6-9.6 1.3 2.1 4 3.5 7.3 3.5 5.7 0 10.3-4.4 10.3-10.4 0-9-10-16-19-27z" fill="currentColor"/></svg>',
    },
    onelaw: {
      cls: 'banner-onelaw',
      svg:
        '<svg class="banner-wave" viewBox="0 0 240 72" fill="none" aria-hidden="true">' +
        '<path d="M0 36 C 30 8, 60 8, 90 36 C 120 64, 150 64, 180 36 C 200 18, 220 18, 240 36" stroke="currentColor" stroke-width="1.8" stroke-opacity="0.85"/>' +
        '<path d="M0 36 C 40 60, 80 12, 120 36 C 160 60, 200 12, 240 36" stroke="#8cc4e4" stroke-width="1.2" stroke-opacity="0.55"/>' +
        '<circle cx="90" cy="36" r="3.5" fill="currentColor"/><circle cx="180" cy="36" r="3.5" fill="#7fd4ae"/></svg>',
    },
    quickdecide: {
      cls: 'banner-quickdecide',
      svg:
        '<svg class="banner-mark" viewBox="0 0 64 64" width="44" height="44" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<circle cx="32" cy="32" r="20" stroke-opacity="0.35"/>' +
        '<path d="M22 36 L32 18 L42 36 L32 32 Z" fill="currentColor" fill-opacity="0.22"/>' +
        '<circle cx="32" cy="32" r="3.2" fill="currentColor"/></svg>',
    },
    editorial: {
      cls: 'banner-editorial',
      svg:
        '<svg class="banner-mark" viewBox="0 0 64 64" width="44" height="44" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M14 18c6-3 12-3 18 1 6-4 12-4 18-1v28c-6-3-12-3-18 1-6-4-12-4-18-1V18z" fill="currentColor" fill-opacity="0.10"/>' +
        '<line x1="32" y1="19" x2="32" y2="47"/></svg>',
    },
  };

  const CATEGORY_ICONS = {
    apps:
      '<svg class="banner-mark" viewBox="0 0 64 64" width="42" height="42" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<rect x="12" y="14" width="40" height="36" rx="7" fill="currentColor" fill-opacity="0.12"/>' +
      '<line x1="12" y1="24" x2="52" y2="24"/><circle cx="19" cy="19" r="1.4" fill="currentColor"/><circle cx="25" cy="19" r="1.4" fill="currentColor"/>' +
      '<path d="M24 35l4 4 12-10"/></svg>',
    interactive:
      '<svg class="banner-wave" viewBox="0 0 240 72" fill="none" aria-hidden="true">' +
      '<path d="M0 36 Q 30 12 60 36 T 120 36 T 180 36 T 240 36" stroke="currentColor" stroke-width="1.9" stroke-opacity="0.85"/>' +
      '<circle cx="120" cy="36" r="4" fill="currentColor"/><circle cx="120" cy="36" r="14" stroke="currentColor" stroke-opacity="0.3"/></svg>',
    writing:
      '<svg class="banner-mark" viewBox="0 0 64 64" width="42" height="42" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M14 18c6-3 12-3 18 1 6-4 12-4 18-1v28c-6-3-12-3-18 1-6-4-12-4-18-1V18z" fill="currentColor" fill-opacity="0.12"/>' +
      '<line x1="32" y1="19" x2="32" y2="47"/></svg>',
    music:
      '<svg class="banner-mark" viewBox="0 0 64 64" width="42" height="42" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<circle cx="32" cy="32" r="19" fill="currentColor" fill-opacity="0.10"/>' +
      '<circle cx="32" cy="32" r="5" fill="currentColor"/>' +
      '<path d="M32 18a14 14 0 0 1 14 14" stroke-opacity="0.6"/></svg>',
  };

  function hashSlug(str) {
    let h = 0;
    for (let i = 0; i < str.length; i += 1) {
      h = (h * 31 + str.charCodeAt(i)) >>> 0;
    }
    return h;
  }

  function safeUrl(raw) {
    if (!raw) return '#';
    if (raw.startsWith('/')) return raw;
    try {
      const parsed = new URL(raw);
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.href;
    } catch (_) {}
    return '#';
  }

  function toSiteHref(site) {
    if (site.path && site.path.startsWith('/')) {
      try {
        const u = new URL(site.url);
        if (u.hostname === 'davuses.github.io') return site.path;
      } catch (_) {}
    }
    return safeUrl(site.url);
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function readInlineJson(id) {
    const script = document.getElementById(id);
    if (!script || !script.textContent) return null;
    try {
      return JSON.parse(script.textContent);
    } catch (_) {
      return null;
    }
  }

  async function loadData() {
    const inlineSites = readInlineJson('sites-data');
    const inlineOverrides = readInlineJson('overrides-data');
    if (inlineSites) {
      return {
        registry: inlineSites,
        overrides: inlineOverrides || {},
      };
    }

    const [sitesResp, overridesResp] = await Promise.all([
      fetch('/sites.json', { cache: 'no-cache' }),
      fetch('/site-overrides.json', { cache: 'no-cache' }).catch(() => null),
    ]);
    if (!sitesResp.ok) throw new Error('Unable to load sites.json');
    const registry = await sitesResp.json();
    const overrides = overridesResp && overridesResp.ok ? await overridesResp.json() : {};
    return { registry, overrides };
  }

  function defaultTag(site, categoryLabels) {
    if (site.tag) return site.tag;
    if (site.kind === 'album' && site.album && site.album.track_count) {
      return `ALBUM · ${site.album.track_count} TRACKS`;
    }
    if (site.kind === 'guide') return 'GUIDE · ESSAY';
    const cat = (categoryLabels[site.category] || 'WEB PAGE').toUpperCase();
    const lang = site.language ? ` · ${site.language.toUpperCase()}` : '';
    return `${cat}${lang}`;
  }

  function defaultSubtitle(site) {
    if (site.subtitle) return site.subtitle;
    if (site.kind === 'album' && site.album) {
      const parts = [];
      if (site.album.track_count) parts.push(`${site.album.track_count} tracks`);
      if (site.album.duration) parts.push(site.album.duration);
      if (site.album.bpm_range) parts.push(site.album.bpm_range);
      if (parts.length) return parts.join(' · ');
    }
    if (site.raw_title && site.raw_title !== site.title) {
      const split = site.raw_title.split(/\s+[—–-]\s+/);
      if (split.length > 1) return split.slice(1).join(' — ');
    }
    return site.source === 'subsite' ? 'Standalone Web Page' : 'GitHub Pages Project';
  }

  function defaultCta(site) {
    if (site.cta) return site.cta;
    if (site.kind === 'album') return 'Open Album';
    if (site.kind === 'guide') return 'Read Guide';
    if (site.category === 'interactive') return 'Launch';
    return 'Open App';
  }

  function renderStandardCard(site, categoryLabels) {
    const href = toSiteHref(site);
    const card = el('article', 'page-card');
    card.dataset.category = site.category || 'apps';
    card.dataset.kind = 'regular';

    const banner = el('a', 'card-banner');
    banner.href = href;
    banner.setAttribute('aria-label', `Open ${site.title}`);

    const bespoke = site.banner && BESPOKE_BANNERS[site.banner];
    const artwork = !bespoke && (site.cover || site.image);

    if (bespoke) {
      banner.classList.add(bespoke.cls);
      banner.innerHTML = bespoke.svg;
    } else if (artwork) {
      banner.classList.add('banner-artwork');
      const img = document.createElement('img');
      img.className = 'banner-artwork-img';
      img.src = artwork;
      img.alt = `${site.title} preview artwork`;
      img.loading = 'lazy';
      banner.appendChild(img);
    } else {
      const idx = hashSlug(site.slug || site.title) % 5;
      banner.classList.add(`banner-auto-${idx}`);
      banner.innerHTML = CATEGORY_ICONS[site.category] || CATEGORY_ICONS.apps;
    }

    banner.prepend(el('span', 'banner-tag', defaultTag(site, categoryLabels)));
    banner.appendChild(el('span', 'banner-path', site.path || `/${site.slug}/`));

    const body = el('div', 'card-body');
    const titleEl = el('h3', 'card-title');
    const titleLink = el('a', null, site.title);
    titleLink.href = href;
    titleEl.appendChild(titleLink);

    const sub = el('p', 'card-subtitle', defaultSubtitle(site));
    const desc = el('p', 'card-desc', site.description || 'Published on davuses.github.io.');

    const actions = el('div', 'card-actions');
    const openBtn = el('a', 'btn-primary');
    openBtn.href = href;
    openBtn.innerHTML = `<span></span>${ARROW_SVG}`;
    openBtn.querySelector('span').textContent = defaultCta(site);
    actions.appendChild(openBtn);

    if (site.repository && site.source === 'repository') {
      const srcBtn = el('a', 'btn-ghost', 'Source');
      srcBtn.href = safeUrl(site.repository);
      srcBtn.target = '_blank';
      srcBtn.rel = 'noopener noreferrer';
      actions.appendChild(srcBtn);
    }

    body.append(titleEl, sub, desc, actions);
    card.append(banner, body);
    return card;
  }

  function renderFeaturedMusicCard(groupCfg, members, extraAlbumCount) {
    const card = el('article', 'page-card music-feature');
    card.dataset.category = groupCfg.category || 'music';
    card.dataset.kind = 'featured';

    const copy = el('div', 'music-feature-copy');
    const top = el('div', 'music-feature-top');
    top.append(
      el('span', 'music-badge', groupCfg.badge || 'MUSIC · OPENBAND CONCEPT SERIES'),
      el('span', 'music-path', groupCfg.path || '/music/')
    );

    const titleEl = el('h3', 'card-title');
    const titleLink = el('a', null, groupCfg.title || 'Seasonal Tapes');
    titleLink.href = groupCfg.url || '/music/';
    titleEl.appendChild(titleLink);

    const totalTracks = members.reduce(
      (sum, m) => sum + ((m.album && m.album.track_count) || 6),
      0
    );
    const extraNote = extraAlbumCount > 0 ? ` · +${extraAlbumCount} more in hub` : '';
    const subtitleText =
      groupCfg.subtitle ||
      `${members.length} Full-Day Concept Albums · ${totalTracks} Tracks · Live A/B Engine Player${extraNote}`;

    const descEl = el('p', 'card-desc', groupCfg.description || '');

    const links = el('div', 'music-links');
    const hubBtn = el('a', 'btn-primary');
    hubBtn.href = groupCfg.url || '/music/';
    hubBtn.innerHTML = `<span></span>${ARROW_SVG}`;
    hubBtn.querySelector('span').textContent = groupCfg.cta || 'Open Music Hub';
    links.appendChild(hubBtn);

    members.forEach((album) => {
      const season = album.season || 'default';
      const chip = el('a', `btn-album ${season}-chip`);
      chip.href = toSiteHref(album);
      chip.append(el('span', `dot ${season}-dot`), el('span', null, album.title));
      links.appendChild(chip);
    });

    copy.append(top, titleEl, el('p', 'card-subtitle', subtitleText), descEl, links);

    const covers = el('div', 'music-covers');
    members.slice(0, 4).forEach((album, idx) => {
      const a = el('a', 'mini-cover');
      a.href = toSiteHref(album);
      a.setAttribute('aria-label', `Open ${album.title}`);

      const img = document.createElement('img');
      img.src = album.cover || album.image || `/${album.slug}/cover.jpg`;
      img.alt = `${album.title} album cover`;
      img.loading = 'lazy';

      const label = album.season_label || `Album · 0${idx + 1}`;
      a.append(img, el('span', 'mini-cover-label', label));
      covers.appendChild(a);
    });

    card.append(copy, covers);
    return card;
  }

  function updateGridColumns(activeCategory) {
    const visibleRegular = Array.from(grid.querySelectorAll('.page-card[data-kind="regular"]')).filter(
      (c) => !c.classList.contains('is-hidden')
    );
    // Keep 2-col for 2 or 4 regular cards so there is never an orphan card; 3-col for 3 or 5+
    const cols = visibleRegular.length === 2 || visibleRegular.length === 4 ? '2' : '3';
    grid.dataset.cols = activeCategory === 'music' ? '2' : cols;
  }

  function wireFilters(categories, presentCategories) {
    filterBar.replaceChildren();
    const allBtn = el('button', 'filter-pill active', 'All');
    allBtn.type = 'button';
    allBtn.dataset.filter = 'all';
    allBtn.setAttribute('role', 'tab');
    allBtn.setAttribute('aria-selected', 'true');
    filterBar.appendChild(allBtn);

    categories.forEach((cat) => {
      if (!presentCategories.has(cat.id)) return;
      const btn = el('button', 'filter-pill', cat.label);
      btn.type = 'button';
      btn.dataset.filter = cat.id;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', 'false');
      filterBar.appendChild(btn);
    });

    const buttons = Array.from(filterBar.querySelectorAll('.filter-pill'));
    const cards = Array.from(grid.querySelectorAll('.page-card'));

    function applyFilter(category) {
      buttons.forEach((btn) => {
        const isActive = btn.dataset.filter === category;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', String(isActive));
      });
      cards.forEach((card) => {
        const match = category === 'all' || card.dataset.category === category;
        card.classList.toggle('is-hidden', !match);
      });
      updateGridColumns(category);
    }

    buttons.forEach((btn) => {
      btn.addEventListener('click', () => applyFilter(btn.dataset.filter));
    });
    updateGridColumns('all');
  }

  async function init() {
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        if (isDark) {
          document.documentElement.removeAttribute('data-theme');
          localStorage.setItem('davuses-theme', 'light');
        } else {
          document.documentElement.setAttribute('data-theme', 'dark');
          localStorage.setItem('davuses-theme', 'dark');
        }
      });
    }

    try {
      const { registry, overrides } = await loadData();
      const rawSites = Array.isArray(registry) ? registry : registry.sites || [];
      const siteOverrides = overrides.sites || {};
      const featuredGroups = overrides.featured_groups || {};
      const categoryDefs = overrides.categories || [
        { id: 'apps', label: 'Apps & Tools' },
        { id: 'interactive', label: 'Interactive' },
        { id: 'writing', label: 'Writing & Guides' },
        { id: 'music', label: 'Music' },
      ];
      const categoryLabels = {};
      categoryDefs.forEach((c) => {
        categoryLabels[c.id] = c.label;
      });

      const published = rawSites
        .filter((s) => s && (s.status === 'published' || s.status === 'discovered'))
        .map((s) => {
          const slug = s.slug || new URL(s.url).pathname.replace(/^\/|\/$/g, '');
          const ov = siteOverrides[slug] || {};
          return Object.assign({}, s, { slug }, ov);
        })
        .filter((s) => !s.hidden);

      const groupBuckets = {};
      const standaloneCards = [];
      let extraMusicAlbums = 0;

      published.forEach((site) => {
        if (site.group_hub && featuredGroups[site.group_hub]) {
          return; // Represented by the featured group card
        }
        if (site.group && featuredGroups[site.group]) {
          if (!groupBuckets[site.group]) groupBuckets[site.group] = [];
          groupBuckets[site.group].push(site);
          return;
        }
        if (site.kind === 'album') {
          extraMusicAlbums += 1;
        }
        standaloneCards.push(site);
      });

      standaloneCards.sort((a, b) => {
        const oa = typeof a.order === 'number' ? a.order : 500;
        const ob = typeof b.order === 'number' ? b.order : 500;
        if (oa !== ob) return oa - ob;
        return (b.pushed_at || b.first_seen || '').localeCompare(a.pushed_at || a.first_seen || '') ||
          a.title.localeCompare(b.title);
      });

      const presentCategories = new Set();
      grid.replaceChildren();

      standaloneCards.forEach((site) => {
        presentCategories.add(site.category || 'apps');
        grid.appendChild(renderStandardCard(site, categoryLabels));
      });

      Object.entries(featuredGroups)
        .sort((a, b) => (a[1].order || 100) - (b[1].order || 100))
        .forEach(([groupId, groupCfg]) => {
          const members = (groupBuckets[groupId] || []).sort(
            (a, b) => (a.order || 99) - (b.order || 99)
          );
          if (!members.length) return;
          presentCategories.add(groupCfg.category || 'music');
          grid.appendChild(renderFeaturedMusicCard(groupCfg, members, extraMusicAlbums));
        });

      if (!grid.children.length) {
        grid.appendChild(el('p', 'grid-status', 'No published GitHub Pages sites discovered yet.'));
      }

      wireFilters(categoryDefs, presentCategories);

      if (pagesSub) {
        const totalDestinations = published.filter((s) => !s.group_hub).length;
        pagesSub.textContent = `${totalDestinations} live destinations synced automatically from GitHub Pages`;
      }
      if (footerStatus && registry.generated_at) {
        const day = String(registry.generated_at).slice(0, 10);
        footerStatus.textContent = `davuses.github.io · synced ${day}`;
      }
    } catch (err) {
      grid.replaceChildren(
        el(
          'p',
          'grid-status',
          'Unable to load the site directory right now. Refresh in a moment or browse github.com/davuses.'
        )
      );
    }
  }

  init();
})();
