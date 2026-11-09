// Tira o "print" dos sites do portfólio e salva as imagens otimizadas (WebP).
//
// Uso:
//   node scripts/capturar.mjs                 -> só os projetos que ainda não têm imagem
//   node scripts/capturar.mjs --projeto "Maira Justo"   -> refaz só esse (nome, slug ou link)
//   node scripts/capturar.mjs --todos         -> refaz o print de todos os projetos
//
// Se o projeto não tiver "nome" ou "descricao" no projetos.json, eles são
// preenchidos automaticamente com o título e a descrição (meta tags) do site.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { chromium } from 'playwright';
import { RAIZ, PASTA_PRINTS, lerDados, salvarDados, lerArgs, existe, caminhoVariante, encontrarProjetos, listarProjetos } from './lib.mjs';

const LARGURAS = [1200, 640, 1920]; // a primeira é a imagem principal; as outras são variantes (-640, -1920)
const VIEWPORT = { width: 1440, height: 900 }; // 16:10, mesma proporção dos cards

const args = lerArgs();
const dados = lerDados();

const busca = typeof args.projeto === 'string' ? args.projeto.trim() : '';
const alvos = busca
  ? encontrarProjetos(dados.projetos, busca)
  : dados.projetos.filter((p) => args.todos || !existe(p.imagem));

if (busca && alvos.length !== 1) {
  console.error(`${alvos.length ? 'Mais de um' : 'Nenhum'} projeto corresponde a "${busca}". Use o nome, o slug ou o link exatamente como abaixo:\n${listarProjetos(dados.projetos)}`);
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
    // Registra no log o que o site diz sobre si, para conferir se o card precisa de ajuste
    console.log(`   título do site: ${meta.titulo || '(vazio)'}`);
    console.log(`   descrição do site: ${meta.descricao || '(vazia)'}`);
    if (!projeto.nome) projeto.nome = limparTitulo(meta.titulo) || new URL(projeto.url).hostname;
    if (!projeto.descricao) projeto.descricao = meta.descricao;

    const png = await pagina.screenshot({ type: 'png' });
    const base = `${PASTA_PRINTS}/${projeto.slug}.webp`;
    fs.mkdirSync(path.join(RAIZ, PASTA_PRINTS), { recursive: true });
    for (const largura of LARGURAS) {
      const destino = largura === LARGURAS[0] ? base : caminhoVariante(base, largura);
      await sharp(png).resize({ width: largura }).webp({ quality: largura > 1500 ? 80 : largura > 800 ? 78 : 75 }).toFile(path.join(RAIZ, destino));
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
  await fecharAvisoDeCookies(pagina);
  await pagina.evaluate(() => document.fonts && document.fonts.ready);
}

async function fecharAvisoDeCookies(pagina) {
  // 1) Tenta clicar no botão de aceitar do aviso de cookies/LGPD.
  const textoAceitar = /^\s*(aceitar( todos( os cookies)?)?|aceito|concordo|entendi|ok|permitir( todos)?|accept( all)?|allow all|got it|i agree)\s*$/i;
  const botoes = pagina.locator('button, a, [role="button"]').filter({ hasText: textoAceitar });
  const total = await botoes.count();
  for (let i = 0; i < total; i++) {
    const botao = botoes.nth(i);
    const ehDeCookie = await botao.evaluate((el) => {
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        if (/cookie|lgpd|privacidade|privacy|consent/i.test(n.textContent || '') && n.textContent.length < 2000) return true;
      }
      return false;
    }).catch(() => false);
    if (ehDeCookie && (await botao.isVisible().catch(() => false))) {
      await botao.click({ timeout: 3000 }).catch(() => {});
      await pagina.waitForTimeout(800);
      break;
    }
  }

  // 2) Se ainda sobrou algum aviso fixo na tela falando de cookies, esconde.
  await pagina.evaluate(() => {
    for (const el of document.querySelectorAll('body *')) {
      const estilo = getComputedStyle(el);
      if (!['fixed', 'sticky'].includes(estilo.position)) continue;
      const texto = el.textContent || '';
      if (/cookie|lgpd|consentimento|consent/i.test(texto) && texto.length < 2000) el.style.setProperty('display', 'none', 'important');
    }
  });
}

function limparTitulo(titulo) {
  // "Dra. Fulana | Estética Avançada" -> "Dra. Fulana"
  return titulo.split(/\s[|–—-]\s/)[0].trim();
}
