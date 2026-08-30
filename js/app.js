/**
 * Colmek Gallery - Main App
 * JSON format: { title, direct, source, category }
 * Thumbnail: lazy iframe preview (like koleksi-dr-pinguin)
 */
(function () {
  'use strict';

  const PER_PAGE = 10;
  const HERO_COUNT = 6;

  let allVideos = [];
  let filtered = [];
  let currentPage = 1;
  let currentCategory = 'All';
  let currentGenrePage = 1;
  const GENRE_PER_PAGE = 200;
  let heroIndex = 0;
  let heroTimer = null;
  let currentHeroVideo = null;

  function persistView() {
    try {
      sessionStorage.setItem('kdp_cat', currentCategory || 'All');
      sessionStorage.setItem('kdp_page', String(currentPage || 1));
    } catch (_) {}
  }
  function restoreView() {
    try {
      const c = sessionStorage.getItem('kdp_cat');
      const p = parseInt(sessionStorage.getItem('kdp_page') || '1', 10);
      if (c) currentCategory = c;
      if (p > 0) currentPage = p;
    } catch (_) {}
  }
  restoreView();

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  function initAgeGate() {
    const gate = $('#ageGate');
    const entered = sessionStorage.getItem('age_ok') === '1';
    if (entered) {
      gate.classList.add('hidden');
      showMain();
      return;
    }
    $('#btnEnter').addEventListener('click', () => {
      sessionStorage.setItem('age_ok', '1');
      gate.classList.add('hidden');
      showMain();
    });
    $('#btnLeave').addEventListener('click', () => {
      window.location.href = 'https://www.google.com';
    });
  }

  function showMain() {
    const main = $('#mainContent');
    main.classList.remove('opacity-0');
    main.classList.add('opacity-100');
  }

  async function loadVideos(attempt = 1) {
    const urls = [
      'data/videos.json?t=' + Date.now(),
      '/data/videos.json?t=' + Date.now()
    ];
    try {
      let data = null;
      let lastErr = null;
      for (const url of urls) {
        try {
          const res = await fetch(url, { cache: 'no-store' });
          if (!res.ok) throw new Error('HTTP ' + res.status);
          data = await res.json();
          break;
        } catch (err) {
          lastErr = err;
        }
      }
      if (!data) throw lastErr || new Error('fetch failed');

      allVideos = Array.isArray(data) ? data : [];
      allVideos = allVideos.map((v, i) => ({
        id: v.id || i + 1,
        title: v.title || 'Untitled',
        thumbnail: v.thumbnail || '',
        embedUrl: (v.direct || v.embed || v.embedUrl || '').trim(),
        category: v.category || 'Umum',
        date: v.date || '',
        tags: Array.isArray(v.tags) ? v.tags : [],
        _idx: i
      })).filter(v => v.embedUrl);

      allVideos = shuffleVideos(allVideos);
      const qv = new URLSearchParams(location.search).get('v');
      if (qv) {
        const hit = findVideoByShareKey(qv);
        if (hit) setTimeout(() => openModal(hit), 250);
      }
    } catch (e) {
      console.error('Load videos error:', e);
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 600 * attempt));
        return loadVideos(attempt + 1);
      }
      allVideos = [];
    }
    filtered = [...allVideos];
    try {
      renderAll();
    } catch (re) {
      console.error('Render error:', re);
    }
    const countEl = document.querySelector('#videoCount');
    if (countEl) countEl.textContent = mainPool().length + ' video';
  }

  /** Fisher–Yates dengan seed per session — tiap orang beda, satu orang konsisten saat browse */
  function shuffleVideos(list) {
    const arr = list.slice();
    let seed;
    try {
      const key = 'kdp_shuffle_seed';
      seed = sessionStorage.getItem(key);
      if (!seed) {
        seed = String(Date.now()) + '-' + Math.random().toString(36).slice(2);
        sessionStorage.setItem(key, seed);
      }
    } catch (_) {
      seed = String(Date.now());
    }
    // simple seeded PRNG (mulberry32-ish)
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    const rand = () => {
      h += 0x6D2B79F5;
      let t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function getHeroVideos() {
    const pool = (typeof indoPool === 'function') ? indoPool() : mainPool();
    const mixed = (typeof shuffleVideos === 'function') ? shuffleVideos(pool) : pool;
    return mixed.slice(0, HERO_COUNT);
  }

  function renderHero() {
    const heroes = getHeroVideos();
    if (!heroes.length) return;

    const slidesEl = $('#heroSlides');
    slidesEl.innerHTML = heroes.map((v, i) => {
      return `<div class="hero-slide absolute inset-0 transition-opacity duration-700 ${i === 0 ? 'opacity-100' : 'opacity-0'}" data-idx="${i}">
        <iframe src="${i === 0 ? escapeHtml(v.embedUrl) : ''}" data-src="${escapeHtml(v.embedUrl)}" class="w-full h-full pointer-events-none" frameborder="0" allowfullscreen></iframe>
      </div>`;
    }).join('');

    updateHeroContent(heroes[0]);
    currentHeroVideo = heroes[0];

    clearInterval(heroTimer);
    heroTimer = setInterval(() => {
      heroIndex = (heroIndex + 1) % heroes.length;
      showHeroSlide(heroes);
    }, 8000);

    $('#prevSlide').onclick = () => {
      heroIndex = (heroIndex - 1 + heroes.length) % heroes.length;
      showHeroSlide(heroes);
    };
    $('#nextSlide').onclick = () => {
      heroIndex = (heroIndex + 1) % heroes.length;
      showHeroSlide(heroes);
    };
    $('#heroPlay').onclick = () => {
      if (currentHeroVideo) openModal(currentHeroVideo);
    };
  }

  function showHeroSlide(heroes) {
    $$('.hero-slide').forEach((el, i) => {
      el.classList.toggle('opacity-100', i === heroIndex);
      el.classList.toggle('opacity-0', i !== heroIndex);
      const iframe = el.querySelector('iframe');
      if (iframe && iframe.dataset.src) {
        if (i === heroIndex) {
          if (iframe.getAttribute('src') !== iframe.dataset.src) iframe.src = iframe.dataset.src;
        }
      }
    });
    updateHeroContent(heroes[heroIndex]);
    currentHeroVideo = heroes[heroIndex];
  }

  function updateHeroContent(v) {
    $('#heroTitle').textContent = v.title;
    $('#heroMeta').textContent = `${v.category}`.trim();
  }

  
  
  function isHiddenHome(v) {
    const cat = (v.category || '').toLowerCase();
    const url = (v.embedUrl || v.direct || v.embed || '').toLowerCase();
    return cat === 'vicek' || cat === 'vicek.id' || cat.includes('exastream')
      || cat === 'videy' || cat.includes('videy')
      || cat.includes('doodstream') || cat.includes('ai bokep')
      || url.includes('vicek.id') || url.includes('exastream')
      || url.includes('videy.co') || url.includes('cdn.videy.co')
      || url.includes('playmogo.com') || url.includes('doodstream') || url.includes('dood.watch');
  }

  function isDoodCat(name) {
    const c = (name || '').toLowerCase();
    return c.includes('doodstream') || c.includes('ai bokep');
  }
  function isDoodUrl(url) {
    return /playmogo\.com|doodstream|dood\.watch|dood\.so|dood\.to/i.test(url || '');
  }
  function isVideyCat(name) {
    const c = (name || '').toLowerCase();
    return c === 'videy' || c.includes('videy');
  }

  function isVideyUrl(url) {
    return /videy\.co|cdn\.videy\.co/i.test(url || '');
  }

  function toVideyMp4(url) {
    if (!url) return '';
    try {
      const u = new URL(url);
      if ((u.hostname.includes('videy.co') && u.hostname.includes('cdn')) && /\.(mp4|mov)($|\?)/i.test(u.pathname)) return url;
      if (u.hostname.includes('videy.co')) {
        const id = u.searchParams.get('id');
        if (id) {
          const ext = (id.length === 9 && id[8] === '2') ? '.mov' : '.mp4';
          return 'https://cdn.videy.co/' + id + ext;
        }
      }
    } catch (_) {}
    return '';
  }


  function isExaStreamCat(name) {
    const c = (name || '').toLowerCase();
    return c === 'vicek' || c === 'vicek.id' || c.includes('exastream');
  }

  function mainPool() {
    return allVideos.filter(v => !isHiddenHome(v));
  }

  function isNewUpload(v) {
    const tags = Array.isArray(v.tags) ? v.tags.map(t => String(t).toLowerCase()) : [];
    if (tags.includes('baru') || tags.includes('upload-terbaru') || tags.includes('upload terbaru')) return true;
    const d = (v.date || '').slice(0, 10);
    if (!d) return false;
    const ts = Date.parse(d);
    if (Number.isNaN(ts)) return false;
    const days = (Date.now() - ts) / 86400000;
    return days >= 0 && days <= 14;
  }

  function getCategories() {
    const counts = {};
    allVideos.forEach(v => {
      const c = v.category || 'Umum';
      counts[c] = (counts[c] || 0) + 1;
    });
    const cats = Object.entries(counts)
      .filter(([name]) => {
        const n = String(name).toLowerCase();
        return n !== 'vicek' && n !== 'vicek.id' && !n.includes('exastream') && n !== 'videy' && !n.includes('videy') && !n.includes('doodstream') && n !== 'ai bokep' && !n.includes('ai bokep');
      })
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
    const newCount = allVideos.filter(isNewUpload).length;
    const exaCount = allVideos.filter(v => {
      const cat = (v.category || '').toLowerCase();
      const url = (v.embedUrl || '').toLowerCase();
      return cat.includes('exastream') || cat === 'vicek' || cat === 'vicek.id' || url.includes('vicek.id');
    }).length;
    if (exaCount > 0) {
      cats.unshift({ name: "ExaStream", count: exaCount });
    }
    const videyCount = allVideos.filter(v => isVideyCat(v.category) || isVideyUrl(v.embedUrl || '')).length;
    if (videyCount > 0) {
      // insert after ExaStream (index 0 currently Exa if upload not yet unshifted)
      const idx = cats.findIndex(c => c.name === 'ExaStream');
      const item = { name: 'Videy', count: videyCount };
      if (idx >= 0) cats.splice(idx + 1, 0, item);
      else cats.unshift(item);
    }
    const doodCount = allVideos.filter(v => isDoodCat(v.category) || isDoodUrl(v.embedUrl || v.direct || '')).length;
    if (doodCount > 0) {
      const itemD = { name: 'AI Bokep', count: doodCount };
      const idxV = cats.findIndex(c => c.name === 'Videy');
      if (idxV >= 0) cats.splice(idxV + 1, 0, itemD);
      else cats.unshift(itemD);
    }

    if (newCount > 0) {
      cats.unshift({ name: 'Upload Terbaru', count: newCount });
    }
    return cats;
  }

  function renderCategoryPills() {
    const cats = getCategories();
    const el = $('#categoryPills');
    const show = cats.slice(0, 24);
    el.innerHTML = `
      <button class="cat-pill active" data-cat="All">Semua <span class="opacity-60">${mainPool().length}</span></button>
      ${show.map(c => `
        <button class="cat-pill" data-cat="${escapeHtml(c.name)}">${escapeHtml(c.name)} <span class="opacity-60">${c.count}</span></button>
      `).join('')}
    `;
    $$('.cat-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.cat-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCategory = btn.dataset.cat;
        currentPage = 1;
        persistView();
        persistView();
        applyFilter();
      });
    });
  }

  function renderGenreGrid() {
    const cats = getCategories();
    const el = $('#genreGrid');
    if (!el) return;

    const icons = {
      'Upload Terbaru': 'fa-clock', ExaStream: 'fa-play-circle', Videy: 'fa-video', 'AI Bokep': 'fa-robot', Amatir: 'fa-user', Umum: 'fa-globe', STW: 'fa-heart', Jilbab: 'fa-mosque',
      ABG: 'fa-graduation-cap', Viral: 'fa-fire', Colmek: 'fa-play', Tobrut: 'fa-star',
      Live: 'fa-broadcast-tower', Chindo: 'fa-flag', Doggy: 'fa-paw', Outdoor: 'fa-tree',
      Toilet: 'fa-restroom', AI: 'fa-robot', Bumil: 'fa-baby', Lesbian: 'fa-venus-double',
      'Open BO': 'fa-handshake', Perselingkuhan: 'fa-heart-broken', Threesome: 'fa-users',
      Bule: 'fa-globe-europe', Scandal: 'fa-exclamation', Artis: 'fa-star', Guru: 'fa-chalkboard-teacher'
    };

    const totalPages = Math.max(1, Math.ceil(cats.length / GENRE_PER_PAGE));
    if (currentGenrePage > totalPages) currentGenrePage = totalPages;

    const start = (currentGenrePage - 1) * GENRE_PER_PAGE;
    const pageCats = cats.slice(start, start + GENRE_PER_PAGE);

    el.innerHTML = pageCats.map(c => `
      <button class="genre-card group" data-cat="${escapeHtml(c.name)}">
        <div class="w-10 h-10 rounded bg-[#ff9000]/15 text-[#ff9000] flex items-center justify-center mb-3 group-hover:bg-[#ff9000] group-hover:text-black transition-colors">
          <i class="fas ${icons[c.name] || 'fa-film'} text-sm"></i>
        </div>
        <div class="font-semibold text-sm truncate">${escapeHtml(c.name)}</div>
        <div class="text-xs text-neutral-500 mt-0.5">${c.count} video</div>
      </button>
    `).join('');

    $$('.genre-card').forEach(btn => {
      btn.addEventListener('click', () => {
        currentCategory = btn.dataset.cat;
        currentPage = 1;
        persistView();
        $$('.cat-pill').forEach(b => {
          b.classList.toggle('active', b.dataset.cat === currentCategory);
        });
        applyFilter();
        document.getElementById('terbaru').scrollIntoView({ behavior: 'smooth' });
      });
    });

    renderGenrePagination(cats.length);
  }

  function renderGenrePagination(totalCats) {
    const el = $('#genrePagination');
    if (!el) return;

    const total = Math.ceil(totalCats / GENRE_PER_PAGE);
    if (total <= 1) {
      el.innerHTML = '';
      return;
    }

    let html = '';
    html += `<button class="page-btn genre-page-btn" data-page="${currentGenrePage - 1}" ${currentGenrePage === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;

    const maxShow = 5;
    let startP = Math.max(1, currentGenrePage - 2);
    let endP = Math.min(total, startP + maxShow - 1);
    if (endP - startP < maxShow - 1) startP = Math.max(1, endP - maxShow + 1);

    if (startP > 1) {
      html += `<button class="page-btn genre-page-btn" data-page="1">1</button>`;
      if (startP > 2) html += `<span class="text-neutral-600 px-1">...</span>`;
    }
    for (let i = startP; i <= endP; i++) {
      html += `<button class="page-btn genre-page-btn ${i === currentGenrePage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    if (endP < total) {
      if (endP < total - 1) html += `<span class="text-neutral-600 px-1">...</span>`;
      html += `<button class="page-btn genre-page-btn" data-page="${total}">${total}</button>`;
    }

    html += `<button class="page-btn genre-page-btn" data-page="${currentGenrePage + 1}" ${currentGenrePage === total ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;

    el.innerHTML = html;
    el.querySelectorAll('.genre-page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.dataset.page, 10);
        if (p >= 1 && p <= total && p !== currentGenrePage) {
          currentGenrePage = p;
          renderGenreGrid();
          document.getElementById('genre').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  function applyFilter() {
    if (currentCategory === 'All') {
      filtered = mainPool();
    } else if (currentCategory.toLowerCase() === 'upload terbaru') {
      filtered = mainPool().filter(isNewUpload).sort((a, b) => {
        const da = a.date || '';
        const db = b.date || '';
        if (da !== db) return db.localeCompare(da);
        return (b._idx || 0) - (a._idx || 0);
      });
    } else if (isExaStreamCat(currentCategory)) {
      filtered = allVideos.filter(v => {
        const cat = (v.category || '').toLowerCase();
        const url = (v.embedUrl || '').toLowerCase();
        return cat.includes('exastream') || cat === 'vicek' || url.includes('vicek.id');
      });
    } else if (isVideyCat(currentCategory)) {
      filtered = allVideos.filter(v => isVideyCat(v.category) || isVideyUrl(v.embedUrl || v.direct || ''));
    } else if (isDoodCat(currentCategory)) {
      filtered = allVideos.filter(v => isDoodCat(v.category) || isDoodUrl(v.embedUrl || v.direct || ''));
    } else {
      filtered = mainPool().filter(v => (v.category || '').toLowerCase() === currentCategory.toLowerCase());
    }
    const maxPage = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
    if (currentPage > maxPage) currentPage = maxPage;
    if (currentPage < 1) currentPage = 1;
    persistView();
    renderGrid();
    renderPagination();
  }

  function renderGrid() {
    const start = (currentPage - 1) * PER_PAGE;
    const pageItems = filtered.slice(start, start + PER_PAGE);
    const el = $('#videoGrid');

    if (!pageItems.length) {
      el.innerHTML = `<div class="col-span-full text-center py-16 text-neutral-500">Tidak ada video ditemukan.</div>`;
      return;
    }

    el.innerHTML = pageItems.map(v => cardHTML(v)).join('');
    bindCardClicks(el);
    $('#videoCount').textContent = `${filtered.length} video`;
  }

  function indoPool() {
    return allVideos.filter(v => {
      const u = ((v.embedUrl || v.direct || v.embed || '') + '').toLowerCase();
      return (u.includes('indoav') || u.includes('userbokep')) && !isHiddenHome(v);
    });
  }

  function pickRandom(arr, n) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a.slice(0, n);
  }

  function renderTrending() {
    const list = shuffleVideos(indoPool()).slice(HERO_COUNT, HERO_COUNT + 12);
    const el = $('#trendingGrid');
    if (!el) return;
    el.innerHTML = list.map(v => cardHTML(v)).join('');
    bindCardClicks(el);
  }

  function isMobileView() {
    return window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
  }

  function cardHTML(v) {
    const src = v.embedUrl || '';
    const mp4 = (typeof toVideyMp4 === 'function') ? (toVideyMp4(src) || toVideyMp4(v.direct || '')) : '';
    let media;
    if (mp4) {
      // Videy: tampilkan frame video asli (preload metadata), tanpa autoplay
      media = `<video
            src="${escapeHtml(mp4)}"
            muted
            playsinline
            preload="metadata"
            class="absolute inset-0 w-full h-full object-contain bg-black pointer-events-none"
          ></video>
          <div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
            <span class="w-9 h-9 rounded-full text-white flex items-center justify-center text-xs shadow" style="background:#ff9000">▶</span>
          </div>`;
    } else {
      media = `<iframe
            src="${escapeHtml(src)}" referrerpolicy="${(typeof isDoodUrl==='function' && isDoodUrl(src)) ? 'no-referrer' : 'origin'}"
            class="absolute inset-0 w-full h-full pointer-events-none opacity-90"
            allowfullscreen
            frameborder="0"
            allow="encrypted-media; picture-in-picture"
          ></iframe>
          <div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
            <div class="w-9 h-9 rounded-full flex items-center justify-center shadow" style="background:#ff9000">
              <i class="fas fa-play text-white text-xs ml-0.5"></i>
            </div>
          </div>`;
    }
    return `
      <article class="video-card group cursor-pointer" data-id="${v.id}">
        <div class="relative aspect-video rounded overflow-hidden bg-black border border-neutral-800 transition-colors">
          ${media}
          <span class="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 text-[10px] font-medium tracking-wide z-10">${escapeHtml(v.category)}</span>
          <button type="button" class="card-share absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-black/70 text-white text-xs" aria-label="Share">↗</button>
        </div>
        <div class="mt-2.5 px-0.5">
          <h3 class="text-sm font-medium leading-snug line-clamp-2 transition-colors">${escapeHtml(v.title)}</h3>
        </div>
      </article>
    `;
  }






  function lazyLoadIframes(container) {
    const load = (el) => {
      if (!el.dataset.src) return;
      el.src = el.dataset.src;
      el.removeAttribute('data-src');
    };
    container.querySelectorAll('iframe[data-src]').forEach(load);
    const videos = container.querySelectorAll('video[data-src]');
    if (!videos.length) return;
    if (!('IntersectionObserver' in window)) {
      videos.forEach(load);
      return;
    }
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        load(entry.target);
        obs.unobserve(entry.target);
      });
    }, { rootMargin: '200px' });
    videos.forEach(v => obs.observe(v));
  }


  function bindCardClicks(container) {
    container.querySelectorAll('.video-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.card-share')) return;
        const id = parseInt(card.dataset.id, 10);
        const video = allVideos.find(v => v.id === id);
        if (video) openModal(video);
      });
      const sh = card.querySelector('.card-share');
      if (sh) sh.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        const id = parseInt(card.dataset.id, 10);
        const video = allVideos.find(v => v.id === id);
        if (video) openShareSheet(video);
      });
    });
  }

  function renderPagination() {
    const total = Math.ceil(filtered.length / PER_PAGE);
    const el = $('#pagination');
    if (total <= 1) {
      el.innerHTML = '';
      return;
    }

    let html = '';
    html += `<button class="page-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;
    for (let i = 1; i <= Math.min(total, 7); i++) {
      html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    if (total > 7) html += `<span class="text-neutral-600 px-1">...</span><button class="page-btn" data-page="${total}">${total}</button>`;
    html += `<button class="page-btn" data-page="${currentPage + 1}" ${currentPage === total ? 'disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;

    el.innerHTML = html;
    el.querySelectorAll('.page-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.dataset.page, 10);
        if (p >= 1 && p <= total && p !== currentPage) {
          currentPage = p;
          persistView();
          renderGrid();
          renderPagination();
          document.getElementById('terbaru').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  
  function toEmbedUrl(url) {
    if (!url) return '';
    try {
      const u = new URL(url);
      // IndoAV / userbokep: /d/ = halaman copy-link, /e/ = player
      if ((u.hostname.includes('indoav.app') || u.hostname.includes('userbokep.com')) && u.pathname.startsWith('/d/')) {
        u.pathname = u.pathname.replace(/^\/d\//, '/e/');
        return u.toString();
      }
    } catch (_) {}
    return url;
  }

  function isBlockedEmbedHost(url) {
    try {
      const h = new URL(url).hostname;
      return h.includes('indoav.app') || h.includes('userbokep.com');
    } catch (_) {
      return /indoav\.app|userbokep\.com/i.test(url || '');
    }
  }


  
  let currentShareVideo = null;

  function videoShareKey(v) {
    const u = v.embedUrl || v.direct || '';
    try {
      const url = new URL(u, location.origin);
      const qid = url.searchParams.get('id');
      if (qid) return qid;
      const parts = url.pathname.split('/').filter(Boolean);
      const last = parts[parts.length - 1] || '';
      return last.replace(/\.(mp4|mov)$/i, '') || String(v.id);
    } catch (_) {
      return String(v.id);
    }
  }

  function videoShareUrl(v) {
    const key = encodeURIComponent(videoShareKey(v));
    return location.origin + location.pathname + '?v=' + key;
  }

  function findVideoByShareKey(key) {
    if (!key) return null;
    const k = decodeURIComponent(key).toLowerCase();
    return allVideos.find(v => videoShareKey(v).toLowerCase() === k) || null;
  }

  function openShareSheet(video) {
    currentShareVideo = video;
    const sheet = document.getElementById('shareSheet');
    if (!sheet) return;
    const prev = document.getElementById('shareTitlePreview');
    if (prev) prev.textContent = video.title || '';
    sheet.classList.remove('hidden');
    sheet.setAttribute('aria-hidden', 'false');
  }

  function closeShareSheet() {
    const sheet = document.getElementById('shareSheet');
    if (!sheet) return;
    sheet.classList.add('hidden');
    sheet.setAttribute('aria-hidden', 'true');
  }

  function shareTargets(url, title) {
    const t = encodeURIComponent(title || 'Koleksi Dr. Pinguin');
    const u = encodeURIComponent(url);
    return {
      facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + u,
      whatsapp: 'https://wa.me/?text=' + t + '%20' + u,
      twitter: 'https://twitter.com/intent/tweet?text=' + t + '&url=' + u,
      reddit: 'https://www.reddit.com/submit?url=' + u + '&title=' + t,
      telegram: 'https://t.me/share/url?url=' + u + '&text=' + t,
      gmail: 'https://mail.google.com/mail/?view=cm&fs=1&su=' + t + '&body=' + u
    };
  }


  function bindShareUI() {
    if (window.__shareBound) return;
    window.__shareBound = true;
    document.addEventListener('click', (e) => {
      const closeEl = e.target.closest('#shareClose, #shareBackdrop');
      if (closeEl) { closeShareSheet(); return; }

      const appBtn = e.target.closest('.share-app');
      if (appBtn && currentShareVideo) {
        const url = videoShareUrl(currentShareVideo);
        const maps = shareTargets(url, currentShareVideo.title);
        const href = maps[appBtn.dataset.app];
        if (href) window.open(href, '_blank', 'noopener');
        return;
      }

      const copyBtn = e.target.closest('#shareCopy');
      if (copyBtn && currentShareVideo) {
        const url = videoShareUrl(currentShareVideo);
        const title = (currentShareVideo.title || '').trim();
        const payload = title ? (title + '\n' + url) : url;
        const done = () => {
          copyBtn.textContent = 'Link disalin';
          copyBtn.classList.add('copied');
          setTimeout(() => { copyBtn.textContent = 'Salin link'; copyBtn.classList.remove('copied'); }, 1500);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(payload).then(done).catch(done);
        } else {
          const ta = document.createElement('textarea');
          ta.value = payload; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
          done();
        }
        return;
      }

      const shareBtn = e.target.closest('#modalShare, #modalShareMobile, .card-share');
      if (shareBtn) {
        e.preventDefault();
        e.stopPropagation();
        let video = currentShareVideo;
        const card = shareBtn.closest('.video-card');
        if (card) {
          const id = card.dataset.id;
          video = allVideos.find(v => String(v.id) === String(id));
        }
        if (video) openShareSheet(video);
      }
    }, true);
  }


  function openModal(video) {
    const modal = $('#videoModal');
    const iframe = $('#modalIframe');
    const external = $('#modalOpenExternal');
    const externalMob = $('#modalOpenExternalMobile');
    const rawUrl = video.embedUrl || video.direct || '';
    const embedUrl = toEmbedUrl(rawUrl);
    currentShareVideo = video;
    $('#modalTitle').textContent = video.title || '';
    $('#modalMeta').textContent = video.category || '';
    // reset then set src for clean load on mobile
    const gate = document.getElementById('embedGate');
    if (gate) gate.style.display = 'none';
    let native = document.getElementById('modalNativeVideo');
    const frameWrap = iframe && iframe.parentElement;
    if (!native && frameWrap) {
      native = document.createElement('video');
      native.id = 'modalNativeVideo';
      native.controls = true;
      native.playsInline = true;
      native.className = 'player-iframe';
      native.style.display = 'none';
      frameWrap.appendChild(native);
    }
    const mp4 = toVideyMp4(embedUrl) || toVideyMp4(rawUrl);
    if (mp4 && native) {
      iframe.style.display = 'none';
      iframe.src = 'about:blank';
      native.autoplay = false;
      native.removeAttribute('autoplay');
      native.muted = false;
      native.controls = true;
      native.style.display = 'block';
      native.pause();
      native.src = mp4;
      native.load();
      try { native.pause(); } catch (_) {}
    } else {
      if (native) { native.pause(); native.removeAttribute('src'); native.style.display = 'none'; }
      iframe.style.display = '';
      iframe.src = 'about:blank';
      iframe.setAttribute('referrerpolicy', (typeof isDoodUrl === 'function' && isDoodUrl(embedUrl)) ? 'no-referrer' : 'origin');
      requestAnimationFrame(() => { iframe.src = embedUrl; });
    }
    const href = rawUrl || embedUrl || '#';
    if (external) external.href = href;
    if (externalMob) externalMob.href = href;
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    // iOS rubber-band lock
    document.body.style.touchAction = 'none';
  }

  function closeModal() {
    const modal = $('#videoModal');
    const iframe = $('#modalIframe');
    if (iframe) { iframe.src = 'about:blank'; iframe.style.display = ''; }
    const nv = document.getElementById('modalNativeVideo');
    if (nv) { try { nv.pause(); } catch(_){} nv.removeAttribute('src'); nv.style.display = 'none'; }
    const gate = document.getElementById('embedGate');
    if (gate) gate.style.display = 'none';
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    document.body.style.touchAction = '';
  }

  function initSearch() {
    const overlay = $('#searchOverlay');
    $('#searchToggle').addEventListener('click', () => {
      overlay.classList.remove('hidden');
      $('#searchInput').focus();
    });
    $('#searchClose').addEventListener('click', () => {
      overlay.classList.add('hidden');
      $('#searchInput').value = '';
      $('#searchResults').innerHTML = '';
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.add('hidden');
    });
    let debounce;
    $('#searchInput').addEventListener('input', (e) => {
      clearTimeout(debounce);
      debounce = setTimeout(() => doSearch(e.target.value.trim()), 250);
    });
  }

  function doSearch(q) {
    const el = $('#searchResults');
    if (!q) { el.innerHTML = ''; return; }
    const lower = q.toLowerCase();
    const results = allVideos.filter(v =>
      v.title.toLowerCase().includes(lower) ||
      (v.category || '').toLowerCase().includes(lower)
    ).slice(0, 20);

    if (!results.length) {
      el.innerHTML = '<p class="text-neutral-500 text-center py-6">Tidak ditemukan.</p>';
      return;
    }
    el.innerHTML = results.map(v => `
      <button class="search-item w-full text-left flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-800 transition-colors" data-id="${v.id}">
        <div class="w-16 h-10 rounded-lg bg-surface-800 flex items-center justify-center shrink-0">
          <i class="fas fa-play text-xs text-neutral-600"></i>
        </div>
        <div class="min-w-0">
          <div class="text-sm font-medium truncate">${escapeHtml(v.title)}</div>
          <div class="text-xs text-neutral-500">${escapeHtml(v.category)}</div>
        </div>
      </button>
    `).join('');
    el.querySelectorAll('.search-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const video = allVideos.find(v => v.id === parseInt(btn.dataset.id, 10));
        if (video) {
          $('#searchOverlay').classList.add('hidden');
          openModal(video);
        }
      });
    });
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  function renderAll() {
    renderHero();
    renderCategoryPills();
    renderGenreGrid();
    applyFilter();
    renderTrending();
  }

  function init() {
    try {
      initAgeGate();
    } catch (e) { console.error(e); }
    try {
      initSearch();
    } catch (e) { console.error(e); }

    const modalClose = $('#modalClose');
    const modalBackdrop = $('#modalBackdrop');
    if (modalClose) modalClose.addEventListener('click', closeModal);
    if (modalBackdrop) modalBackdrop.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });

    const menuBtn = $('#mobileMenuBtn');
    if (menuBtn) {
      menuBtn.addEventListener('click', () => {
        const m = $('#mobileMenu');
        if (m) m.classList.toggle('hidden');
      });
    }

    $$('#mobileMenu a').forEach(a => {
      a.addEventListener('click', () => {
        const m = $('#mobileMenu');
        if (m) m.classList.add('hidden');
      });
    });

    bindShareUI();
  loadVideos();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
