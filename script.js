/* ═══════════════════════════════════════════════════════════
   NETFLIX CLONE — script.js (v3 — Infinite Slider + Hover Premium)
   1. Configurações e estado global
   2. Utilitários
   3. API TMDB
   4. Billboard
   5. Cards e fileiras
   6. Busca dinâmica
   7. Navbar scroll
   8. Inicialização
═══════════════════════════════════════════════════════════ */


/* ── 1. CONFIGURAÇÕES E ESTADO GLOBAL ── */

const IMG_BASE = 'https://image.tmdb.org/t/p/';
const IMG_W500 = IMG_BASE + 'w500';
const IMG_ORIG = IMG_BASE + 'original';

const API_KEY = 'db36709836da3a30746262b6fc1e7743';
let isMuted = true;


/* ── 2. UTILITÁRIOS ── */

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

function randomMatch() { return Math.floor(70 + Math.random() * 29); }
function extractYear(d) { return d ? d.slice(0, 4) : ''; }

/** Lê --cols do breakpoint CSS ativo. */
function getCols() {
  return parseInt(
    getComputedStyle(document.documentElement).getPropertyValue('--cols').trim()
  ) || 6;
}


/* ── 3. API TMDB ── */

async function tmdb(path) {
  const res = await fetch(
    `https://api.themoviedb.org/3${path}&api_key=${API_KEY}&language=pt-BR`
  );
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

async function getTrailerKey(id, type = 'movie') {
  try {
    const { results } = await tmdb(`/${type}/${id}/videos?`);
    const t = results.find(v => v.type === 'Trailer' && v.site === 'YouTube' && v.key);
    return t ? t.key : null;
  } catch { return null; }
}

async function searchMovies(query) {
  const data = await tmdb(`/search/multi?query=${encodeURIComponent(query)}&`);
  return data.results || [];
}


/* ── 4. BILLBOARD ── */

async function loadBillboard(items) {
  const item   = items[Math.floor(Math.random() * Math.min(5, items.length))];
  const type   = item.media_type || 'movie';
  const poster = document.getElementById('billPoster');
  const iframe = document.getElementById('billIframe');

  poster.style.backgroundImage = `url(${IMG_ORIG}${item.backdrop_path})`;
  document.getElementById('billTitle').textContent = item.title || item.name || '';
  document.getElementById('billDesc').textContent  = item.overview || '';
  document.getElementById('billMatch').textContent = `${randomMatch()}% relevante`;
  document.getElementById('billYear').textContent  = extractYear(item.release_date || item.first_air_date);
  document.getElementById('billAge').textContent   = item.adult ? '18+' : '14+';

  poster.style.opacity = '1';
  iframe.classList.remove('visible');
  iframe.src = '';

  const key = await getTrailerKey(item.id, type);
  if (!key) return;

  const origin = encodeURIComponent(window.location.origin);
  iframe.src = `https://www.youtube.com/embed/${key}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&modestbranding=1&loop=1&playlist=${key}&enablejsapi=1&origin=${origin}`;

  function fallback(reason) {
    console.warn('Billboard fallback:', reason);
    clearTimeout(safety);
    iframe.src = '';
    iframe.classList.remove('visible');
    poster.style.opacity = '1';
  }

  let loaded = false;
  const safety = setTimeout(() => { if (!loaded) fallback('timeout 7s'); }, 7000);

  iframe.addEventListener('load', () => {
    setTimeout(() => {
      loaded = true;
      clearTimeout(safety);
      iframe.classList.add('visible');
      poster.style.opacity = '0';
    }, 2000);
  }, { once: true });

  iframe.addEventListener('error', () => fallback('iframe error'), { once: true });

  window.addEventListener('message', e => {
    if (!e.origin.includes('youtube.com')) return;
    try {
      const m = JSON.parse(e.data);
      if (m.event === 'onError') fallback(`YT error ${m.info}`);
    } catch { /* noop */ }
  });
}

function toggleMute() {
  isMuted = !isMuted;
  document.getElementById('muteBtn').textContent = isMuted ? '🔇' : '🔊';
  document.getElementById('billIframe').contentWindow?.postMessage(
    JSON.stringify({ event: 'command', func: isMuted ? 'mute' : 'unMute' }), '*'
  );
}

/*5. CARDS E FILEIRAS */
function createCard(item, type = 'movie', options = {}) {
  if (!item.backdrop_path) return null;

  const card     = document.createElement('div');
  card.className = 'card';

  const title      = item.title || item.name || '';
  const year       = extractYear(item.release_date || item.first_air_date);
  const match      = randomMatch();
  const GENRES     = ['Ação', 'Drama', 'Comédia', 'Thriller', 'Ficção Científica', 'Romance'];
  const genreLabel = GENRES.slice(0, 2 + Math.floor(Math.random() * 2)).join(' • ');

  const badgeNew = options.newRelease ? '<div class="card-new">Novidade</div>' : '';
  const badgeTop = options.top10 ? '<div class="top10-badge">TOP 10</div>' : '';
  const progressValue = options.continueWatching ? `${40 + Math.floor(Math.random() * 40)}%` : null;
  const progress = options.continueWatching ? `<div class="watch-progress"><div style="width:${progressValue}"></div></div>` : '';

  card.innerHTML = `
    ${badgeNew}
    ${badgeTop}
    <img class="card-thumb" src="${IMG_W500}${item.backdrop_path}" alt="${title}" loading="lazy">
    ${progress}
    <div class="card-info">
      <div class="card-actions">
        <button class="icon-btn play"                  title="Assistir">▶</button>
        <button class="icon-btn" data-action="list"    title="Adicionar">+</button>
        <button class="icon-btn" data-action="like"    title="Avaliar">👍</button>
        <button class="icon-btn ml" data-action="more" title="Mais informações">⌄</button>
      </div>
      <div class="card-title">${title}</div>
      <div class="card-badges">
        <span class="badge-match">${match}% relevante</span>
        <span class="badge">14+</span>
        <span class="badge">HD</span>
        ${year ? `<span class="badge-year">${year}</span>` : ''}
      </div>
      <div class="card-genres">${genreLabel}</div>
    </div>
  `;

  card.querySelector('[data-action="list"]').addEventListener('click', e => {
    e.stopPropagation(); showToast(`"${title}" adicionado à sua lista!`);
  });
  card.querySelector('[data-action="like"]').addEventListener('click', e => {
    e.stopPropagation(); showToast('Avaliado! Obrigado.');
  });
  card.querySelector('[data-action="more"]').addEventListener('click', e => {
    e.stopPropagation(); showToast('Mais opções em breve…');
  });

  /* — Hover: mini-trailer com delay de 500ms — */
  let videoIframe = null;
  let hoverTimer  = null;
  let rowEl       = null;
  let leaveTimer  = null;

  card.addEventListener('mouseenter', () => {
    rowEl = card.closest('.row');
    if (rowEl) { clearTimeout(leaveTimer); rowEl.style.zIndex = '30'; }

    hoverTimer = setTimeout(async () => {
      if (!card.matches(':hover')) return;

      /* Re-hover: iframe já existe, só mostra */
      if (videoIframe) { videoIframe.style.opacity = '1'; return; }

      const key = await getTrailerKey(item.id, type);
      if (!key || !card.matches(':hover')) return;

      videoIframe           = document.createElement('iframe');
      videoIframe.className = 'card-video';
      videoIframe.setAttribute('frameborder', '0');
      videoIframe.setAttribute('allow', 'autoplay; encrypted-media');
      videoIframe.src = `https://www.youtube.com/embed/${key}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&modestbranding=1&loop=1&playlist=${key}`;

      videoIframe.addEventListener('error', () => {
        videoIframe?.remove(); videoIframe = null;
      }, { once: true });

      card.insertBefore(videoIframe, card.querySelector('.card-info'));

      /* Double rAF garante que o navegador pintou antes da transição de opacidade */
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (videoIframe) videoIframe.style.opacity = '1';
      }));
    }, 500);
  });

  card.addEventListener('mouseleave', () => {
    clearTimeout(hoverTimer);
    if (videoIframe) videoIframe.style.opacity = '0';
    if (rowEl) {
      leaveTimer = setTimeout(() => { if (rowEl) rowEl.style.zIndex = ''; rowEl = null; }, 400);
    }
  });

  return card;
}


/**
 * buildRow — Infinite Slider (clone sandwich)
 */
function buildRow(title, items, type, container, options = {}) {
  const row = document.createElement('div');
  row.className = 'row';

  const header = document.createElement('div');
  header.className = 'row-header';
  header.innerHTML = `
    <span class="row-title">${title}</span>
    <span class="row-explore">Explorar tudo ›</span>
  `;
  row.appendChild(header);

  const wrap = document.createElement('div');
  wrap.className = 'slider-wrap';

  const btnL = document.createElement('button');
  btnL.className = 'arrow-btn arrow-left';
  btnL.innerHTML = '&#8249;';
  btnL.setAttribute('aria-label', 'Anterior');

  const btnR = document.createElement('button');
  btnR.className = 'arrow-btn arrow-right';
  btnR.innerHTML = '&#8250;';
  btnR.setAttribute('aria-label', 'Próximo');

  const slider = document.createElement('div');
  slider.className = 'slider';

  /* — Cards originais — */
  const validItems = items.filter(i => i.backdrop_path);
  const origCards  = validItems.map((i, index) => createCard(i, type, {
    ...options,
    top10: options.top10 && index < 10,
  })).filter(Boolean);
  if (!origCards.length) return;

  /* — Clone sandwich —*/
  function buildClones() {
    const n = getCols();
    const endClones   = origCards.slice(-n).map(c => {
      const cl = c.cloneNode(true); cl.dataset.ghost = 'end'; return cl;
    });
    const startClones = origCards.slice(0, n).map(c => {
      const cl = c.cloneNode(true); cl.dataset.ghost = 'start'; return cl;
    });
    return { endClones, startClones, n };
  }

  /* Renderização inicial */
  let { endClones, startClones } = buildClones();
  endClones.forEach(c   => slider.appendChild(c));
  origCards.forEach(c   => slider.appendChild(c));
  startClones.forEach(c => slider.appendChild(c));

  /* — Transform-origin dinâmico por posição na página — */
  function updatePositionMarkers() {
    const cols  = getCols();
    const cards = [...slider.querySelectorAll('.card:not([data-ghost])')];
    cards.forEach((c, i) => {
      const pos = i % cols;
      c.dataset.pos = pos === 0 ? 'first' : pos === cols - 1 ? 'last' : 'mid';
    });
  }
  updatePositionMarkers();

  /* ── PAGINAÇÃO INFINITA ── */
  let currentPage = 0;
  let isAnimating = false;

  function cardStep() {
    const c = slider.querySelector('.card');
    return c ? c.getBoundingClientRect().width + 4 : 0; // 4 = gap
  }

  function maxPage() {
    const cols = getCols();
    return Math.max(0, Math.ceil((origCards.length - cols) / cols));
  }

  /**
   * Posiciona o slider na página lógica desejada.
   * O offset dos ghost-end é somado automaticamente.
   */
  function goToPage(page, animated = true) {
    const step        = cardStep();
    const cols        = getCols();
    const ghostOffset = getCols() * step; // largura do bloco ghost-end

    if (!animated) slider.style.transition = 'none';

    const offset = ghostOffset + page * cols * step;
    slider.style.transform = `translateX(-${offset}px)`;
    currentPage = page;
  }

  /* Posicionamento inicial (sem animação) */
  requestAnimationFrame(() => goToPage(0, false));

  /* — "Teleporte" ao terminar a transição nos ghosts — */
  slider.addEventListener('transitionend', e => {
    if (e.propertyName !== 'transform') return;
    isAnimating = false;

    if (currentPage < 0) {
      /* Chegou nos ghost-end → vai para o último grupo real */
      goToPage(maxPage(), false);
    } else if (currentPage > maxPage()) {
      /* Chegou nos ghost-start → volta para o primeiro grupo real */
      goToPage(0, false);
    }

    /* Força reflow antes de re-habilitar a transition */
    slider.getBoundingClientRect();
    slider.style.transition = '';
  });

  /* — Cliques nas setas — */
  function navigate(delta) {
    if (isAnimating) return;
    isAnimating = true;
    slider.style.transition = 'transform 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
    goToPage(currentPage + delta);
  }

  btnL.addEventListener('click', () => navigate(-1));
  btnR.addEventListener('click', () => navigate(+1));

  /* No loop infinito ambas as setas ficam sempre visíveis */
  btnL.style.opacity = '1';
  btnR.style.opacity = '1';

  /* — ResizeObserver: recalcula ao mudar viewport — */
  const ro = new ResizeObserver(() => {
    updatePositionMarkers();
    goToPage(currentPage, false);
    applyClip();
  });
  ro.observe(wrap);

  /*
    clip-path inset com Y negativo: clips ghost-cards horizontalmente
    mas deixa o hover (scale + card-info) vazar verticalmente sem ser cortado.
    -200px no eixo Y cobre: expansão do scale(1.5) ~65px + card-info ~100px.
  */
  function applyClip() {
    wrap.style.clipPath = 'inset(-200px 48px -200px 48px)';
  }

  wrap.appendChild(btnL);
  wrap.appendChild(slider);
  wrap.appendChild(btnR);
  row.appendChild(wrap);
  container.appendChild(row);

  requestAnimationFrame(applyClip);
}


/** Skeleton rows enquanto a API carrega. */
function addSkeletonRows(container) {
  const labels = [
    'Em Alta no Brasil', 'Filmes Populares', 'Séries Premiadas',
    'Ação & Aventura',   'Terror',           'Comédias',
  ];
  labels.forEach(label => {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<div class="row-header"><span class="row-title">${label}</span></div>`;
    const sl = document.createElement('div');
    sl.className = 'slider';
    sl.style.padding = '40px 4vw';  /* Alinhado com .slider-wrap padding */
    for (let i = 0; i < 6; i++) {
      const sk = document.createElement('div'); sk.className = 'skeleton'; sl.appendChild(sk);
    }
    row.appendChild(sl);
    container.appendChild(row);
  });
}


/* ── 6. BUSCA DINÂMICA ── */

let searchDebounce = null;

function renderSearchResults(results) {
  const section = document.getElementById('searchResults');
  const grid    = document.getElementById('searchGrid');
  const rowsEl  = document.getElementById('rows');
  grid.innerHTML = '';

  if (!results.length) {
    section.classList.remove('hidden');
    grid.innerHTML = '<p style="color:var(--gray);grid-column:1/-1">Nenhum resultado encontrado.</p>';
    rowsEl.style.display = 'none';
    return;
  }

  section.classList.remove('hidden');
  rowsEl.style.display = 'none';

  results
    .filter(r => r.backdrop_path || r.poster_path)
    .slice(0, 24)
    .forEach(item => {
      const card = document.createElement('div');
      card.className = 'search-card';
      const src  = item.backdrop_path
        ? `${IMG_W500}${item.backdrop_path}`
        : `${IMG_BASE}w342${item.poster_path}`;
      const title = item.title || item.name || '';
      card.innerHTML = `<img src="${src}" alt="${title}" loading="lazy"><div class="search-card-title">${title}</div>`;
      grid.appendChild(card);
    });
}

function initSearch() {
  const toggle    = document.getElementById('searchToggle');
  const searchBox = document.getElementById('searchBox');
  const input     = document.getElementById('searchInput');

  toggle.addEventListener('click', () => {
    searchBox.classList.toggle('open');
    if (searchBox.classList.contains('open')) input.focus();
    else { input.value = ''; clearSearch(); }
  });

  input.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    const q = input.value.trim();
    if (!q) { clearSearch(); return; }
    searchDebounce = setTimeout(async () => {
      try { renderSearchResults(await searchMovies(q)); }
      catch { showToast('Erro ao buscar. Tente novamente.'); }
    }, 500);
  });
}

function clearSearch() {
  document.getElementById('searchResults').classList.add('hidden');
  document.getElementById('searchGrid').innerHTML = '';
  document.getElementById('rows').style.display = '';
}


/* ── 7. NAVBAR SCROLL ── */

function initNavbarScroll() {
  window.addEventListener('scroll', () => {
    document.getElementById('navbar').classList.toggle('solid', window.scrollY > 60);
  }, { passive: true });
}

/* ── 7b. DROPDOWN DELAY ── */

function initDropdownDelay() {
  const dropdownTimeouts = {};
  document.querySelectorAll('.nav-dropdown').forEach(dropdown => {
    dropdown.addEventListener('mouseenter', () => {
      clearTimeout(dropdownTimeouts[dropdown]);
      dropdown.classList.add('open');
    });
    dropdown.addEventListener('mouseleave', () => {
      dropdownTimeouts[dropdown] = setTimeout(() => {
        dropdown.classList.remove('open');
      }, 300);
    });
  });
}


/* ── 8. INICIALIZAÇÃO ── */

async function init() {
  document.getElementById('apiOverlay').style.display = 'none';
  const rowsEl = document.getElementById('rows');
  addSkeletonRows(rowsEl);

  try {
    const [trending, popular, topTV, action, horror, comedy, animes, dramas, documentarios] = await Promise.all([
      tmdb('/trending/all/week?'),
      tmdb('/movie/popular?'),
      tmdb('/tv/top_rated?'),
      tmdb('/discover/movie?with_genres=28&sort_by=popularity.desc&'),
      tmdb('/discover/movie?with_genres=27&sort_by=popularity.desc&'),
      tmdb('/discover/movie?with_genres=35&sort_by=popularity.desc&'),
      tmdb('/discover/movie?with_genres=16&sort_by=popularity.desc&'),
      tmdb('/discover/movie?with_genres=18&sort_by=popularity.desc&'),
      tmdb('/discover/movie?with_genres=99&sort_by=popularity.desc&'),
    ]);

    await loadBillboard(trending.results);

    rowsEl.innerHTML = '';
    buildRow('Em Alta no Brasil', trending.results, 'movie',  rowsEl, { top10: true, newRelease: true });
    buildRow('Continuar assistindo como Wesley', popular.results.slice(0, 10), 'movie', rowsEl, { continueWatching: true });
    buildRow('Filmes Populares',  popular.results,  'movie',  rowsEl);
    buildRow('Séries Premiadas',  topTV.results,    'tv',     rowsEl);
    buildRow('Ação & Aventura',   action.results,   'movie',  rowsEl);
    buildRow('Terror',            horror.results,   'movie',  rowsEl);
    buildRow('Comédias',          comedy.results,   'movie',  rowsEl);
    buildRow('Animes',            animes.results,   'movie',  rowsEl);
    buildRow('Dramas',            dramas.results,   'movie',  rowsEl);
    buildRow('Documentários',     documentarios.results, 'movie', rowsEl);

  } catch (err) {
    console.error(err);
    showToast('Erro ao carregar. Verifique sua API Key.');
    rowsEl.innerHTML = '';
    document.getElementById('apiOverlay').style.display = 'flex';
  }
}

/* ── EVENTOS GLOBAIS ── */
document.getElementById('muteBtn').addEventListener('click', toggleMute);
initNavbarScroll();
initDropdownDelay();
initSearch();
window.addEventListener('DOMContentLoaded', init);