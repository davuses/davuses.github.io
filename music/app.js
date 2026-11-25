(function () {
  const audio = document.getElementById('previewAudio');
  const seasonalGrid = document.getElementById('seasonalGrid');
  const extraSection = document.getElementById('extraSection');
  const extraGrid = document.getElementById('extraGrid');
  const eyebrow = document.getElementById('musicEyebrow');
  const footerMeta = document.getElementById('musicFooterMeta');
  const shareBtn = document.getElementById('shareHubBtn');
  const shareLabel = document.getElementById('shareHubLabel');

  const ARROW_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="15" height="15">' +
    '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>';
  const PLAY_SVG =
    '<svg class="ic-play" viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M8 5v14l11-7z"/></svg>' +
    '<svg class="ic-pause hidden" viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>';

  let activeCard = null;

  function setMood(mood) {
    document.documentElement.setAttribute('data-mood', mood || 'neutral');
  }

  function resetCardUI(card) {
    card.classList.remove('playing');
    const icPlay = card.querySelector('.ic-play');
    const icPause = card.querySelector('.ic-pause');
    const lbl = card.querySelector('.preview-label');
    const fill = card.querySelector('.preview-fill');
    if (icPlay) icPlay.classList.remove('hidden');
    if (icPause) icPause.classList.add('hidden');
    if (lbl) lbl.textContent = card.dataset.defaultLabel || 'Preview';
    if (fill) fill.style.width = '0%';
  }

  function stopPreview() {
    audio.pause();
    audio.currentTime = 0;
    if (activeCard) {
      resetCardUI(activeCard);
      activeCard = null;
    }
    setMood('neutral');
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
      return { registry: inlineSites, overrides: inlineOverrides || {} };
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

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function pad2(n) {
    return n < 10 ? `0${n}` : String(n);
  }

  function resolvePreview(album) {
    const meta = album.album || {};
    const tracks = meta.tracks || [];
    const desiredNum = album.preview_track || meta.preview_track || 1;
    const chosen = tracks.find((t) => t.num === desiredNum) || tracks[0];

    if (chosen && chosen.audio) {
      const cleanTitle = chosen.title.replace(/\s*\([^)]*\)\s*$/, '').trim() || chosen.title;
      return {
        audioUrl: chosen.audio,
        trackNum: chosen.num,
        title: cleanTitle,
      };
    }
    if (meta.preview_audio) {
      return {
        audioUrl: meta.preview_audio,
        trackNum: meta.preview_track || 1,
        title: meta.preview_title || album.title,
      };
    }
    return null;
  }

  function buildAlbumCard(album, index, isSeasonal) {
    const meta = album.album || {};
    const mood = album.season || (index % 2 === 0 ? 'dusk' : 'sage');
    const href = album.path || `/${album.slug}/`;
    const preview = resolvePreview(album);
    const defaultLabel = preview ? `Preview Track ${preview.trackNum}` : '';

    const card = el('article', 'album-card');
    card.dataset.album = mood;
    if (preview) {
      card.dataset.preview = preview.audioUrl;
      card.dataset.previewTitle = preview.title;
      card.dataset.defaultLabel = defaultLabel;
    }

    // Cover Frame
    const coverLink = el('a', 'cover-link');
    coverLink.href = href;
    coverLink.setAttribute('aria-label', `Open ${album.title} album`);

    const frame = el('div', 'cover-frame');
    const coverSrc = album.cover || album.image || meta.cover || '';
    if (coverSrc) {
      const img = document.createElement('img');
      img.className = 'cover-img';
      img.src = coverSrc;
      img.alt = `${album.title} album cover`;
      img.loading = index < 2 ? 'eager' : 'lazy';
      frame.appendChild(img);
    } else {
      const fb = el('div', 'cover-fallback');
      fb.innerHTML =
        '<svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="currentColor" stroke-width="2">' +
        '<circle cx="32" cy="32" r="22"/><circle cx="32" cy="32" r="6" fill="currentColor"/></svg>';
      frame.appendChild(fb);
    }

    const badgeText = isSeasonal
      ? (album.season_label || `ALBUM · ${pad2(index + 1)}`).toUpperCase()
      : `RELEASE · ${pad2(index + 1)}`;
    frame.appendChild(el('span', `season-pill ${mood}-pill`, badgeText));

    const arcText = album.arc || meta.arc || '';
    if (arcText) {
      frame.appendChild(el('span', 'arc-pill', arcText));
    }
    coverLink.appendChild(frame);

    // Body
    const body = el('div', 'card-body');
    const head = el('div', 'card-head');
    const headInner = document.createElement('div');
    const titleEl = el('h2', 'card-title');
    const titleA = el('a', null, album.title);
    titleA.href = href;
    titleEl.appendChild(titleA);

    const metaParts = [];
    if (meta.track_count) metaParts.push(`${meta.track_count} tracks`);
    if (meta.duration) metaParts.push(meta.duration);
    if (meta.bpm_range) metaParts.push(meta.bpm_range);
    if (album.genre) metaParts.push(album.genre);
    const metaEl = el('p', 'card-meta', metaParts.join(' · ') || 'OpenBand Concept Album');

    headInner.append(titleEl, metaEl);
    head.appendChild(headInner);

    const descEl = el('p', 'card-desc', album.description || '');
    body.append(head, descEl);

    // Clickable Mini Tracklist (auto-populated from album-data.json)
    const tracks = meta.tracks || [];
    if (tracks.length) {
      const list = el('ol', 'mini-tracks');
      tracks.forEach((tr) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `${href}#track=${tr.num}`;
        const numSpan = el('span', null, pad2(tr.num));
        const rightMeta = [tr.bpm ? `${tr.bpm} BPM` : '', tr.key || ''].filter(Boolean).join(' · ');
        a.append(numSpan, document.createTextNode(tr.title), el('em', null, rightMeta));
        li.appendChild(a);
        list.appendChild(li);
      });
      body.appendChild(list);
    }

    // Preview progress bar
    const strip = el('div', 'preview-strip');
    const bar = el('div', 'preview-bar');
    bar.appendChild(el('div', 'preview-fill'));
    strip.appendChild(bar);
    body.appendChild(strip);

    // Actions
    const actions = el('div', 'card-actions');
    const openBtn = el('a', `btn-open ${mood}-btn`);
    openBtn.href = href;
    openBtn.innerHTML = `<span>Open Album</span>${ARROW_SVG}`;
    actions.appendChild(openBtn);

    if (preview) {
      const previewBtn = el('button', 'btn-preview');
      previewBtn.type = 'button';
      previewBtn.setAttribute('aria-label', `Preview ${preview.title}`);
      previewBtn.innerHTML = `${PLAY_SVG}<span class="preview-label"></span>`;
      previewBtn.querySelector('.preview-label').textContent = defaultLabel;
      actions.appendChild(previewBtn);
    }

    body.appendChild(actions);
    card.append(coverLink, body);
    return card;
  }

  function wireCards(cards) {
    cards.forEach((card) => {
      const mood = card.dataset.album;
      const btn = card.querySelector('.btn-preview');

      card.addEventListener('mouseenter', () => {
        if (!activeCard) setMood(mood);
      });
      card.addEventListener('mouseleave', () => {
        if (!activeCard) setMood('neutral');
      });

      if (!btn || !card.dataset.preview) return;
      const icPlay = card.querySelector('.ic-play');
      const icPause = card.querySelector('.ic-pause');
      const lbl = card.querySelector('.preview-label');

      btn.addEventListener('click', () => {
        if (activeCard === card && !audio.paused) {
          stopPreview();
          return;
        }
        if (activeCard && activeCard !== card) {
          resetCardUI(activeCard);
        }
        activeCard = card;
        card.classList.add('playing');
        icPlay.classList.add('hidden');
        icPause.classList.remove('hidden');
        lbl.textContent = `Playing · ${card.dataset.previewTitle}`;
        setMood(mood);

        if (audio.getAttribute('src') !== card.dataset.preview) {
          audio.src = card.dataset.preview;
        }
        audio.play().catch(() => {
          stopPreview();
        });
      });
    });
  }

  audio.addEventListener('timeupdate', () => {
    if (!activeCard || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const pct = Math.min(100, (audio.currentTime / audio.duration) * 100);
    const fill = activeCard.querySelector('.preview-fill');
    if (fill) fill.style.width = `${pct.toFixed(1)}%`;
  });

  audio.addEventListener('ended', stopPreview);

  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const url = window.location.origin + window.location.pathname;
      try {
        await navigator.clipboard.writeText(url);
        shareLabel.textContent = 'Link Copied!';
        setTimeout(() => { shareLabel.textContent = 'Copy Hub Link'; }, 1800);
      } catch (_) {
        window.prompt('Copy hub link:', url);
      }
    });
  }

  async function init() {
    try {
      const { registry, overrides } = await loadData();
      const rawSites = Array.isArray(registry) ? registry : registry.sites || [];
      const siteOverrides = overrides.sites || {};

      const albums = rawSites
        .filter((s) => s && (s.status === 'published' || s.status === 'discovered'))
        .map((s) => {
          const slug = s.slug || new URL(s.url).pathname.replace(/^\/|\/$/g, '');
          const ov = siteOverrides[slug] || {};
          return Object.assign({}, s, { slug }, ov);
        })
        .filter((s) => !s.hidden && s.kind === 'album');

      const seasonal = albums
        .filter((a) => a.group === 'seasonal-tapes')
        .sort((a, b) => (a.order || 99) - (b.order || 99));

      const extra = albums
        .filter((a) => a.group !== 'seasonal-tapes')
        .sort((a, b) => (b.first_seen || '').localeCompare(a.first_seen || '') || a.title.localeCompare(b.title));

      seasonalGrid.replaceChildren();
      const allCards = [];

      seasonal.forEach((album, idx) => {
        const card = buildAlbumCard(album, idx, true);
        seasonalGrid.appendChild(card);
        allCards.push(card);
      });

      if (extra.length) {
        extraSection.classList.remove('hidden');
        extraGrid.replaceChildren();
        extra.forEach((album, idx) => {
          const card = buildAlbumCard(album, idx, false);
          extraGrid.appendChild(card);
          allCards.push(card);
        });
      } else {
        extraSection.classList.add('hidden');
      }

      wireCards(allCards);

      const totalAlbums = albums.length;
      const totalTracks = albums.reduce((sum, a) => sum + ((a.album && a.album.track_count) || 0), 0);
      if (eyebrow) {
        const trackPart = totalTracks ? ` · ${totalTracks} TRACKS` : '';
        eyebrow.textContent = `OPENBAND CONCEPT SERIES · ${totalAlbums} ALBUMS${trackPart}`;
      }
      if (footerMeta) {
        footerMeta.textContent = extra.length
          ? `Four Seasons Collection + ${extra.length} additional release${extra.length === 1 ? '' : 's'}`
          : 'Four Seasons Concept Collection (Spring · Summer · Autumn · Winter)';
      }
    } catch (_) {
      seasonalGrid.replaceChildren(
        el('p', 'empty-note', 'Unable to load the album catalog right now. Please refresh in a moment.')
      );
    }
  }

  init();
})();
