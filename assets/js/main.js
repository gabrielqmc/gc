/* ==========================================================================
   Gabriel Capinzaiki — Portfólio
   Interações e movimento (GSAP + ScrollTrigger + Lenis + WebGL próprio)
   ========================================================================== */
(() => {
  'use strict';

  const d = document;
  const h = d.documentElement;
  const w = window;
  w.__gcPronto = true;

  const $ = (s, c = d) => c.querySelector(s);
  const $$ = (s, c = d) => Array.from(c.querySelectorAll(s));
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const mm = (q) => w.matchMedia(q).matches;
  const store = {
    get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* sem storage */ } },
    del: (k) => { try { sessionStorage.removeItem(k); } catch { /* sem storage */ } },
  };

  const gsap = w.gsap;
  const ST = w.ScrollTrigger;
  let reduced = h.classList.contains('reduced');
  const fine = mm('(hover: hover) and (pointer: fine)');
  const desktop = () => w.innerWidth > 860;

  if (!gsap || !ST) {
    // Sem as bibliotecas o site continua 100% legível.
    h.classList.remove('js');
    h.classList.add('reduced');
    $$('[data-loader]').forEach((el) => el.classList.add('is-done'));
    return;
  }
  gsap.registerPlugin(ST);
  gsap.defaults({ ease: 'expo.out', duration: 1.1 });

  /* ------------------------------------------------------------------------
     Divisão de texto
     ------------------------------------------------------------------------ */
  function eachTextNode(root, fn) {
    const walker = d.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(fn);
  }

  function split(el, mode) {
    if (el.classList.contains('is-split')) return;
    let i = 0;
    eachTextNode(el, (node) => {
      const parts = node.textContent.split(/(\s+)/);
      const frag = d.createDocumentFragment();
      parts.forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(d.createTextNode(' ')); return; }
        const mask = d.createElement('span');
        mask.className = 'split-w';
        const inner = d.createElement('span');
        if (mode === 'chars') {
          for (const ch of part) {
            const c = d.createElement('span');
            c.className = 'split-c';
            c.style.setProperty('--i', i++);
            c.textContent = ch;
            inner.appendChild(c);
          }
        } else {
          inner.textContent = part;
          inner.style.setProperty('--i', i++);
        }
        mask.appendChild(inner);
        frag.appendChild(mask);
      });
      node.parentNode.replaceChild(frag, node);
    });
    el.classList.add('is-split');
    if (mode === 'chars') el.setAttribute('aria-label', el.textContent.trim());
  }

  // Links com rolagem por letra
  $$('.roll').forEach((el) => {
    const text = el.textContent;
    el.textContent = '';
    el.setAttribute('aria-label', text.trim());
    [...text].forEach((ch, i) => {
      const s = d.createElement('span');
      s.className = 'rc';
      s.setAttribute('aria-hidden', 'true');
      s.style.setProperty('--i', i);
      s.textContent = ch;
      el.appendChild(s);
    });
  });

  $$('[data-split]').forEach((el) => split(el, el.dataset.split));

  // Manifesto: palavras que “acendem” com a rolagem
  const manifesto = $('[data-manifesto]');
  if (manifesto) {
    eachTextNode(manifesto, (node) => {
      const frag = d.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(d.createTextNode(' ')); return; }
        const s = d.createElement('span');
        s.className = 'mw';
        s.textContent = part;
        frag.appendChild(s);
      });
      node.parentNode.replaceChild(frag, node);
    });
  }

  /* ------------------------------------------------------------------------
     Rolagem suave (Lenis) sincronizada com o ScrollTrigger
     ------------------------------------------------------------------------ */
  let lenis = null;
  if (!reduced && w.Lenis) {
    lenis = new w.Lenis({ lerp: 0.095, wheelMultiplier: 1, smoothWheel: true });
    lenis.on('scroll', ST.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const scrollTo = (target, opts = {}) => {
    if (lenis) lenis.scrollTo(target, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4), ...opts });
    else if (typeof target === 'number') w.scrollTo(0, target);
    else target.scrollIntoView();
  };

  /* ------------------------------------------------------------------------
     Cores: cada seção tem uma paleta (claro/escuro). Ao rolar, o fundo e o
     texto fazem uma transição suave para a paleta da seção em foco — as
     imagens em WebGL acompanham, porque o duotom usa essas mesmas cores.
     ------------------------------------------------------------------------ */
  const PALETAS = {
    claro: {
      base: { bg: '#eeede9', fg: '#111110' },
      manifesto: { bg: '#dfe4d6', fg: '#14211a' },
      obras: { bg: '#ebe7de', fg: '#151412' },
      servicos: { bg: '#e2dccd', fg: '#1d1a14' },
      processo: { bg: '#d3dbc9', fg: '#132019' },
      sobre: { bg: '#e2dccd', fg: '#1d1a14' },
      proximo: { bg: '#d3dbc9', fg: '#132019' },
      noite: { bg: '#111110', fg: '#eeede9' },
    },
    escuro: {
      base: { bg: '#111110', fg: '#eeede9' },
      manifesto: { bg: '#121c16', fg: '#e3eadb' },
      obras: { bg: '#151412', fg: '#efebe2' },
      servicos: { bg: '#1c1913', fg: '#ece5d4' },
      processo: { bg: '#15201a', fg: '#dfe7d5' },
      sobre: { bg: '#1c1913', fg: '#ece5d4' },
      proximo: { bg: '#15201a', fg: '#dfe7d5' },
      noite: { bg: '#080808', fg: '#eeede9' },
    },
  };
  const metaTema = $('meta[name="theme-color"]');
  const modo = () => (h.classList.contains('dark') ? 'escuro' : 'claro');
  let secaoTema = 'base';
  const tema = { ...PALETAS[modo()].base };
  const escreverTema = () => {
    h.style.setProperty('--bg', tema.bg);
    h.style.setProperty('--fg', tema.fg);
    if (metaTema) metaTema.setAttribute('content', tema.bg);
  };
  function aplicarTema(nome, imediato) {
    secaoTema = nome in PALETAS.claro ? nome : 'base';
    const alvo = PALETAS[modo()][secaoTema];
    if (imediato || reduced) { gsap.killTweensOf(tema); Object.assign(tema, alvo); escreverTema(); return; }
    gsap.to(tema, { ...alvo, duration: 1.3, ease: 'power2.inOut', overwrite: true, onUpdate: escreverTema });
  }
  // Converte '#rrggbb' ou 'rgb(a)(r, g, b)' em [r, g, b] de 0 a 1
  const paraRgb = (cor) => {
    if (cor[0] === '#') return [1, 3, 5].map((i) => parseInt(cor.slice(i, i + 2), 16) / 255);
    const n = cor.match(/[\d.]+/g) || [0, 0, 0];
    return [n[0] / 255, n[1] / 255, n[2] / 255];
  };
  const coresDoTema = () => ({ bg: paraRgb(tema.bg), fg: paraRgb(tema.fg) });
  aplicarTema('base', true);

  function temaPorSecao() {
    $$('[data-tema]').forEach((sec) => {
      ST.create({
        trigger: sec, start: 'top 55%', end: 'bottom 55%',
        onToggle: (s) => { if (s.isActive && sec.dataset.tema !== secaoTema) aplicarTema(sec.dataset.tema); },
      });
    });
  }

  // Botão claro/escuro: revelação circular a partir do botão (View Transitions)
  $$('[data-tema-toggle]').forEach((btn) => {
    btn.setAttribute('aria-pressed', h.classList.contains('dark'));
    btn.addEventListener('click', () => {
      const escuro = !h.classList.contains('dark');
      const trocar = () => {
        h.classList.toggle('dark', escuro);
        try { localStorage.setItem('gc-tema', escuro ? 'escuro' : 'claro'); } catch { /* sem storage */ }
        $$('[data-tema-toggle]').forEach((b) => b.setAttribute('aria-pressed', escuro));
        aplicarTema(secaoTema, true);
      };
      if (d.startViewTransition && !reduced) {
        const r = btn.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        const raio = Math.hypot(Math.max(x, w.innerWidth - x), Math.max(y, w.innerHeight - y));
        const vt = d.startViewTransition(trocar);
        vt.ready.then(() => {
          h.animate(
            { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${raio}px at ${x}px ${y}px)`] },
            { duration: 1000, easing: 'cubic-bezier(0.76, 0, 0.24, 1)', pseudoElement: '::view-transition-new(root)' },
          );
        }).catch(() => {});
      } else {
        h.classList.toggle('dark', escuro);
        try { localStorage.setItem('gc-tema', escuro ? 'escuro' : 'claro'); } catch { /* sem storage */ }
        $$('[data-tema-toggle]').forEach((b) => b.setAttribute('aria-pressed', escuro));
        aplicarTema(secaoTema);
      }
    });
  });

  /* ------------------------------------------------------------------------
     Relógio (horário de Brasília)
     ------------------------------------------------------------------------ */
  const clocks = $$('[data-clock]');
  if (clocks.length) {
    const fmt = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const tick = () => { const t = fmt.format(new Date()); clocks.forEach((c) => { c.textContent = t; }); };
    tick();
    setInterval(tick, 1000);
  }

  /* ------------------------------------------------------------------------
     Transições entre páginas
     ------------------------------------------------------------------------ */
  // 1) Cortina com borda curva (SVG) para a navegação geral
  // 2) Zoom da imagem do projeto: a imagem clicada cresce até a tela inteira e
  //    “pousa” como capa na página do projeto
  const cortina = $('[data-transicao]');
  const cortinaPath = $('[data-transicao-path]');
  const cortinaLabel = $('[data-transicao-label]');
  const chegadaCortina = store.get('gc-transicao');
  const chegadaZoom = store.get('gc-zoom');
  const veioDeTransicao = chegadaCortina !== null || chegadaZoom !== null;
  if ('scrollRestoration' in history && veioDeTransicao) history.scrollRestoration = 'manual';
  const camadasDaPagina = () => $$('main, .site-header, .section-indicator, .gl-stage, footer');

  // Forma da cortina: y = altura da borda (0–100), c = curvatura da borda
  const formaCobrir = (y, c) => `M0 100 L0 ${y} Q50 ${y - c} 100 ${y} L100 100 Z`;
  const formaRevelar = (y, c) => `M0 0 L0 ${y} Q50 ${y + c} 100 ${y} L100 0 Z`;

  function cobrir(label) {
    return new Promise((resolve) => {
      if (!cortina) { resolve(); return; }
      cortina.classList.add('is-on');
      cortinaLabel.textContent = label || '';
      const st = { y: 100, c: 0 };
      const desenhar = () => cortinaPath.setAttribute('d', formaCobrir(st.y, st.c));
      gsap.timeline({ onComplete: resolve })
        .to(st, { y: 0, duration: 0.95, ease: 'power3.inOut', onUpdate: desenhar }, 0)
        .to(st, { keyframes: [{ c: 22, duration: 0.45, ease: 'power2.out' }, { c: 0, duration: 0.5, ease: 'power2.in' }], onUpdate: desenhar }, 0)
        .fromTo(cortinaLabel, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, 0.5);
    });
  }

  function revelar(label) {
    return new Promise((resolve) => {
      if (!cortina) { resolve(); return; }
      cortina.classList.add('is-on');
      cortinaLabel.textContent = label || '';
      gsap.set(cortinaLabel, { opacity: 1, y: 0 });
      const st = { y: 100, c: 0 };
      const desenhar = () => cortinaPath.setAttribute('d', formaRevelar(st.y, st.c));
      desenhar();
      gsap.timeline({ onComplete: () => { cortina.classList.remove('is-on'); resolve(); } })
        .to(cortinaLabel, { opacity: 0, y: -24, duration: 0.45, ease: 'power2.in' }, 0.1)
        .to(st, { y: 0, duration: 1, ease: 'power3.inOut', onUpdate: desenhar }, 0.25)
        .to(st, { keyframes: [{ c: 22, duration: 0.5, ease: 'power2.out' }, { c: 0, duration: 0.5, ease: 'power2.in' }], onUpdate: desenhar }, 0.25);
      setTimeout(resolve, 700);  // a introdução da página começa enquanto a cortina sai
    });
  }

  function navegar(url, label) {
    store.set('gc-transicao', label || '');
    if (lenis) lenis.stop();
    cobrir(label).then(() => { w.location.href = url; });
  }

  function criarClone(src, r) {
    const clone = d.createElement('div');
    clone.className = 'zoom-clone';
    Object.assign(clone.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
    const ci = new Image();
    ci.src = src;
    ci.alt = '';
    clone.appendChild(ci);
    d.body.appendChild(clone);
    return { clone, ci };
  }

  function navegarComZoom(url, img, label) {
    const caixa = img.closest('[data-gl-media], .next__img') || img;
    const src = img.currentSrc || img.src;
    store.set('gc-zoom', JSON.stringify({ src, label }));
    if (lenis) lenis.stop();
    const { clone, ci } = criarClone(src, caixa.getBoundingClientRect());
    gsap.to(camadasDaPagina(), { opacity: 0, duration: 0.55, ease: 'power2.out' });
    gsap.timeline({ onComplete: () => { w.location.href = url; } })
      .fromTo(ci, { filter: 'grayscale(1) contrast(1.1)' }, { filter: 'grayscale(0) contrast(1)', duration: 1.1, ease: 'power2.inOut' }, 0)
      .to(clone, { left: 0, top: 0, width: w.innerWidth, height: w.innerHeight, duration: 1.1, ease: 'expo.inOut' }, 0)
      .to(ci, { scale: 1.04, duration: 1.1, ease: 'expo.inOut' }, 0);
  }

  function chegar() {
    store.set('gc-visto', '1');
    const loaderEl = $('[data-loader]');
    if (loaderEl) loaderEl.classList.add('is-done');
    w.scrollTo(0, 0);

    if (chegadaZoom === null) {
      store.del('gc-transicao');
      return revelar(chegadaCortina || '');
    }

    store.del('gc-zoom');
    let info = {};
    try { info = JSON.parse(chegadaZoom); } catch { /* ignora */ }
    const capa = $('[data-cover]');
    const { clone, ci } = criarClone(info.src || '', { left: 0, top: 0, width: w.innerWidth, height: w.innerHeight });
    gsap.set(ci, { scale: 1.04 });
    const sumir = () => gsap.to(clone, { opacity: 0, duration: 0.35, onComplete: () => clone.parentNode && clone.parentNode.removeChild(clone) });
    if (!capa) { sumir(); return Promise.resolve(); }

    const imgCapa = $('img', capa);
    const capaPronta = imgCapa && !imgCapa.complete
      ? Promise.race([
        new Promise((r) => { imgCapa.addEventListener('load', r, { once: true }); imgCapa.addEventListener('error', r, { once: true }); }),
        new Promise((r) => setTimeout(r, 1500)),
      ])
      : Promise.resolve();
    return new Promise((resolve) => {
      requestAnimationFrame(() => {
        const r = capa.getBoundingClientRect();
        gsap.timeline()
          .to(clone, { left: r.left, top: r.top, width: r.width, height: r.height, duration: 1.15, ease: 'expo.inOut' }, 0.05)
          .to(ci, { scale: 1, duration: 1.15, ease: 'expo.inOut' }, 0.05)
          .add(() => resolve(), 0.55)
          .add(() => { capaPronta.then(sumir); });
      });
    });
  }

  d.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target === '_blank' || a.hasAttribute('download')) return;
    const url = new URL(a.href, w.location.href);
    if (url.origin !== w.location.origin) return;

    if (a.hasAttribute('data-top')) { e.preventDefault(); scrollTo(0); return; }

    const mesmaPagina = url.pathname === w.location.pathname || (url.pathname.replace(/index\.html$/, '') === w.location.pathname.replace(/index\.html$/, ''));
    if (mesmaPagina && url.hash) {
      const alvo = d.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (alvo) { e.preventDefault(); fecharMenu(); scrollTo(alvo); history.replaceState(null, '', url.hash); }
      return;
    }
    if (mesmaPagina && !url.hash) { e.preventDefault(); fecharMenu(); scrollTo(0); return; }
    if (!cortina || reduced) return;
    e.preventDefault();
    fecharMenu(true);
    const label = a.dataset.transition || a.textContent.trim().split('\n')[0];
    let img = a.hasAttribute('data-zoom') ? $('img', a) : null;
    if (a.dataset.zoomIndex !== undefined) {
      const item = $$('[data-feed-item]')[Number(a.dataset.zoomIndex)];
      if (item) img = $('img', item);
    }
    if (img && img.getBoundingClientRect().width > 0) navegarComZoom(url.href, img, label);
    else navegar(url.href, label);
  });

  // Voltar pelo histórico (bfcache): desfaz o estado de transição
  w.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    if (cortina) cortina.classList.remove('is-on');
    $$('.zoom-clone').forEach((c) => c.parentNode.removeChild(c));
    gsap.set(camadasDaPagina(), { opacity: 1 });
    store.del('gc-transicao');
    store.del('gc-zoom');
    if (lenis) lenis.start();
  });

  /* ------------------------------------------------------------------------
     Loader: progresso real (fontes + imagens visíveis), sem atraso artificial
     ------------------------------------------------------------------------ */
  function rodarLoader() {
    const el = $('[data-loader]');
    if (!el) return Promise.resolve();
    const primeira = !store.get('gc-visto') && !veioDeTransicao;
    if (!primeira || reduced) { el.classList.add('is-done'); store.set('gc-visto', '1'); return Promise.resolve(); }
    store.set('gc-visto', '1');
    if (lenis) lenis.stop();

    const count = $('[data-loader-count]', el);
    const bar = $('[data-loader-bar]', el);
    const word = $('[data-loader-word]', el);
    const frases = ['Carregando obras digitais', 'Ajustando a tipografia', 'Preparando a experiência'];

    const tarefas = [];
    if (d.fonts && d.fonts.ready) tarefas.push(d.fonts.ready);
    $$('img').forEach((img) => {
      const r = img.getBoundingClientRect();
      if (r.top < w.innerHeight * 1.5 && r.width > 0 && !img.complete) {
        tarefas.push(new Promise((res) => { img.addEventListener('load', res, { once: true }); img.addEventListener('error', res, { once: true }); }));
      }
    });
    const totalTarefas = tarefas.length || 1;
    let feitas = 0;
    tarefas.forEach((t) => t.then(() => { feitas++; }));

    let mostrado = 0;
    let fraseIdx = 0;
    const inicio = performance.now();

    return new Promise((resolve) => {
      const passo = () => {
        const decorrido = performance.now() - inicio;
        const real = tarefas.length ? feitas / totalTarefas : 1;
        const forcar = decorrido > 4500;  // rede muito lenta: não prende a pessoa no loader
        const alvo = forcar ? 1 : real;
        // Avança rápido até o progresso real; nunca passa dele.
        mostrado = Math.min(alvo, mostrado + Math.max((alvo - mostrado) * 0.16, 0.025));
        count.textContent = Math.round(mostrado * 100);
        bar.style.transform = `scaleX(${mostrado})`;
        const novaFrase = Math.min(frases.length - 1, Math.floor(mostrado * frases.length));
        if (novaFrase !== fraseIdx) {
          fraseIdx = novaFrase;
          gsap.fromTo(word, { yPercent: 100 }, { yPercent: 0, duration: 0.6 });
          word.textContent = frases[fraseIdx];
        }
        if (mostrado >= 0.999) {
          gsap.timeline({ onComplete: () => { el.classList.add('is-done'); resolve(); } })
            .to(count, { yPercent: -105, duration: 0.7, ease: 'expo.in' })
            .to(word, { yPercent: -110, duration: 0.5, ease: 'expo.in' }, '<')
            .to(el, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1.05, ease: 'expo.inOut' }, '-=0.15');
          setTimeout(() => resolve(), 900);  // a introdução começa enquanto a cortina sobe
          return;
        }
        requestAnimationFrame(passo);
      };
      requestAnimationFrame(passo);
    });
  }

  /* ------------------------------------------------------------------------
     Cursor personalizado
     ------------------------------------------------------------------------ */
  const mouse = { x: w.innerWidth / 2, y: w.innerHeight / 2, vx: 0, vy: 0, ativo: false };
  w.addEventListener('pointermove', (e) => {
    mouse.vx = e.clientX - mouse.x;
    mouse.vy = e.clientY - mouse.y;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.ativo = true;
  }, { passive: true });

  const cursor = $('[data-cursor-el]');
  if (cursor && fine) {
    h.classList.add('has-cursor');
    const label = $('[data-cursor-text]', cursor);
    const pos = { x: mouse.x, y: mouse.y };
    const set = (cls, on) => cursor.classList.toggle(cls, on);
    gsap.ticker.add(() => {
      pos.x = lerp(pos.x, mouse.x, 0.2);
      pos.y = lerp(pos.y, mouse.y, 0.2);
      cursor.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
    });
    d.addEventListener('pointermove', () => set('is-visible', true), { passive: true });
    d.documentElement.addEventListener('pointerleave', () => set('is-visible', false));
    d.addEventListener('pointerdown', () => set('is-down', true));
    d.addEventListener('pointerup', () => set('is-down', false));
    d.addEventListener('pointerover', (e) => {
      const comLabel = e.target.closest('[data-cursor-label]');
      const esconder = e.target.closest('[data-cursor="hide"]');
      const link = e.target.closest('a, button, [data-cursor="link"]');
      set('is-hidden', !!esconder);
      if (comLabel && !esconder) {
        label.textContent = comLabel.dataset.cursorLabel;
        set('is-label', true);
        set('is-link', false);
      } else {
        set('is-label', false);
        set('is-link', !!link && !esconder);
      }
    });
  }

  /* ------------------------------------------------------------------------
     Botões magnéticos
     ------------------------------------------------------------------------ */
  if (fine && !reduced) {
    $$('.magnetic').forEach((el) => {
      const forca = parseFloat(el.dataset.magneticStrength || '0.3');
      const inner = $('.magnetic-in', el);
      const xTo = gsap.quickTo(el, 'x', { duration: 0.8, ease: 'power3.out' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.8, ease: 'power3.out' });
      const ixTo = inner ? gsap.quickTo(inner, 'x', { duration: 0.8, ease: 'power3.out' }) : null;
      const iyTo = inner ? gsap.quickTo(inner, 'y', { duration: 0.8, ease: 'power3.out' }) : null;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        xTo(dx * forca); yTo(dy * forca);
        if (ixTo) { ixTo(dx * forca * 0.45); iyTo(dy * forca * 0.45); }
      });
      el.addEventListener('pointerleave', () => {
        gsap.to(el, { x: 0, y: 0, duration: 1.2, ease: 'elastic.out(1, 0.35)' });
        if (inner) gsap.to(inner, { x: 0, y: 0, duration: 1.2, ease: 'elastic.out(1, 0.35)' });
      });
    });
  }

  /* ------------------------------------------------------------------------
     Menu mobile
     ------------------------------------------------------------------------ */
  const menu = $('[data-menu]');
  const menuBtn = $('[data-menu-toggle]');
  let menuAberto = false;
  function abrirMenu() {
    if (!menu || menuAberto) return;
    menuAberto = true;
    h.classList.add('menu-open');
    menuBtn.setAttribute('aria-expanded', 'true');
    $('[data-menu-label]').textContent = 'Fechar';
    if (lenis) lenis.stop();
    gsap.set(menu, { visibility: 'visible' });
    gsap.timeline()
      .fromTo(menu, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'expo.inOut' })
      .fromTo($$('.menu__links a > span:last-child', menu), { yPercent: 110 }, { yPercent: 0, stagger: 0.06, duration: 1 }, '-=0.45')
      .fromTo($$('.menu__links .mono, .menu__foot', menu), { opacity: 0 }, { opacity: 1, stagger: 0.04, duration: 0.6 }, '<0.2');
  }
  function fecharMenu(imediato) {
    if (!menu || !menuAberto) return;
    menuAberto = false;
    h.classList.remove('menu-open');
    menuBtn.setAttribute('aria-expanded', 'false');
    $('[data-menu-label]').textContent = 'Menu';
    if (lenis && !imediato) lenis.start();
    gsap.to(menu, { clipPath: 'inset(0% 0% 100% 0%)', duration: imediato ? 0.01 : 0.8, ease: 'expo.inOut', onComplete: () => gsap.set(menu, { visibility: 'hidden' }) });
  }
  if (menuBtn) menuBtn.addEventListener('click', () => (menuAberto ? fecharMenu() : abrirMenu()));
  d.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharMenu(); });

  /* ------------------------------------------------------------------------
     Hero: grade de pontos que reage ao cursor/toque (canvas 2D)
     ------------------------------------------------------------------------ */
  function heroCanvas() {
    const canvas = $('[data-hero-canvas]');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const hero = canvas.parentElement;
    let pts = [];
    let W = 0; let H = 0; let dpr = 1;
    let visivel = true;
    const local = { x: -9999, y: -9999 };

    function montar() {
      dpr = Math.min(w.devicePixelRatio || 1, 2);
      W = hero.clientWidth; H = hero.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const passo = desktop() ? 28 : 24;
      pts = [];
      for (let y = passo / 2; y < H; y += passo) {
        for (let x = passo / 2; x < W; x += passo) pts.push({ ox: x, oy: y, x, y });
      }
    }
    montar();
    w.addEventListener('resize', montar);
    new IntersectionObserver(([en]) => { visivel = en.isIntersecting; }).observe(hero);

    const atualizarLocal = (cx, cy) => {
      const r = hero.getBoundingClientRect();
      local.x = cx - r.left; local.y = cy - r.top;
    };
    w.addEventListener('pointermove', (e) => atualizarLocal(e.clientX, e.clientY), { passive: true });
    hero.addEventListener('touchmove', (e) => { const t = e.touches[0]; if (t) atualizarLocal(t.clientX, t.clientY); }, { passive: true });
    hero.addEventListener('touchend', () => { local.x = -9999; local.y = -9999; });

    let t = 0;
    gsap.ticker.add(() => {
      if (!visivel) return;
      t += 0.012;
      ctx.clearRect(0, 0, W, H);
      const R = desktop() ? 170 : 120;
      const vel = Math.min(Math.hypot(mouse.vx, mouse.vy), 60);
      mouse.vx *= 0.9; mouse.vy *= 0.9;
      const fg = coresDoTema().fg;
      ctx.fillStyle = `rgba(${Math.round(fg[0] * 255)},${Math.round(fg[1] * 255)},${Math.round(fg[2] * 255)},0.26)`;
      for (const p of pts) {
        let tx = p.ox;
        let ty = p.oy + (reduced ? 0 : Math.sin(t + p.ox * 0.008 + p.oy * 0.004) * 1.6);
        const dx = p.ox - local.x; const dy = p.oy - local.y;
        const dist = Math.hypot(dx, dy);
        let raio = 1;
        if (dist < R) {
          const f = 1 - dist / R;
          const empurrao = f * f * (26 + vel * 0.6);
          tx += (dx / (dist || 1)) * empurrao;
          ty += (dy / (dist || 1)) * empurrao;
          raio = 1 + f * 1.4;
        }
        p.x = lerp(p.x, tx, 0.14);
        p.y = lerp(p.y, ty, 0.14);
        ctx.beginPath();
        ctx.arc(p.x, p.y, raio, 0, 6.2832);
        ctx.fill();
      }
    });
  }

  /* ------------------------------------------------------------------------
     Hero: letras do nome mudam de peso conforme a proximidade do cursor
     ------------------------------------------------------------------------ */
  function heroPeso() {
    const nome = $('[data-hero-name]');
    if (!nome || reduced) return;
    const chars = $$('.split-c', nome).map((el) => ({ el, peso: 500 }));
    let ativo = false;
    new IntersectionObserver(([en]) => { ativo = en.isIntersecting; }).observe(nome);
    let toque = null;
    nome.addEventListener('touchmove', (e) => { const t = e.touches[0]; if (t) toque = { x: t.clientX, y: t.clientY }; }, { passive: true });
    nome.addEventListener('touchend', () => { toque = null; });
    gsap.ticker.add(() => {
      if (!ativo) return;
      const px = toque ? toque.x : mouse.x;
      const py = toque ? toque.y : mouse.y;
      const usar = toque || (fine && mouse.ativo);
      const R = Math.max(220, w.innerWidth * 0.2);
      for (const c of chars) {
        let alvo = 500;
        if (usar) {
          const r = c.el.getBoundingClientRect();
          const dist = Math.hypot(px - (r.left + r.width / 2), py - (r.top + r.height / 2));
          const f = Math.max(0, 1 - dist / R);
          alvo = 500 - f * f * 340;   // perto do cursor as letras ficam finas, como uma lente
        }
        c.peso = lerp(c.peso, alvo, 0.12);
        c.el.style.setProperty('--w', c.peso.toFixed(1));
      }
    });
  }

  /* ------------------------------------------------------------------------
     Introdução (depois do loader / da cortina)
     ------------------------------------------------------------------------ */
  function introducao() {
    const tl = gsap.timeline();
    const primeiraDobra = (el) => el.getBoundingClientRect().top < w.innerHeight;

    $$('[data-split="chars"]').filter(primeiraDobra).forEach((el, i) => {
      el.dataset.done = '1';
      tl.fromTo($$('.split-c', el), { yPercent: 118 }, { yPercent: 0, stagger: 0.03, duration: 1.3 }, i * 0.12);
    });
    $$('[data-split="words"]').filter(primeiraDobra).forEach((el) => {
      el.dataset.done = '1';
      tl.fromTo($$('.split-w > span', el), { yPercent: 110 }, { yPercent: 0, stagger: 0.05, duration: 1.2 }, 0.1);
    });
    const ups = $$('[data-reveal]').filter(primeiraDobra);
    ups.forEach((el) => { el.dataset.done = '1'; });
    if (ups.length) tl.to(ups, { opacity: 1, y: 0, stagger: 0.07, duration: 1.2 }, 0.45);
    return tl;
  }

  /* ------------------------------------------------------------------------
     Animações de rolagem
     ------------------------------------------------------------------------ */
  function rolagem() {
    // Revelações de texto
    $$('[data-split="words"]').forEach((el) => {
      if (el.dataset.done) return;
      gsap.fromTo($$('.split-w > span', el), { yPercent: 110 }, {
        yPercent: 0, stagger: 0.055, duration: 1.2,
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      });
    });
    $$('[data-split="chars"]').forEach((el) => {
      if (el.dataset.done) return;
      gsap.fromTo($$('.split-c', el), { yPercent: 118 }, {
        yPercent: 0, stagger: 0.025, duration: 1.2,
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      });
    });
    ST.batch($$('[data-reveal]').filter((el) => !el.dataset.done), {
      start: 'top 90%',
      once: true,
      onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, stagger: 0.08, duration: 1.2, overwrite: true }),
    });

    // Barra de progresso de leitura
    const barra = $('.progress');
    if (barra) {
      ST.create({ start: 0, end: 'max', onUpdate: (s) => { barra.style.transform = `scaleX(${s.progress})`; } });
    }

    // Cabeçalho some ao descer e volta ao subir
    const header = $('[data-header]');
    if (header) {
      ST.create({
        start: 0, end: 'max',
        onUpdate: (s) => {
          if (menuAberto) return;
          header.classList.toggle('is-hidden', s.direction === 1 && s.scroll() > 160);
        },
      });
    }

    // Indicador de seção (número + nome)
    const ind = $('[data-indicator-name]');
    const indNum = $('[data-indicator-num]');
    const secoes = $$('[data-section]');
    if (ind && indNum) {
      let atual = '';
      secoes.forEach((sec, i) => {
        ST.create({
          trigger: sec, start: 'top 55%', end: 'bottom 55%',
          onToggle: (s) => {
            if (!s.isActive || atual === sec.dataset.section) return;
            atual = sec.dataset.section;
            indNum.textContent = String(i + 1).padStart(2, '0');
            gsap.timeline()
              .to(ind, { yPercent: -100, duration: 0.25, ease: 'power2.in' })
              .add(() => { ind.textContent = atual; })
              .fromTo(ind, { yPercent: 100 }, { yPercent: 0, duration: 0.5 });
          },
        });
      });
    }

    // Hero: nome se separa e sobe com a rolagem
    const heroNome = $('[data-hero-name]');
    if (heroNome && !reduced) {
      const hero = heroNome.closest('.hero');
      const opts = { trigger: hero, start: 'top top', end: 'bottom top', scrub: true };
      gsap.to($('.l1', heroNome), { xPercent: -10, ease: 'none', scrollTrigger: opts });
      gsap.to($('.l2', heroNome), { xPercent: 8, ease: 'none', scrollTrigger: opts });
      gsap.to(heroNome, { yPercent: 30, ease: 'none', scrollTrigger: opts });
      gsap.to($$('.hero__meta, .hero__foot, .hero__role', hero), { opacity: 0, y: -40, ease: 'none', scrollTrigger: { ...opts, end: '60% top' } });
    }

    // Manifesto: cada palavra acende com a rolagem
    if (manifesto && !reduced) {
      gsap.to($$('.mw', manifesto), {
        opacity: 1, ease: 'none', stagger: 0.1,
        scrollTrigger: { trigger: manifesto, start: 'top 80%', end: 'bottom 45%', scrub: 0.6 },
      });
    }

    // Títulos de seção deslizam levemente conforme a posição
    if (!reduced) {
      $$('.section-head__title, .more-link > span:first-child').forEach((el) => {
        gsap.fromTo(el, { xPercent: 3 }, { xPercent: -3, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
      });
    }

    // Coluna de trabalhos: o painel fixo acompanha o projeto em foco
    painelDaColuna();

    // Arquivo: legendas entram em sequência
    const legendas = $$('.arch__cap');
    if (legendas.length && !reduced) {
      ST.batch(legendas, { start: 'top 92%', once: true, onEnter: (els) => gsap.fromTo(els, { opacity: 0, y: 24 }, { opacity: 1, y: 0, stagger: 0.08, duration: 1.1 }) });
    }

    // Processo: rolagem horizontal fixa no desktop
    const pin = $('[data-process]');
    const track = $('[data-process-track]');
    if (pin && track && !reduced) {
      const mmq = gsap.matchMedia();
      mmq.add('(min-width: 861px)', () => {
        const fill = $('[data-process-fill]');
        const count = $('[data-process-count]');
        const passos = $$('.step', track).length;
        const distancia = () => Math.max(0, track.scrollWidth - pin.clientWidth + parseFloat(getComputedStyle(pin).paddingLeft) * 2);
        const tween = gsap.to(track, {
          x: () => -distancia(),
          ease: 'none',
          scrollTrigger: {
            trigger: pin, start: 'top top', end: () => `+=${distancia() + w.innerHeight * 0.3}`,
            pin: true, scrub: 0.8, invalidateOnRefresh: true, anticipatePin: 1,
            onUpdate: (s) => {
              if (fill) fill.style.transform = `scaleX(${s.progress})`;
              if (count) count.textContent = String(Math.min(passos, Math.floor(s.progress * passos) + 1)).padStart(2, '0');
            },
          },
        });
        // Números em contorno se deslocam em velocidade diferente (parallax dentro do card)
        $$('.step__num', track).forEach((n) => {
          gsap.fromTo(n, { xPercent: 18 }, { xPercent: -18, ease: 'none', scrollTrigger: { trigger: n.parentElement, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
        });
        return () => gsap.set(track, { clearProps: 'x' });
      });
      mmq.add('(max-width: 860px)', () => {
        $$('.step', track).forEach((s) => {
          gsap.fromTo(s, { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 1.2, scrollTrigger: { trigger: s, start: 'top 88%', once: true } });
        });
      });
    }

    // Rodapé: a marca gigante sobe letra por letra
    const marca = $('[data-footer-mark]');
    if (marca && !reduced) {
      split(marca, 'chars');
      gsap.fromTo($$('.split-c', marca), { yPercent: 100 }, {
        yPercent: 0, stagger: 0.04, ease: 'none',
        scrollTrigger: { trigger: marca, start: 'top bottom', end: 'bottom bottom', scrub: 0.6 },
      });
    }

    // Página de projeto: a capa se afasta devagar quando a página rola
    const capa = $('[data-cover]');
    if (capa && !reduced) {
      const img = $('img', capa);
      if (img) gsap.to(img, { yPercent: 14, scale: 1.08, ease: 'none', scrollTrigger: { trigger: capa, start: 'top top', end: 'bottom top', scrub: true } });
    }
    const browser = $('[data-browser]');
    if (browser && !reduced) {
      gsap.fromTo(browser, { rotateX: 22, scale: 0.88, y: 60 }, {
        rotateX: 0, scale: 1, y: 0, ease: 'none',
        scrollTrigger: { trigger: browser, start: 'top 95%', end: 'top 25%', scrub: true },
      });
    }
  }

  /* ------------------------------------------------------------------------
     Coluna de trabalhos: painel fixo com o projeto em foco
     ------------------------------------------------------------------------ */
  function painelDaColuna() {
    const itens = $$('[data-feed-item]');
    const nomes = $('[data-feed-names]');
    if (!itens.length || !nomes) return;
    const metas = $$('[data-feed-meta] > div');
    const num = $('[data-feed-num]');
    const barra = $('[data-feed-bar]');
    const link = $('[data-feed-link]');
    let atual = -1;
    const ativar = (i) => {
      if (i === atual) return;
      atual = i;
      nomes.style.transform = `translateY(${-i * 1.04}em)`;
      metas.forEach((m, k) => m.classList.toggle('is-active', k === i));
      if (num) {
        gsap.timeline()
          .to(num, { yPercent: -60, opacity: 0, duration: 0.2, ease: 'power2.in' })
          .add(() => { num.textContent = String(i + 1).padStart(2, '0'); })
          .fromTo(num, { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.45 });
      }
      if (barra) barra.style.transform = `scaleX(${(i + 1) / itens.length})`;
      if (link && metas[i]) {
        link.href = metas[i].dataset.metaUrl;
        link.dataset.transition = metas[i].dataset.metaNome;
        link.dataset.zoomIndex = i;
      }
    };
    ativar(0);
    itens.forEach((it, i) => {
      ST.create({ trigger: it, start: 'top 60%', end: 'bottom 60%', onToggle: (s) => { if (s.isActive) ativar(i); } });
    });
  }

  /* ------------------------------------------------------------------------
     Filtros da página de projetos
     ------------------------------------------------------------------------ */
  function filtros() {
    const grupo = $('[data-filters]');
    if (!grupo) return;
    const works = $$('[data-work]');
    grupo.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-filter]');
      if (!btn || btn.classList.contains('is-active')) return;
      $$('[data-filter]', grupo).forEach((b) => { const on = b === btn; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', on); });
      const f = btn.dataset.filter;
      const visiveis = works.filter((wk) => f === '*' || wk.dataset.tags.split('|').includes(f));
      gsap.to(works, {
        opacity: 0, y: 30, duration: 0.35, ease: 'power2.in', stagger: 0.02,
        onComplete: () => {
          works.forEach((wk) => wk.classList.toggle('is-out', !visiveis.includes(wk)));
          ST.refresh();
          gsap.fromTo(visiveis, { opacity: 0, y: 40 }, { opacity: 1, y: 0, stagger: 0.08, duration: 1.1 });
          visiveis.forEach((wk) => { const cap = $('.arch__cap', wk); if (cap) gsap.set(cap, { opacity: 1, y: 0 }); });
        },
      });
    });
  }

  /* ------------------------------------------------------------------------
     Imagens dos projetos em WebGL (sem bibliotecas)
     - Duotom (tinta esverdeada + papel) por padrão
     - O cursor deixa um rastro “líquido” que revela as cores originais,
       com uma borda sálvia
     - Rolar rápido curva a coluna (as bordas se abrem, como uma lente)
       e borra levemente na vertical
     - Parallax dentro de cada imagem e entrada suave ao aparecer
     ------------------------------------------------------------------------ */
  function galeriaGL() {
    const imgs = $$('img[data-gl]');
    if (!imgs.length || reduced) return;

    const canvas = d.createElement('canvas');
    canvas.className = 'gl-stage';
    canvas.setAttribute('aria-hidden', 'true');
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true });
    if (!gl) return;
    d.body.appendChild(canvas);

    const VS = `
      attribute vec2 aPos;
      uniform vec2 uView; uniform vec4 uRect; uniform float uBend; uniform float uEnter;
      varying vec2 vUv;
      void main() {
        vUv = aPos;
        vec2 px = uRect.xy + aPos * uRect.zw;
        px.y += (1.0 - uEnter) * 90.0;
        float ny = clamp(px.y / uView.y * 2.0 - 1.0, -1.4, 1.4);
        float cx = uRect.x + uRect.z * 0.5;
        px.x += (px.x - cx) * uBend * ny * ny;
        px.y += sin(aPos.x * 3.14159) * uBend * 70.0 * ny;
        gl_Position = vec4(px.x / uView.x * 2.0 - 1.0, 1.0 - px.y / uView.y * 2.0, 0.0, 1.0);
      }`;
    const FS = `
      precision highp float;
      #define N_GOTAS 28
      uniform sampler2D uTex;
      uniform vec2 uRes; uniform vec2 uPlane; uniform vec2 uImg;
      uniform float uTime; uniform float uVel; uniform float uPar; uniform float uEnter; uniform float uColor; uniform float uDpr;
      uniform vec3 uDark; uniform vec3 uLight; uniform vec3 uRim;
      uniform vec3 uGotas[N_GOTAS];   // x, y (px da tela) e raio de cada gota do rastro
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      void main() {
        // object-fit: cover alinhado ao topo, com folga para o parallax
        float pr = uPlane.x / uPlane.y; float ir = uImg.x / uImg.y;
        vec2 s = pr > ir ? vec2(1.0, ir / pr) : vec2(pr / ir, 1.0);
        s /= 1.1;
        vec2 uv = vUv * s;
        uv.x += (1.0 - s.x) * 0.5;
        uv.y += (1.0 - s.y) * clamp(0.5 + uPar * 0.5, 0.0, 1.0);

        float v = clamp(uVel, -1.0, 1.0);
        // Desfoque vertical contínuo conforme a velocidade da rolagem (5 amostras)
        vec2 o = vec2(0.0, v * 0.012);
        vec3 c = texture2D(uTex, uv).rgb * 0.3
               + texture2D(uTex, uv + o * 0.5).rgb * 0.2 + texture2D(uTex, uv - o * 0.5).rgb * 0.2
               + texture2D(uTex, uv + o).rgb * 0.15 + texture2D(uTex, uv - o).rgb * 0.15;

        float lum = dot(c, vec3(0.299, 0.587, 0.114));
        vec3 duo = mix(uDark, uLight, smoothstep(0.04, 0.96, lum));

        // Rastro líquido: soma de “metaballs” calculada por pixel (borda lisa,
        // sem serrilhado). Uma ondulação de baixa frequência deixa a forma orgânica.
        vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
        vec2 q = px + (vec2(noise(px * 0.005 + uTime * 0.35), noise(px * 0.005 - uTime * 0.3 + 7.1)) - 0.5) * 22.0;
        float f = 0.0;
        for (int i = 0; i < N_GOTAS; i++) {
          vec3 g = uGotas[i];
          if (g.z > 0.5) {
            vec2 dd = q - g.xy;
            float k = (g.z * g.z) / (dot(dd, dd) + 1.0);
            f += k * k;
          }
        }
        float reveal = smoothstep(0.9, 1.1, f);
        float rim = smoothstep(0.66, 0.76, f) * (1.0 - smoothstep(0.9, 1.02, f));

        vec3 col = mix(duo, c, max(reveal, uColor));
        col = mix(col, uRim, rim * 0.9 * (1.0 - uColor));
        gl_FragColor = vec4(col, 1.0) * uEnter;
      }`;

    const compilar = (tipo, src) => { const sh = gl.createShader(tipo); gl.shaderSource(sh, src); gl.compileShader(sh); return sh; };
    const prog = gl.createProgram();
    gl.attachShader(prog, compilar(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compilar(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { canvas.parentNode.removeChild(canvas); return; }
    gl.useProgram(prog);

    // Malha subdividida (permite a curvatura)
    const NX = 20; const NY = 20;
    const verts = []; const idx = [];
    for (let y = 0; y <= NY; y++) for (let x = 0; x <= NX; x++) verts.push(x / NX, y / NY);
    for (let y = 0; y < NY; y++) {
      for (let x = 0; x < NX; x++) {
        const i = y * (NX + 1) + x;
        idx.push(i, i + 1, i + NX + 1, i + 1, i + NX + 2, i + NX + 1);
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const U = {};
    ['uView', 'uRect', 'uBend', 'uEnter', 'uTex', 'uRes', 'uPlane', 'uImg', 'uTime', 'uVel', 'uPar', 'uColor', 'uDpr', 'uDark', 'uLight', 'uRim']
      .forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });
    U.uGotas = gl.getUniformLocation(prog, 'uGotas[0]');
    const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    gl.uniform3fv(U.uRim, rgb('#a3b899'));
    gl.uniform1i(U.uTex, 0);

    const novaTextura = () => {
      const t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return t;
    };

    let dpr = 1; let VW = 0; let VH = 0;
    const redimensionar = () => {
      dpr = Math.min(w.devicePixelRatio || 1, 2);
      VW = w.innerWidth; VH = w.innerHeight;
      canvas.width = Math.round(VW * dpr); canvas.height = Math.round(VH * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    redimensionar();
    w.addEventListener('resize', redimensionar);

    // Gotas do rastro (mouse e toque): cada uma nasce no cursor e encolhe
    // suavemente até sumir. Gotas próximas se fundem como líquido.
    const N_GOTAS = 28;
    const VIDA = 1100;              // ms até a gota sumir por completo
    const gotas = [];               // { x, y, r, t }
    const dadosGotas = new Float32Array(N_GOTAS * 3);
    let ultimaGota = null;
    const pingar = (x, y) => {
      const agora = performance.now();
      let velGota = 0;
      if (ultimaGota) {
        const dist = Math.hypot(x - ultimaGota.x, y - ultimaGota.y);
        if (dist < 9 && agora - ultimaGota.t < 40) return;
        velGota = (dist / Math.max(16, agora - ultimaGota.t)) * 16;
      }
      const g = { x, y, r: clamp(34 + velGota * 1.4, 34, 74), t: agora };
      gotas.push(g);
      if (gotas.length > N_GOTAS) gotas.shift();
      ultimaGota = g;
    };
    w.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') pingar(e.clientX, e.clientY); }, { passive: true });
    w.addEventListener('touchmove', (e) => { const t = e.touches[0]; if (t) pingar(t.clientX, t.clientY); }, { passive: true });
    w.addEventListener('touchend', () => { ultimaGota = null; }, { passive: true });
    d.documentElement.addEventListener('pointerleave', () => { ultimaGota = null; });

    // Planos: um por imagem
    const planos = imgs.map((img) => ({ img, caixa: img.closest('[data-gl-media]') || img, tex: null, w: 1, h: 1, entrada: 0, entrou: false }));
    const carregar = (p) => {
      if (p.tex || p.carregando) return;
      p.carregando = true;
      const fonte = new Image();
      fonte.decoding = 'async';
      fonte.onload = () => {
        p.tex = novaTextura();
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fonte);
        p.w = fonte.naturalWidth; p.h = fonte.naturalHeight;
        p.caixa.classList.add('gl-ready');
      };
      fonte.src = p.img.currentSrc || p.img.src;
    };
    planos.forEach((p) => {
      if (p.img.complete && p.img.naturalWidth) carregar(p);
      else p.img.addEventListener('load', () => carregar(p), { once: true });
    });

    let tempo = 0;
    let ultimoScroll = w.scrollY;
    let vel = 0;
    gsap.ticker.add(() => {
      tempo += 0.016;
      // Velocidade da rolagem (suavizada)
      const sy = w.scrollY;
      const bruto = lenis ? lenis.velocity : sy - ultimoScroll;
      ultimoScroll = sy;
      vel = lerp(vel, bruto, 0.12);
      const curva = clamp(Math.abs(vel) * 0.0075, 0, 0.3);

      // Raio atual de cada gota: cresce rápido ao nascer e depois encolhe devagar
      // (curva suave), até zerar no fim da vida.
      const agora = performance.now();
      while (gotas.length && agora - gotas[0].t > VIDA) gotas.shift();
      dadosGotas.fill(0);
      gotas.forEach((g, i) => {
        const u = (agora - g.t) / VIDA;
        const nascer = Math.min(1, 0.45 + (agora - g.t) / 160);
        const encolher = 0.5 * (1 + Math.cos(Math.PI * Math.min(1, u)));
        dadosGotas[i * 3] = g.x;
        dadosGotas[i * 3 + 1] = g.y;
        dadosGotas[i * 3 + 2] = g.r * nascer * encolher;
      });
      gl.uniform3fv(U.uGotas, dadosGotas);
      gl.uniform1f(U.uDpr, dpr);

      // Duotom acompanha a paleta da seção (claro = fundo; escuro = texto puxado para o verde)
      const cores = coresDoTema();
      const lum = (c) => c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114;
      const [claroT, escuroT] = lum(cores.bg) > lum(cores.fg) ? [cores.bg, cores.fg] : [cores.fg, cores.bg];
      const verde = [0.078, 0.129, 0.102];
      gl.uniform3fv(U.uLight, claroT);
      gl.uniform3fv(U.uDark, escuroT.map((v, i) => v * 0.5 + verde[i] * 0.5));

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(U.uView, VW, VH);
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform1f(U.uTime, tempo);
      gl.uniform1f(U.uBend, curva);
      gl.uniform1f(U.uVel, vel / 40);

      for (const p of planos) {
        if (!p.tex) continue;
        const r = p.caixa.getBoundingClientRect();
        if (r.bottom < -200 || r.top > VH + 200 || r.width === 0) continue;
        if (!p.entrou && r.top < VH * 0.96) {
          p.entrou = true;
          gsap.to(p, { entrada: 1, duration: 1.6, ease: 'expo.out' });
        }
        const centro = (r.top + r.height / 2) / VH;  // 0 = topo, 1 = base
        gl.uniform4f(U.uRect, r.left, r.top, r.width, r.height);
        gl.uniform2f(U.uPlane, r.width, r.height);
        gl.uniform2f(U.uImg, p.w, p.h);
        gl.uniform1f(U.uPar, clamp(centro * 2 - 1, -1, 1));
        gl.uniform1f(U.uEnter, p.entrada);
        // Sem mouse (celular): a imagem no centro da tela ganha cor aos poucos
        const alvoCor = fine ? 0 : 1 - clamp((Math.abs(centro - 0.5) - 0.12) / 0.25, 0, 1);
        p.cor = lerp(p.cor || 0, alvoCor, 0.08);
        gl.uniform1f(U.uColor, p.cor);
        gl.bindTexture(gl.TEXTURE_2D, p.tex);
        gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
      }
    });
  }

  /* ------------------------------------------------------------------------
     Início
     ------------------------------------------------------------------------ */
  heroCanvas();
  heroPeso();
  filtros();
  galeriaGL();

  const comecar = veioDeTransicao ? chegar() : rodarLoader();
  comecar.then(() => {
    if (lenis) lenis.start();
    introducao();
    rolagem();
    temaPorSecao();
    if (location.hash) {
      const alvo = d.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (alvo) setTimeout(() => scrollTo(alvo, { immediate: true }), 50);
    }
    // Recalcula posições quando as fontes e as imagens terminarem de carregar
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(() => ST.refresh());
    w.addEventListener('load', () => ST.refresh());
  });
})();
