/* ═══════════════════════════════════════════════════════════
   NETFLIX CLONE — script.js
   Organização:
   1. Configurações e estado global
   2. Utilitários
   3. API TMDB
   4. Billboard (hero + vídeo autoplay)
   5. Cards e fileiras
   6. Busca dinâmica
   7. Navbar scroll
   8. Inicialização
═══════════════════════════════════════════════════════════ */


/* ── 1. CONFIGURAÇÕES E ESTADO GLOBAL ── */

const IMG_BASE   = 'https://image.tmdb.org/t/p/';
const IMG_W500   = IMG_BASE + 'w500';
const IMG_ORIG   = IMG_BASE + 'original';

const API_KEY = 'db36709836da3a30746262b6fc1e7743'; // chave fixa TMDB
let isMuted = true; // billboard começa mutado


/* ── 2. UTILITÁRIOS ── */

/**
 * Exibe um toast (mensagem flutuante) por 2.5 segundos
 */
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

/**
 * Retorna uma porcentagem de "relevância" aleatória (70–99%)
 * Simula o algoritmo de recomendação da Netflix
 */
function randomMatch() {
  return Math.floor(70 + Math.random() * 29);
}

/**
 * Extrai o ano de uma data no formato "YYYY-MM-DD"
 */
function extractYear(dateStr) {
  return dateStr ? dateStr.slice(0, 4) : '';
}


/* ── 3. API TMDB ── */

/**
 * Faz uma requisição à API do TMDB
 * @param {string} path - Endpoint + parâmetros (sem api_key)
 * @returns {Promise<Object>} - JSON da resposta
 */
async function tmdb(path) {
  const url = `https://api.themoviedb.org/3${path}&api_key=${API_KEY}&language=pt-BR`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Erro TMDB: ${response.status}`);
  return response.json();
}

/**
 * Busca a key do trailer no YouTube para um filme ou série
 * @param {number} id   - ID do filme/série no TMDB
 * @param {string} type - 'movie' ou 'tv'
 * @returns {Promise<string|null>} - YouTube video key ou null
 */
async function getTrailerKey(id, type = 'movie') {
  try {
    const data = await tmdb(`/${type}/${id}/videos?`);

    // Melhoria 2 — Filtro anti-erro:
    // Só aceita vídeos com type === 'Trailer' E site === 'YouTube' E key válida.
    // Evita teasers, clipes ou vídeos de outras plataformas que geram
    // o erro de "ID de reprodução inválido" no YouTube embed.
    const trailer = data.results.find(
      v => v.type === 'Trailer' && v.site === 'YouTube' && v.key
    );

    // Sem trailer oficial → retorna null.
    // O poster (fallback visual) cobre esse caso — sem vídeos genéricos.
    return trailer ? trailer.key : null;
  } catch {
    return null;
  }
}

/**
 * Busca filmes/séries por texto (usada no campo de busca)
 * @param {string} query - Texto digitado pelo usuário
 * @returns {Promise<Array>} - Lista de resultados
 */
async function searchMovies(query) {
  const data = await tmdb(`/search/multi?query=${encodeURIComponent(query)}&`);
  return data.results || [];
}


/* ── 4. BILLBOARD ── */

/**
 * Carrega o destaque principal (Billboard / Hero)
 * Seleciona um item aleatório entre os 5 primeiros do trending
 * e tenta carregar o trailer via YouTube IFrame
 */
async function loadBillboard(items) {
  const item = items[Math.floor(Math.random() * Math.min(5, items.length))];
  const type = item.media_type || 'movie';

  // Preenche o poster (imagem estática de fundo)
  document.getElementById('billPoster').style.backgroundImage =
    `url(${IMG_ORIG}${item.backdrop_path})`;

  // Preenche os textos
  document.getElementById('billTitle').textContent  = item.title || item.name || '';
  document.getElementById('billDesc').textContent   = item.overview || '';
  document.getElementById('billMatch').textContent  = `${randomMatch()}% relevante`;
  document.getElementById('billYear').textContent   = extractYear(item.release_date || item.first_air_date);
  document.getElementById('billAge').textContent    = item.adult ? '18+' : '14+';

  const poster = document.getElementById('billPoster');
  const iframe = document.getElementById('billIframe');

  // Garante que o poster começa visível e o iframe escondido
  poster.style.opacity = '1';
  iframe.classList.remove('visible');
  iframe.src = '';

  // Busca o trailer — se não houver, mantém apenas o poster (fallback)
  const key = await getTrailerKey(item.id, type);
  if (!key) return; // Melhoria 3 implícita: sem key, sem tentativa de vídeo

  /*
    YouTube Embed com parâmetros:
    - autoplay=1       → inicia automaticamente
    - mute=1           → começa mutado (obrigatório para autoplay no browser)
    - controls=0       → esconde controles do YouTube
    - showinfo=0       → esconde título
    - rel=0            → não mostra vídeos relacionados
    - modestbranding=1 → logo menor do YouTube
    - loop=1           → repete o vídeo
    - playlist=KEY     → necessário para o loop funcionar
    - enablejsapi=1    → habilita controle via postMessage (mute/unmute)
  */
  // Melhoria 1 — parâmetro origin: identifica o domínio para o YouTube,
  // eliminando o erro "Playback ID" que ocorre sem essa informação.
  const origin = encodeURIComponent(window.location.origin);

  iframe.src = [
    `https://www.youtube.com/embed/${key}`,
    `?autoplay=1`,
    `&mute=1`,
    `&controls=0`,
    `&showinfo=0`,
    `&rel=0`,
    `&modestbranding=1`,
    `&loop=1`,
    `&playlist=${key}`,   // obrigatório para loop funcionar
    `&enablejsapi=1`,     // habilita postMessage (mute/unmute)
    `&origin=${origin}`,  // Melhoria 1: corrige erro de ID de reprodução
  ].join('');

  // Melhoria 3 — Sistema de fallback (Plano B):
  // Função reutilizável que descarta o iframe e restaura o poster
  function activatePosterFallback(reason) {
    console.warn(`Billboard fallback ativado: ${reason}`);
    clearTimeout(safetyTimeout);
    iframe.src = '';                 // interrompe carregamento/reprodução
    iframe.classList.remove('visible');
    poster.style.opacity = '1';      // poster volta a ser visível
  }

  // Plano B — Timeout: se em 7s o vídeo não estiver visível, ativa fallback
  let videoLoaded = false;
  const safetyTimeout = setTimeout(() => {
    if (!videoLoaded) activatePosterFallback('timeout de 7s excedido');
  }, 7000);

  // Plano B — Evento load: só confirma vídeo após +2s (YouTube precisa inicializar)
  iframe.addEventListener('load', () => {
    setTimeout(() => {
      videoLoaded = true;
      clearTimeout(safetyTimeout);
      iframe.classList.add('visible');
      poster.style.opacity = '0'; // transição suave via CSS (transition: opacity 1.5s)
    }, 2000);
  }, { once: true });

  // Plano B — Evento error: captura falhas explícitas do navegador no iframe
  iframe.addEventListener('error', () => {
    activatePosterFallback('erro explícito no iframe');
  }, { once: true });

  // Plano B — YouTube postMessage: escuta erros enviados pela API do YouTube
  // O player envia { event: 'onError', info: código } via postMessage
  window.addEventListener('message', (event) => {
    if (!event.origin.includes('youtube.com')) return;
    try {
      const msg = JSON.parse(event.data);
      if (msg.event === 'onError') {
        activatePosterFallback(`YouTube onError: código ${msg.info}`);
      }
    } catch { /* mensagem não é JSON — ignora */ }
  });
}

/**
 * Alterna mute/unmute do vídeo da billboard
 * Usa a YouTube IFrame API via postMessage
 */
function toggleMute() {
  isMuted = !isMuted;
  document.getElementById('muteBtn').textContent = isMuted ? '🔇' : '🔊';

  const iframe = document.getElementById('billIframe');
  iframe.contentWindow.postMessage(
    JSON.stringify({ event: 'command', func: isMuted ? 'mute' : 'unMute' }),
    '*'
  );
}


/* ── 5. CARDS E FILEIRAS ── */

/**
 * Cria um card de filme/série com:
 * - Thumbnail 16:9
 * - Mini-trailer no hover (carregado com delay de 900ms)
 * - Painel de detalhes com botões de ação
 */
function createCard(item, type = 'movie') {
  if (!item.backdrop_path) return null;

  const card      = document.createElement('div');
  card.className  = 'card';

  const title  = item.title || item.name || '';
  const year   = extractYear(item.release_date || item.first_air_date);
  const match  = randomMatch();
  const genres = ['Ação', 'Drama', 'Comédia', 'Thriller', 'Ficção Científica'];
  const genreLabel = genres.slice(0, 2 + Math.floor(Math.random() * 2)).join(' • ');

  card.innerHTML = `
    <img
      class="card-thumb"
      src="${IMG_W500}${item.backdrop_path}"
      alt="${title}"
      loading="lazy"
    >
    <div class="card-info">
      <div class="card-actions">
        <button class="icon-btn play">▶</button>
        <button class="icon-btn" data-action="list">+</button>
        <button class="icon-btn" data-action="like">👍</button>
        <button class="icon-btn ml" data-action="more">⌄</button>
      </div>
      <div class="card-title">${title}</div>
      <div class="card-badges">
        <span class="badge-match">${match}% relevante</span>
        <span class="badge">14+</span>
        <span class="badge">HD</span>
        ${year ? `<span style="font-size:10px;color:var(--gray)">${year}</span>` : ''}
      </div>
      <div class="card-genres">${genreLabel}</div>
    </div>
  `;

  // Ações dos botões do card
  card.querySelector('[data-action="list"]').addEventListener('click', (e) => {
    e.stopPropagation();
    showToast(`"${title}" adicionado à sua lista!`);
  });
  card.querySelector('[data-action="like"]').addEventListener('click', (e) => {
    e.stopPropagation();
    showToast('Avaliado! Obrigado.');
  });
  card.querySelector('[data-action="more"]').addEventListener('click', (e) => {
    e.stopPropagation();
    showToast('Mais opções em breve...');
  });

  // Melhoria 3: mini-trailer no hover — só tenta se o TMDB tiver trailer
  // Se getTrailerKey() retornar null, o card apenas faz zoom (via CSS) sem erros
  let videoIframe = null;
  let hoverTimer  = null;

  card.addEventListener('mouseenter', async () => {
    hoverTimer = setTimeout(async () => {
      // Evita criar o iframe duas vezes
      if (videoIframe) return;

      const key = await getTrailerKey(item.id, type);

      // Sem trailer no TMDB → apenas o zoom do CSS continua funcionando,
      // nenhum iframe é criado e nenhum erro é disparado
      if (!key) return;

      videoIframe             = document.createElement('iframe');
      videoIframe.className   = 'card-video';
      videoIframe.frameBorder = '0';
      videoIframe.allow       = 'autoplay; encrypted-media';
      videoIframe.src = `https://www.youtube.com/embed/${key}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&modestbranding=1&loop=1&playlist=${key}`;

      // Listener de erro: se o YouTube bloquear, remove o iframe silenciosamente
      videoIframe.addEventListener('error', () => {
        videoIframe.remove();
        videoIframe = null;
      }, { once: true });

      // Insere antes do painel de detalhes
      card.insertBefore(videoIframe, card.querySelector('.card-info'));

      // Pequeno delay para a transição de opacidade funcionar
      setTimeout(() => { if (videoIframe) videoIframe.style.opacity = '1'; }, 200);
    }, 900);
  });

  card.addEventListener('mouseleave', () => {
    clearTimeout(hoverTimer);
    if (videoIframe) videoIframe.style.opacity = '0';
  });

  return card;
}

/**
 * Constrói uma fileira completa com título, slider e botões de navegação
 */
function buildRow(title, items, type, container) {
  const row = document.createElement('div');
  row.className = 'row';

  // Cabeçalho da fileira
  const header = document.createElement('div');
  header.className = 'row-header';
  header.innerHTML = `
    <span class="row-title">${title}</span>
    <span class="row-explore">Explorar tudo ›</span>
  `;
  row.appendChild(header);

  // Wrapper do slider
  const wrap = document.createElement('div');
  wrap.className = 'slider-wrap';

  // Botões de navegação
  const btnL = document.createElement('button');
  btnL.className = 'arrow-btn arrow-left';
  btnL.innerHTML = '&#8249;';

  const btnR = document.createElement('button');
  btnR.className = 'arrow-btn arrow-right';
  btnR.innerHTML = '&#8250;';

  // Grid dos cards
  const slider = document.createElement('div');
  slider.className = 'slider';

  items
    .filter(i => i.backdrop_path)
    .forEach(item => {
      const card = createCard(item, type);
      if (card) slider.appendChild(card);
    });

  // Lógica de paginação do slider
  let currentPage = 0;
  const columnsPerPage = 6;

  function totalPages() {
    return Math.max(0, Math.ceil(slider.children.length / columnsPerPage) - 1);
  }

  btnL.addEventListener('click', () => {
    currentPage = Math.max(0, currentPage - 1);
    slider.style.transform = `translateX(-${currentPage * 100}%)`;
  });

  btnR.addEventListener('click', () => {
    currentPage = Math.min(totalPages(), currentPage + 1);
    slider.style.transform = `translateX(-${currentPage * 100}%)`;
  });

  wrap.appendChild(btnL);
  wrap.appendChild(slider);
  wrap.appendChild(btnR);
  row.appendChild(wrap);
  container.appendChild(row);
}

/**
 * Adiciona fileiras de skeleton (placeholder animado) enquanto carrega
 */
function addSkeletonRows(container) {
  const labels = [
    '🔥 Em Alta no Brasil',
    '🎬 Filmes Populares',
    '📺 Séries Premiadas',
    '💥 Ação & Aventura',
    '😱 Terror',
    '😂 Comédias',
  ];

  labels.forEach(label => {
    const row    = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `<div class="row-header"><span class="row-title">${label}</span></div>`;

    const slider    = document.createElement('div');
    slider.className = 'slider';

    for (let i = 0; i < 6; i++) {
      const skeleton    = document.createElement('div');
      skeleton.className = 'skeleton';
      slider.appendChild(skeleton);
    }

    row.appendChild(slider);
    container.appendChild(row);
  });
}


/* ── 6. BUSCA DINÂMICA ── */

let searchDebounce = null;

/**
 * Renderiza os resultados da busca em um grid separado
 */
function renderSearchResults(results) {
  const section  = document.getElementById('searchResults');
  const grid     = document.getElementById('searchGrid');
  const rowsEl   = document.getElementById('rows');

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
      const card      = document.createElement('div');
      card.className  = 'search-card';
      const img       = item.backdrop_path
        ? `${IMG_W500}${item.backdrop_path}`
        : `${IMG_BASE}w342${item.poster_path}`;
      const title     = item.title || item.name || '';

      card.innerHTML = `
        <img src="${img}" alt="${title}" loading="lazy">
        <div class="search-card-title">${title}</div>
      `;
      grid.appendChild(card);
    });
}

/**
 * Inicializa o campo de busca com debounce de 500ms
 * (evita requisição a cada tecla digitada)
 */
function initSearch() {
  const toggle    = document.getElementById('searchToggle');
  const searchBox = document.getElementById('searchBox');
  const input     = document.getElementById('searchInput');

  // Abre/fecha o campo de busca
  toggle.addEventListener('click', () => {
    searchBox.classList.toggle('open');
    if (searchBox.classList.contains('open')) {
      input.focus();
    } else {
      input.value = '';
      clearSearch();
    }
  });

  // Busca com debounce
  input.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    const query = input.value.trim();

    if (!query) {
      clearSearch();
      return;
    }

    searchDebounce = setTimeout(async () => {
      try {
        const results = await searchMovies(query);
        renderSearchResults(results);
      } catch {
        showToast('Erro ao buscar. Tente novamente.');
      }
    }, 500);
  });
}

/**
 * Limpa os resultados e restaura as fileiras normais
 */
function clearSearch() {
  document.getElementById('searchResults').classList.add('hidden');
  document.getElementById('searchGrid').innerHTML = '';
  document.getElementById('rows').style.display = '';
}


/* ── 7. NAVBAR SCROLL ── */

/**
 * Adiciona/remove a classe 'solid' na navbar conforme o scroll
 * A classe muda o fundo de gradiente para cor sólida (#141414)
 */
function initNavbarScroll() {
  window.addEventListener('scroll', () => {
    const navbar = document.getElementById('navbar');
    navbar.classList.toggle('solid', window.scrollY > 60);
  }, { passive: true }); // passive: true melhora performance no scroll
}


/* ── 8. INICIALIZAÇÃO ── */

/**
 * Função principal — chamada quando o usuário clica em "Entrar"
 * com a API Key
 */
async function init() {
  // Esconde o overlay imediatamente — API_KEY já está definida no topo
  document.getElementById('apiOverlay').style.display = 'none';

  const rowsEl = document.getElementById('rows');

  // Mostra skeletons enquanto carrega
  addSkeletonRows(rowsEl);

  try {
    // Faz todas as requisições em paralelo (mais rápido)
    const [trending, popular, topTV, action, horror, comedy] = await Promise.all([
      tmdb('/trending/all/week?'),
      tmdb('/movie/popular?'),
      tmdb('/tv/top_rated?'),
      tmdb('/discover/movie?with_genres=28&sort_by=popularity.desc&'),
      tmdb('/discover/movie?with_genres=27&sort_by=popularity.desc&'),
      tmdb('/discover/movie?with_genres=35&sort_by=popularity.desc&'),
    ]);

    // Carrega o billboard com os trending
    await loadBillboard(trending.results);

    // Limpa os skeletons e monta as fileiras reais
    rowsEl.innerHTML = '';
    buildRow('🔥 Em Alta no Brasil', trending.results, 'movie',  rowsEl);
    buildRow('🎬 Filmes Populares',  popular.results,  'movie',  rowsEl);
    buildRow('📺 Séries Premiadas',  topTV.results,    'tv',     rowsEl);
    buildRow('💥 Ação & Aventura',   action.results,   'movie',  rowsEl);
    buildRow('😱 Terror',            horror.results,   'movie',  rowsEl);
    buildRow('😂 Comédias',          comedy.results,   'movie',  rowsEl);

  } catch (error) {
    console.error(error);
    showToast('API Key inválida. Verifique e tente novamente.');
    rowsEl.innerHTML = '';
    document.getElementById('apiOverlay').style.display = 'flex';
  }
}

/* ── EVENTOS GLOBAIS ── */

// Botão de mute da billboard
document.getElementById('muteBtn').addEventListener('click', toggleMute);

// Inicializa navbar e busca
initNavbarScroll();
initSearch();

// 4. Dispara init() automaticamente quando o DOM estiver pronto
window.addEventListener('DOMContentLoaded', init);