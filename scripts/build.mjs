// Gera o site final a partir de src/ + projetos.json:
//   - assets/css/style.css (Tailwind compilado e minificado)
//   - index.html e projetos.html (na raiz, prontos para publicar)
//   - sitemap.xml e robots.txt (quando "site.url" estiver preenchido)
//
// Uso: npm run gerar
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { RAIZ, lerDados, existe, caminhoVariante } from './lib.mjs';

const SRC = path.join(RAIZ, 'src');
const CSS_SAIDA = 'assets/css/style.css';
const PAGINAS = {
  'index.html': {
    titulo: 'Gabriel Capinzaiki | Web Designer Estratégico',
    descricao: 'Transforme a presença digital do seu negócio. Desenvolvimento de sites estratégicos, rápidos e focados em conversão que transmitem credibilidade.',
    ogTitulo: 'Gabriel Capinzaiki | Especialista em Criação de Sites Estratégicos',
    ogDescricao: 'Seu negócio precisa de mais do que um site bonito. Crio plataformas digitais rápidas e focadas em conversão para destacar sua marca e atrair clientes na internet.',
    inicio: '#inicio',
    base: '',
  },
  'projetos.html': {
    titulo: 'Todos os Projetos | Gabriel Capinzaiki',
    descricao: 'Explore o portfólio completo de Gabriel Capinzaiki. Sites estratégicos e de alta conversão para clínicas, advogados, músicos e diversos negócios.',
    ogTitulo: 'Portfólio | Gabriel Capinzaiki',
    ogDescricao: 'Sites estratégicos e de alta conversão para clínicas, advogados, músicos e diversos negócios.',
    inicio: 'index.html',
    base: 'index.html',
  },
};

const dados = lerDados();
const site = dados.site || {};
const siteUrl = (site.url || '').trim().replace(/\/?$/, '/');
const temUrl = siteUrl !== '/';
if (!temUrl) {
  console.warn('⚠️  "site.url" está vazio em projetos.json: a imagem de compartilhamento (WhatsApp/LinkedIn) pode não aparecer. Preencha com o domínio do site.');
}

// 1) CSS (Tailwind)
const binTailwind = path.join(RAIZ, 'node_modules', '.bin', 'tailwindcss');
execFileSync(binTailwind, ['-i', 'src/styles.css', '-o', CSS_SAIDA, '--minify'], { cwd: RAIZ, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, BROWSERSLIST_IGNORE_OLD_DATA: '1' } });
const versaoCss = crypto.createHash('md5').update(fs.readFileSync(path.join(RAIZ, CSS_SAIDA))).digest('hex').slice(0, 8);

// 2) Páginas
const projetos = dados.projetos || [];
const destaques = (projetos.filter((p) => p.destaque).length ? projetos.filter((p) => p.destaque) : projetos)
  .slice(0, site.maxDestaques || 4);

const hero = [
  ...projetos.filter((p) => existe(p.imagem)).map((p) => ({
    src: existe(caminhoVariante(p.imagem, 640)) ? caminhoVariante(p.imagem, 640) : p.imagem,
  })),
  ...(dados.galeria || []).filter((g) => existe(g.imagem)).map((g) => ({ src: g.imagem })),
];

const linkWhats = (msg) => `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(msg || '')}`;
const ano = new Date().getFullYear();

const parciais = Object.fromEntries(
  fs.readdirSync(path.join(SRC, 'partials')).map((f) => [path.basename(f, '.html'), fs.readFileSync(path.join(SRC, 'partials', f), 'utf8').replace(/\n$/, '')]),
);

for (const [arquivo, pagina] of Object.entries(PAGINAS)) {
  const urlPagina = temUrl ? siteUrl + (arquivo === 'index.html' ? '' : arquivo) : '';
  const vars = {
    ...pagina,
    canonical: temUrl ? `<link rel="canonical" href="${urlPagina}">` : '',
    ogUrl: temUrl ? `<meta property="og:url" content="${urlPagina}">` : '',
    ogImagem: (temUrl ? siteUrl : '') + 'assets/img/og.jpg',
    versaoCss,
    ano,
    whatsapp: linkWhats(site.mensagemWhatsapp),
    whatsappPortfolio: linkWhats(site.mensagemWhatsappPortfolio || site.mensagemWhatsapp),
    totalProjetos: projetos.length,
    projetosDestaque: destaques.map(card).join('\n\n'),
    projetosTodos: projetos.map(card).join('\n\n'),
    heroGaleria: carrossel(hero),
    heroDuracao: Math.max(15, hero.length * 5),
  };

  let html = fs.readFileSync(path.join(SRC, arquivo), 'utf8');
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
  console.log(`📝 ${arquivo}`);
}

// 3) sitemap.xml / robots.txt
if (temUrl) {
  const hoje = new Date().toISOString().slice(0, 10);
  const urls = Object.keys(PAGINAS).map((a) => `  <url><loc>${siteUrl}${a === 'index.html' ? '' : a}</loc><lastmod>${hoje}</lastmod></url>`);
  fs.writeFileSync(path.join(RAIZ, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
  fs.writeFileSync(path.join(RAIZ, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /foga.html\n\nSitemap: ${siteUrl}sitemap.xml\n`);
  console.log('🗺️  sitemap.xml e robots.txt');
}

console.log(`✅ Site gerado com ${projetos.length} projeto(s).`);

// ---------- Componentes ----------

function esc(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function imagemCard(p) {
  if (!existe(p.imagem)) {
    return `<div class="w-full h-full flex items-center justify-center text-cream/80 font-heading text-2xl font-bold px-6 text-center">${esc(p.nome)}</div>`;
  }
  const pequena = caminhoVariante(p.imagem, 640);
  const srcset = existe(pequena) ? ` srcset="${pequena} 640w, ${p.imagem} 1200w" sizes="(min-width: 1280px) 600px, (min-width: 768px) 50vw, 100vw"` : '';
  return `<img src="${p.imagem}"${srcset} width="1200" height="750" loading="lazy" decoding="async" alt="Página inicial do site ${esc(p.nome)}" class="w-full h-full object-cover object-top opacity-90 project-image transition-transform duration-700 ease-out">`;
}

function card(p) {
  const tags = (p.tags || []).map((t) =>
    `<span class="bg-cream/90 backdrop-blur text-green text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">${esc(t)}</span>`).join('\n                                ');
  return `                    <!-- Projeto: ${esc(p.nome)} -->
                    <a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" class="group project-card block bg-cream rounded-3xl overflow-hidden shadow-sm hover:shadow-2xl transition-shadow duration-500 border border-green-accent/10">
                        <div class="relative w-full aspect-[16/10] overflow-hidden bg-green">
                            ${imagemCard(p)}
                            <div class="absolute inset-0 bg-green/10 group-hover:bg-transparent transition-colors duration-500"></div>
                            <div class="absolute top-4 left-4 flex flex-wrap gap-2">
                                ${tags}
                            </div>
                            <div class="absolute inset-0 flex justify-center items-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <div class="bg-cream text-green w-16 h-16 rounded-full flex items-center justify-center shadow-xl transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                                    <i class="ph ph-arrow-up-right text-2xl" aria-hidden="true"></i>
                                </div>
                            </div>
                        </div>
                        <div class="p-8">
                            <h3 class="text-2xl font-bold font-heading mb-3 text-green group-hover:text-green-light transition-colors">${esc(p.nome)}</h3>
                            <p class="text-green/70 mb-6 line-clamp-2">${esc(p.descricao)}</p>
                            <div class="flex items-center text-sm font-semibold text-green-light uppercase tracking-wider gap-2">
                                Acessar site <i class="ph ph-arrow-right" aria-hidden="true"></i>
                            </div>
                        </div>
                    </a>`;
}

function carrossel(itens) {
  // Duas cópias idênticas, cada uma com o mesmo espaço no final: o -50% da animação
  // cai exatamente no início da segunda cópia e o loop fica sem "pulo".
  const copia = itens.map((i) =>
    `                                    <img src="${i.src}" alt="" width="640" height="400" loading="lazy" decoding="async" class="w-full rounded-xl shadow-md border border-green-accent/20">`).join('\n');
  const bloco = `                                <div class="flex flex-col gap-4 pb-4">\n${copia}\n                                </div>`;
  return `${bloco}\n${bloco}`;
}
