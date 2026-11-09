// Gera o site final a partir de src/ + projetos.json:
//   - assets/css/style.css         (Tailwind compilado e minificado)
//   - assets/js/vendor/*           (GSAP, ScrollTrigger e Lenis copiados de node_modules)
//   - index.html e projetos.html   (na raiz, prontos para publicar)
//   - trabalhos/<slug>.html        (uma página para cada projeto)
//   - sitemap.xml e robots.txt     (quando "site.url" estiver preenchido)
//
// Uso: npm run gerar
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { RAIZ, lerDados, existe, caminhoVariante } from './lib.mjs';

const SRC = path.join(RAIZ, 'src');
const CSS_SAIDA = 'assets/css/style.css';
const JS_PRINCIPAL = 'assets/js/main.js';
const PASTA_TRABALHOS = 'trabalhos';

const dados = lerDados();
const site = dados.site || {};
const siteUrl = (site.url || '').trim().replace(/\/?$/, '/');
const temUrl = siteUrl !== '/';
if (!temUrl) {
  console.warn('⚠️  "site.url" está vazio em projetos.json: a imagem de compartilhamento (WhatsApp/LinkedIn) pode não aparecer. Preencha com o domínio do site.');
}

// 1) CSS (Tailwind) e bibliotecas
const binTailwind = path.join(RAIZ, 'node_modules', '.bin', 'tailwindcss');
execFileSync(binTailwind, ['-i', 'src/styles.css', '-o', CSS_SAIDA, '--minify'], {
  cwd: RAIZ, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, BROWSERSLIST_IGNORE_OLD_DATA: '1' },
});
const VENDOR = {
  'gsap.min.js': 'node_modules/gsap/dist/gsap.min.js',
  'ScrollTrigger.min.js': 'node_modules/gsap/dist/ScrollTrigger.min.js',
  'lenis.min.js': 'node_modules/lenis/dist/lenis.min.js',
};
fs.mkdirSync(path.join(RAIZ, 'assets/js/vendor'), { recursive: true });
for (const [nome, origem] of Object.entries(VENDOR)) {
  const conteudo = fs.readFileSync(path.join(RAIZ, origem), 'utf8').replace(/\n\/\/# sourceMappingURL=.*$/m, '');
  fs.writeFileSync(path.join(RAIZ, 'assets/js/vendor', nome), conteudo);
}
const hash = (arquivo) => crypto.createHash('md5').update(fs.readFileSync(path.join(RAIZ, arquivo))).digest('hex').slice(0, 8);
const versaoCss = hash(CSS_SAIDA);
const versaoJs = hash(JS_PRINCIPAL);

// 2) Dados de apoio
const projetos = dados.projetos || [];
const total = projetos.length;
const dois = (n) => String(n).padStart(2, '0');
const linkWhats = (msg) => `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(msg || '')}`;
const ano = new Date().getFullYear();
const paginaProjeto = (p) => `${PASTA_TRABALHOS}/${p.slug}.html`;
const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

const parciais = Object.fromEntries(
  fs.readdirSync(path.join(SRC, 'partials')).map((f) => [path.basename(f, '.html'), fs.readFileSync(path.join(SRC, 'partials', f), 'utf8').replace(/\n$/, '')]),
);

const SETA = '<span class="arrow" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 17 17 7M8 7h9v9"/></svg><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 17 17 7M8 7h9v9"/></svg></span>';
const SETA_BAIXO = '<span class="arrow arrow--down" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 5v14M6 13l6 6 6-6"/></svg><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 5v14M6 13l6 6 6-6"/></svg></span>';

// ---------- Páginas ----------
const saidas = [];

saidas.push({
  arquivo: 'index.html',
  raiz: '',
  vars: {
    titulo: 'Gabriel Capinzaiki | Web Designer Estratégico',
    descricao: 'Transforme a presença digital do seu negócio. Desenvolvimento de sites estratégicos, rápidos e focados em conversão que transmitem credibilidade.',
    ogTitulo: 'Gabriel Capinzaiki | Especialista em Criação de Sites Estratégicos',
    ogDescricao: 'Seu negócio precisa de mais do que um site bonito. Crio plataformas digitais rápidas e focadas em conversão para destacar sua marca e atrair clientes na internet.',
    inicio: '#inicio',
    home: '',
    feedItens: projetos.map((p, i) => feedItem(p, '', i)).join('\n'),
    feedNomes: projetos.map((p) => `                            <span>${esc(p.nome)}</span>`).join('\n'),
    feedMeta: projetos.map((p, i) => `                            <div${i === 0 ? ' class="is-active"' : ''} data-meta-url="${paginaProjeto(p)}" data-meta-nome="${esc(p.nome)}"><span class="mono muted">${esc((p.tags || []).join(' · '))}</span><p>${esc(p.descricao)}</p></div>`).join('\n'),
  },
});

const contagemTags = new Map();
for (const p of projetos) for (const t of p.tags || []) contagemTags.set(t, (contagemTags.get(t) || 0) + 1);
saidas.push({
  arquivo: 'projetos.html',
  raiz: '',
  vars: {
    titulo: 'Todos os Projetos | Gabriel Capinzaiki',
    descricao: 'Explore o portfólio completo de Gabriel Capinzaiki. Sites estratégicos e de alta conversão para clínicas, advogados, músicos e diversos negócios.',
    ogTitulo: 'Portfólio | Gabriel Capinzaiki',
    ogDescricao: 'Sites estratégicos e de alta conversão para clínicas, advogados, músicos e diversos negócios.',
    inicio: 'index.html',
    home: 'index.html',
    filtros: [
      `                <button type="button" class="filter is-active" data-filter="*" aria-pressed="true">Todos<sup>${dois(total)}</sup></button>`,
      ...[...contagemTags].map(([t, n]) =>
        `                <button type="button" class="filter" data-filter="${esc(t)}" aria-pressed="false">${esc(t)}<sup>${dois(n)}</sup></button>`),
    ].join('\n'),
    arquivo: projetos.map((p, i) => arch(p, '', i)).join('\n'),
  },
});

projetos.forEach((p, i) => {
  const prox = projetos[(i + 1) % total];
  saidas.push({
    arquivo: paginaProjeto(p),
    raiz: '../',
    vars: {
      titulo: `${p.nome} | Gabriel Capinzaiki`,
      descricao: p.descricao || `Projeto ${p.nome}, desenvolvido por Gabriel Capinzaiki.`,
      ogTitulo: `${p.nome} | Portfólio Gabriel Capinzaiki`,
      ogDescricao: p.descricao || '',
      inicio: '../index.html',
      home: '../index.html',
      pNome: esc(p.nome),
      pDescricao: esc(p.descricao),
      pUrl: esc(p.url),
      pHost: esc(host(p.url)),
      pTags: esc((p.tags || []).join(', ') || '—'),
      pNum: dois(i + 1),
      pCapa: imagem(p, '../', { cls: 'cover-img', sizes: '100vw', lazy: false, alt: `Página inicial do site ${p.nome}` }),
      pImagemBrowser: imagem(p, '../', { sizes: '(min-width: 1240px) 1180px, 92vw', alt: `Site ${p.nome} em um navegador` }),
      proxUrl: `${prox.slug}.html`,
      proxNome: esc(prox.nome),
      proxNum: dois(((i + 1) % total) + 1),
      proxImagem: imagem(prox, '../', { sizes: '420px', alt: '' }),
    },
  });
});

// Remove páginas de projetos que saíram do portfólio
const pastaTrabalhos = path.join(RAIZ, PASTA_TRABALHOS);
fs.mkdirSync(pastaTrabalhos, { recursive: true });
const validos = new Set(projetos.map((p) => `${p.slug}.html`));
for (const f of fs.readdirSync(pastaTrabalhos)) if (f.endsWith('.html') && !validos.has(f)) fs.rmSync(path.join(pastaTrabalhos, f));

for (const { arquivo, raiz, vars: especificas } of saidas) {
  const urlPagina = temUrl ? siteUrl + (arquivo === 'index.html' ? '' : arquivo) : '';
  const vars = {
    raiz,
    canonical: temUrl ? `<link rel="canonical" href="${urlPagina}">` : '',
    ogUrl: temUrl ? `<meta property="og:url" content="${urlPagina}">` : '',
    ogImagem: (temUrl ? siteUrl : raiz) + 'assets/img/og.jpg',
    versaoCss,
    versaoJs,
    ano,
    whatsapp: linkWhats(site.mensagemWhatsapp),
    whatsappPortfolio: linkWhats(site.mensagemWhatsappPortfolio || site.mensagemWhatsapp),
    totalProjetos: total,
    totalProjetos2: dois(total),
    seta: SETA,
    setaBaixo: SETA_BAIXO,
    ...especificas,
  };

  let html = fs.readFileSync(path.join(SRC, arquivo.startsWith(PASTA_TRABALHOS) ? 'projeto.html' : arquivo), 'utf8');
  html = html.replace(/\{\{>\s*(\w+)\s*\}\}/g, (_, nome) => {
    if (!(nome in parciais)) throw new Error(`Parcial "${nome}" não encontrado em src/partials/`);
    return parciais[nome];
  });
  html = html.replace(/\{\{(\w+)\}\}/g, (_, nome) => {
    if (!(nome in vars)) throw new Error(`Variável "{{${nome}}}" sem valor em ${arquivo}`);
    return String(vars[nome]);
  });
  html = html.replace(/^[ \t]+$/gm, ''); // limpa linhas que ficaram só com espaços (ex.: canonical vazio)
  html = html.replace('<!DOCTYPE html>', '<!DOCTYPE html>\n<!-- ARQUIVO GERADO AUTOMATICAMENTE (npm run gerar). Edite src/ e projetos.json, não este arquivo. -->');

  fs.writeFileSync(path.join(RAIZ, arquivo), html);
}
console.log(`📝 ${saidas.length} páginas (index, projetos e ${total} página(s) de projeto)`);

// 3) sitemap.xml / robots.txt
if (temUrl) {
  const hoje = new Date().toISOString().slice(0, 10);
  const urls = saidas.map(({ arquivo }) => `  <url><loc>${siteUrl}${arquivo === 'index.html' ? '' : arquivo}</loc><lastmod>${hoje}</lastmod></url>`);
  fs.writeFileSync(path.join(RAIZ, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
  fs.writeFileSync(path.join(RAIZ, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /foga.html\n\nSitemap: ${siteUrl}sitemap.xml\n`);
  console.log('🗺️  sitemap.xml e robots.txt');
}

console.log(`✅ Site gerado com ${total} projeto(s).`);

// ---------- Componentes ----------

function esc(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** <img> com srcset a partir das variantes que existirem (640, 1200, 1920). */
function imagem(p, raiz, { cls = '', sizes = '100vw', lazy = true, alt } = {}) {
  if (!existe(p.imagem)) return '';
  const variantes = [[caminhoVariante(p.imagem, 640), 640], [p.imagem, 1200], [caminhoVariante(p.imagem, 1920), 1920]]
    .filter(([arq]) => existe(arq));
  const srcset = variantes.map(([arq, w]) => `${raiz}${arq} ${w}w`).join(', ');
  return `<img src="${raiz}${p.imagem}" srcset="${srcset}" sizes="${sizes}" width="1200" height="750"${lazy ? ' loading="lazy"' : ' fetchpriority="high"'} decoding="async" alt="${esc(alt ?? `Página inicial do site ${p.nome}`)}"${cls ? ` class="${cls}"` : ''}>`;
}

/** Item da coluna de trabalhos (imagem desenhada em WebGL por cima do <img>). */
function feedItem(p, raiz, i) {
  return `                    <li>
                        <a href="${raiz}${paginaProjeto(p)}" class="feed__item" data-feed-item data-zoom data-transition="${esc(p.nome)}" data-cursor-label="Ver projeto">
                            <div class="feed__media" data-gl-media>${imagem(p, raiz, { sizes: '(min-width: 861px) 50vw, 100vw' }).replace('<img ', '<img data-gl ')}</div>
                            <div class="feed__cap"><span class="mono muted tabular">${dois(i + 1)}</span><strong>${esc(p.nome)}</strong><p>${esc(p.descricao)}</p></div>
                        </a>
                    </li>`;
}

/** Peça do arquivo (página de todos os projetos). */
function arch(p, raiz, i) {
  return `                <a href="${raiz}${paginaProjeto(p)}" class="arch" data-work data-zoom data-tags="${esc((p.tags || []).join('|'))}" data-transition="${esc(p.nome)}" data-cursor-label="Ver projeto">
                    <div class="gl-media" data-gl-media>${imagem(p, raiz, { sizes: '(min-width: 861px) 58vw, 100vw' }).replace('<img ', '<img data-gl ')}</div>
                    <div class="arch__cap">
                        <span class="mono muted tabular">${dois(i + 1)}</span>
                        <span class="arch__name"><span class="roll">${esc(p.nome)}</span></span>
                        <span class="mono muted">${esc((p.tags || []).join(' · '))}</span>
                        <p class="arch__desc">${esc(p.descricao)}</p>
                    </div>
                </a>`;
}
