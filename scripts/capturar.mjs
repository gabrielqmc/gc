// Tira o "print" dos sites do portfólio e salva as imagens otimizadas (WebP).
//
// Uso:
//   node scripts/capturar.mjs                 -> só os projetos que ainda não têm imagem
//   node scripts/capturar.mjs --slug maira-justo
//   node scripts/capturar.mjs --todos         -> refaz o print de todos os projetos
//
// Se o projeto não tiver "nome" ou "descricao" no projetos.json, eles são
// preenchidos automaticamente com o título e a descrição (meta tags) do site.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { chromium } from 'playwright';
import { RAIZ, PASTA_PRINTS, lerDados, salvarDados, lerArgs, existe, caminhoVariante } from './lib.mjs';

const LARGURAS = [1200, 640];
const VIEWPORT = { width: 1440, height: 900 }; // 16:10, mesma proporção dos cards

const args = lerArgs();
const dados = lerDados();

const alvos = dados.projetos.filter((p) => {
  if (args.slug) return p.slug === args.slug;
  if (args.todos) return true;
  return !existe(p.imagem);
});

if (args.slug && alvos.length === 0) {
  console.error(`Nenhum projeto com slug "${args.slug}".`);
  process.exit(1);
}
if (alvos.length === 0) {
  console.log('Todos os projetos já têm print. Nada a fazer.');
  process.exit(0);
}

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const contexto = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 2,
  locale: 'pt-BR',
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
});

let falhas = 0;
for (const projeto of alvos) {
  console.log(`📸 ${projeto.url}`);
  const pagina = await contexto.newPage();
  try {
    await abrir(pagina, projeto.url);
    await prepararPagina(pagina);

    const meta = await pagina.evaluate(() => {
      const m = (sel) => document.querySelector(sel)?.getAttribute('content')?.trim() || '';
      return {
        titulo: m('meta[property="og:title"]') || document.title.trim(),
        descricao: m('meta[name="description"]') || m('meta[property="og:description"]'),
      };
    });
    if (!projeto.nome) projeto.nome = limparTitulo(meta.titulo) || new URL(projeto.url).hostname;
    if (!projeto.descricao) projeto.descricao = meta.descricao;

    const png = await pagina.screenshot({ type: 'png' });
    const base = `${PASTA_PRINTS}/${projeto.slug}.webp`;
    fs.mkdirSync(path.join(RAIZ, PASTA_PRINTS), { recursive: true });
    for (const largura of LARGURAS) {
      const destino = largura === LARGURAS[0] ? base : caminhoVariante(base, largura);
      await sharp(png).resize({ width: largura }).webp({ quality: largura > 800 ? 78 : 75 }).toFile(path.join(RAIZ, destino));
    }
    projeto.imagem = base;
    projeto.capturadoEm = new Date().toISOString().slice(0, 10);
    console.log(`   ✅ ${base}  (${projeto.nome})`);
  } catch (erro) {
    falhas++;
    console.error(`   ❌ Falha ao capturar ${projeto.url}: ${erro.message}`);
  } finally {
    await pagina.close();
  }
}

await browser.close();
salvarDados(dados);

if (falhas) {
  console.error(`\n${falhas} site(s) não puderam ser capturados.`);
  process.exitCode = 1;
}

async function abrir(pagina, url) {
  try {
    await pagina.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  } catch {
    // Alguns sites nunca ficam "ociosos" na rede (chats, analytics); seguimos mesmo assim.
    await pagina.goto(url, { waitUntil: 'load', timeout: 60000 });
  }
}

async function prepararPagina(pagina) {
  // Passa pela página para disparar imagens "lazy" e animações de entrada, depois volta ao topo.
  await pagina.evaluate(async () => {
    const espera = (ms) => new Promise((r) => setTimeout(r, ms));
    const altura = document.documentElement.scrollHeight;
    for (let y = 0; y < Math.min(altura, 6000); y += 600) {
      window.scrollTo(0, y);
      await espera(120);
    }
    window.scrollTo(0, 0);
  });
  await pagina.waitForTimeout(2500);
  await pagina.evaluate(() => document.fonts && document.fonts.ready);
}

function limparTitulo(titulo) {
  // "Dra. Fulana | Estética Avançada" -> "Dra. Fulana"
  return titulo.split(/\s[|–—-]\s/)[0].trim();
}
