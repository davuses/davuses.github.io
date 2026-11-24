(function () {
  const audio = document.getElementById('previewAudio');
  const cards = Array.from(document.querySelectorAll('.album-card'));
  const shareBtn = document.getElementById('shareHubBtn');
  const shareLabel = document.getElementById('shareHubLabel');

  let activeCard = null;

  function setMood(mood) {
    document.documentElement.setAttribute('data-mood', mood || 'neutral');
  }

  function resetCardUI(card) {
    card.classList.remove('playing');
    card.querySelector('.ic-play').classList.remove('hidden');
    card.querySelector('.ic-pause').classList.add('hidden');
    card.querySelector('.preview-label').textContent = card.dataset.defaultLabel || 'Preview';
    card.querySelector('.preview-fill').style.width = '0%';
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

  cards.forEach((card) => {
    const mood = card.dataset.album;
    const btn = card.querySelector('.btn-preview');
    const icPlay = card.querySelector('.ic-play');
    const icPause = card.querySelector('.ic-pause');
    const lbl = card.querySelector('.preview-label');

    card.addEventListener('mouseenter', () => {
      if (!activeCard) setMood(mood);
    });
    card.addEventListener('mouseleave', () => {
      if (!activeCard) setMood('neutral');
    });

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

  audio.addEventListener('timeupdate', () => {
    if (!activeCard || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const pct = Math.min(100, (audio.currentTime / audio.duration) * 100);
    activeCard.querySelector('.preview-fill').style.width = `${pct.toFixed(1)}%`;
  });

  audio.addEventListener('ended', stopPreview);

  shareBtn.addEventListener('click', async () => {
    const url = window.location.origin + window.location.pathname;
    try {
      await navigator.clipboard.writeText(url);
      shareLabel.textContent = 'Link Copied!';
      setTimeout(() => { shareLabel.textContent = 'Copy Hub Link'; }, 1800);
    } catch {
      window.prompt('Copy hub link:', url);
    }
  });
})();
