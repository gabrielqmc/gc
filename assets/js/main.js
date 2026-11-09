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
  const cortina = $('[data-transicao]');
  const cortinaLabel = $('[data-transicao-label]');
  const veioDeTransicao = store.get('gc-transicao') !== null;

  function sairDaCortina() {
    store.set('gc-visto', '1');
    const loaderEl = $('[data-loader]');
    if (loaderEl) loaderEl.classList.add('is-done');
    if (!cortina) return Promise.resolve();
    const label = store.get('gc-transicao') || '';
    store.del('gc-transicao');
    cortinaLabel.textContent = label;
    cortina.classList.add('is-covering');
    return new Promise((resolve) => {
      gsap.timeline({ onComplete: () => { cortina.classList.remove('is-covering'); gsap.set(cortina, { clearProps: 'clipPath' }); resolve(); } })
        .to(cortinaLabel, { yPercent: -110, duration: 0.7, ease: 'expo.in', delay: 0.15 })
        .fromTo(cortina, { clipPath: 'inset(0% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1, ease: 'expo.inOut' }, '-=0.35');
      setTimeout(resolve, 1600);
    });
  }

  function navegar(url, label) {
    store.set('gc-transicao', label || '');
    cortinaLabel.textContent = label || '';
    if (lenis) lenis.stop();
    gsap.timeline({ onComplete: () => { w.location.href = url; } })
      .fromTo(cortina, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.85, ease: 'expo.inOut' })
      .fromTo(cortinaLabel, { yPercent: 110 }, { yPercent: 0, duration: 0.7, ease: 'expo.out' }, '-=0.35');
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
    navegar(url.href, a.dataset.transition || a.textContent.trim().split('\n')[0]);
  });

  // Voltar pelo histórico (bfcache): garante que a cortina não fique cobrindo
  w.addEventListener('pageshow', (e) => {
    if (e.persisted && cortina) {
      cortina.classList.remove('is-covering');
      gsap.set(cortina, { clearProps: 'clipPath' });
      if (lenis) lenis.start();
    }
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
      ctx.fillStyle = 'rgba(17,17,16,0.26)';
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

    // Vitrine: revelação por máscara + parallax interno + leve escala
    $$('[data-work]').forEach((work) => {
      const media = $('.work__media', work);
      const img = $('img', work);
      if (!media) return;
      if (!reduced) {
        gsap.fromTo(media, { clipPath: 'inset(100% 0% 0% 0%)' }, {
          clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.inOut',
          scrollTrigger: { trigger: work, start: 'top 85%', once: true },
        });
        if (img) {
          gsap.fromTo(img, { yPercent: -7 }, { yPercent: 7, ease: 'none', scrollTrigger: { trigger: media, start: 'top bottom', end: 'bottom top', scrub: true } });
        }
        gsap.fromTo($('.work__cap', work), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1.2, scrollTrigger: { trigger: work, start: 'top 75%', once: true } });
      }
    });

    // Índice: linhas entram em sequência; miniaturas (mobile) com máscara
    const linhas = $$('[data-row]');
    if (linhas.length && !reduced) {
      ST.batch(linhas, {
        start: 'top 92%', once: true,
        onEnter: (els) => gsap.fromTo(els, { opacity: 0, y: 40 }, { opacity: 1, y: 0, stagger: 0.08, duration: 1.2 }),
      });
      $$('.row__thumb').forEach((t) => {
        gsap.fromTo(t, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'expo.inOut', scrollTrigger: { trigger: t, start: 'top 90%', once: true } });
      });
    }

    // Serviços: as linhas desenham da esquerda para a direita
    // (o reveal de opacidade já vem de [data-reveal])

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

    // Página de projeto: capa abre com a rolagem e o navegador ganha profundidade
    const capa = $('[data-cover]');
    if (capa && !reduced) {
      gsap.fromTo(capa, { clipPath: 'inset(8% 10% 8% 10% round 6px)' }, {
        clipPath: 'inset(0% 0% 0% 0% round 0px)', ease: 'none',
        scrollTrigger: { trigger: capa, start: 'top 90%', end: 'top 15%', scrub: true },
      });
      const img = $('img', capa);
      if (img) gsap.fromTo(img, { scale: 1.25 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: capa, start: 'top bottom', end: 'bottom top', scrub: true } });
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
     Inclinação 3D nas imagens da vitrine (só com mouse)
     ------------------------------------------------------------------------ */
  function inclinacao() {
    if (!fine || reduced) return;
    $$('[data-tilt]').forEach((el) => {
      gsap.set(el, { transformPerspective: 1100 });
      const rx = gsap.quickTo(el, 'rotationX', { duration: 0.9, ease: 'power3.out' });
      const ry = gsap.quickTo(el, 'rotationY', { duration: 0.9, ease: 'power3.out' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        ry(px * 7); rx(-py * 7);
      });
      el.addEventListener('pointerleave', () => { rx(0); ry(0); });
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
          gsap.set(works, { clearProps: 'gridColumn' });
          ST.refresh();
          gsap.fromTo(visiveis, { opacity: 0, y: 40 }, { opacity: 1, y: 0, stagger: 0.08, duration: 1.1 });
          visiveis.forEach((wk) => {
            const media = $('.work__media', wk);
            if (media) gsap.set(media, { clipPath: 'inset(0% 0% 0% 0%)' });
            const cap = $('.work__cap', wk);
            if (cap) gsap.set(cap, { opacity: 1, y: 0 });
          });
        },
      });
    });
  }

  /* ------------------------------------------------------------------------
     Prévia dos projetos em WebGL (índice): distorção pela velocidade do mouse,
     separação RGB e onda na troca de projeto. Sem bibliotecas.
     ------------------------------------------------------------------------ */
  function previaWebGL() {
    const canvas = $('[data-preview-gl]');
    const lista = $('[data-index-list]');
    if (!canvas || !lista || !fine || reduced) return;
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: true });
    if (!gl) return;

    const vs = `
      attribute vec2 aPos;
      uniform vec2 uRes; uniform vec4 uRect; uniform vec2 uVel; uniform float uScale;
      varying vec2 vUv;
      void main() {
        vUv = aPos;
        vec2 c = aPos - 0.5;
        float dd = dot(c, c) * 2.0;
        vec2 px = uRect.xy + (c * uScale + 0.5) * uRect.zw - uVel * dd * 1.4;
        gl_Position = vec4(px.x / uRes.x * 2.0 - 1.0, 1.0 - px.y / uRes.y * 2.0, 0.0, 1.0);
      }`;
    const fs = `
      precision mediump float;
      uniform sampler2D uTex; uniform float uAlpha; uniform vec2 uShift; uniform float uTime; uniform float uWave;
      varying vec2 vUv;
      void main() {
        vec2 uv = vUv;
        uv.y += sin(uv.x * 9.0 + uTime * 3.0) * 0.025 * uWave;
        uv.x += cos(uv.y * 7.0 + uTime * 2.0) * 0.012 * uWave;
        float r = texture2D(uTex, uv + uShift).r;
        float g = texture2D(uTex, uv).g;
        float b = texture2D(uTex, uv - uShift).b;
        gl_FragColor = vec4(r, g, b, 1.0) * uAlpha;
      }`;
    const sh = (tipo, src) => { const s = gl.createShader(tipo); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    // Malha subdividida para permitir a curvatura
    const NX = 24; const NY = 16;
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
    ['uRes', 'uRect', 'uVel', 'uScale', 'uTex', 'uAlpha', 'uShift', 'uTime', 'uWave'].forEach((n) => { U[n] = gl.getUniformLocation(prog, n); });

    let dpr = 1;
    const redimensionar = () => {
      dpr = Math.min(w.devicePixelRatio || 1, 2);
      canvas.width = w.innerWidth * dpr; canvas.height = w.innerHeight * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    redimensionar();
    w.addEventListener('resize', redimensionar);

    const texturas = new Map();
    const carregar = (src) => new Promise((resolve) => {
      if (texturas.has(src)) { resolve(texturas.get(src)); return; }
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        texturas.set(src, t);
        resolve(t);
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
    // Pré-carrega as texturas quando o índice se aproxima da tela
    new IntersectionObserver(([en], obs) => {
      if (!en.isIntersecting) return;
      obs.disconnect();
      $$('[data-row]', lista).forEach((r) => carregar(r.dataset.preview));
    }, { rootMargin: '400px' }).observe(lista);

    const estado = { x: mouse.x, y: mouse.y, alpha: 0, scale: 0.8, wave: 0, tex: null };
    const alvo = { alpha: 0, scale: 0.8 };
    let rodando = false;
    let tempo = 0;

    const loop = () => {
      tempo += 0.016;
      const largura = clamp(w.innerWidth * 0.24, 260, 440);
      const altura = largura * 10 / 16;
      estado.x = lerp(estado.x, mouse.x, 0.13);
      estado.y = lerp(estado.y, mouse.y, 0.13);
      estado.alpha = lerp(estado.alpha, alvo.alpha, 0.14);
      estado.scale = lerp(estado.scale, alvo.scale, 0.12);
      const vx = clamp(mouse.x - estado.x, -160, 160);
      const vy = clamp(mouse.y - estado.y, -160, 160);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (estado.tex && estado.alpha > 0.002) {
        gl.uniform2f(U.uRes, w.innerWidth, w.innerHeight);
        gl.uniform4f(U.uRect, estado.x - largura / 2, estado.y - altura / 2, largura, altura);
        gl.uniform2f(U.uVel, vx, vy);
        gl.uniform1f(U.uScale, estado.scale);
        gl.uniform1f(U.uAlpha, estado.alpha);
        gl.uniform2f(U.uShift, vx / largura * 0.06, vy / altura * 0.06);
        gl.uniform1f(U.uTime, tempo);
        gl.uniform1f(U.uWave, estado.wave);
        gl.bindTexture(gl.TEXTURE_2D, estado.tex);
        gl.uniform1i(U.uTex, 0);
        gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
      }
      if (alvo.alpha === 0 && estado.alpha < 0.002) { rodando = false; gl.clear(gl.COLOR_BUFFER_BIT); return; }
      requestAnimationFrame(loop);
    };
    const iniciar = () => { if (!rodando) { rodando = true; estado.x = mouse.x; estado.y = mouse.y; requestAnimationFrame(loop); } };

    $$('[data-row]', lista).forEach((row) => {
      row.addEventListener('pointerenter', async () => {
        if (!desktop()) return;
        const t = await carregar(row.dataset.preview);
        if (!t || !row.matches(':hover')) return;
        const trocou = estado.tex && estado.tex !== t;
        estado.tex = t;
        alvo.alpha = 1; alvo.scale = 1;
        if (trocou) { estado.wave = 1; gsap.to(estado, { wave: 0, duration: 0.9, ease: 'power3.out', overwrite: true }); }
        iniciar();
      });
    });
    lista.addEventListener('pointerleave', () => { alvo.alpha = 0; alvo.scale = 0.8; });
    w.addEventListener('scroll', () => { if (!lista.matches(':hover')) { alvo.alpha = 0; alvo.scale = 0.8; } }, { passive: true });
  }

  /* ------------------------------------------------------------------------
     Início
     ------------------------------------------------------------------------ */
  heroCanvas();
  heroPeso();
  inclinacao();
  filtros();
  previaWebGL();

  const comecar = veioDeTransicao ? sairDaCortina() : rodarLoader();
  comecar.then(() => {
    if (lenis) lenis.start();
    introducao();
    rolagem();
    if (location.hash) {
      const alvo = d.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (alvo) setTimeout(() => scrollTo(alvo, { immediate: true }), 50);
    }
    // Recalcula posições quando as fontes e as imagens terminarem de carregar
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(() => ST.refresh());
    w.addEventListener('load', () => ST.refresh());
  });
})();
