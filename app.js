(function () {
  const filterButtons = Array.from(document.querySelectorAll('.filter-pill'));
  const cards = Array.from(document.querySelectorAll('.page-card'));
  const themeBtn = document.getElementById('themeToggle');

  function applyFilter(category) {
    filterButtons.forEach((btn) => {
      const isActive = btn.dataset.filter === category;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', String(isActive));
    });

    cards.forEach((card) => {
      const match = category === 'all' || card.dataset.category === category;
      card.classList.toggle('is-hidden', !match);
    });
  }

  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => applyFilter(btn.dataset.filter));
  });

  themeBtn.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const next = isDark ? 'light' : 'dark';
    if (next === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('davuses-theme', next);
  });
})();
