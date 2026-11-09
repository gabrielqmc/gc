// Tira o "print" e grava um vídeo curto de prévia dos sites do portfólio.
//
// Uso:
//   node scripts/capturar.mjs                 -> projetos sem print e/ou sem vídeo
//   node scripts/capturar.mjs --projeto "Maira Justo"   -> refaz print e vídeo desse (nome, slug ou link)
//   node scripts/capturar.mjs --todos         -> refaz print e vídeo de todos os projetos
//   node scripts/capturar.mjs --videos        -> só os vídeos que faltam (não mexe nos prints)
//
// Print: WebP em 1200, 640 e 1920 px.
// Vídeo: ~10 s, a página rola devagar até um pouco abaixo da primeira dobra e volta
// ao topo (loop contínuo), com as animações do próprio site. MP4 (H.264) leve.
// Precisa do ffmpeg instalado; sem ele, só o print é feito.
//
// Se o projeto não tiver "nome" ou "descricao" no projetos.json, eles são
// preenchidos automaticamente com o título e a descrição (meta tags) do site.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { chromium } from 'playwright';
import { RAIZ, PASTA_PRINTS, lerDados, salvarDados, lerArgs, existe, caminhoVariante, encontrarProjetos, listarProjetos } from './lib.mjs';

const LARGURAS = [1200, 640, 1920]; // a primeira é a imagem principal; as outras são variantes (-640, -1920)
const VIEWPORT = { width: 1440, height: 900 }; // 16:10, mesma proporção dos cards
const PASTA_VIDEOS = 'assets/video/projetos';

const temFfmpeg = (() => { try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; } })();
if (!temFfmpeg) console.warn('⚠️  ffmpeg não encontrado: os vídeos de prévia não serão gravados.');

const args = lerArgs();
const dados = lerDados();

const busca = typeof args.projeto === 'string' ? args.projeto.trim() : '';
let tarefas;
if (busca) {
  const achados = encontrarProjetos(dados.projetos, busca);
  if (achados.length !== 1) {
    console.error(`${achados.length ? 'Mais de um' : 'Nenhum'} projeto corresponde a "${busca}". Use o nome, o slug ou o link exatamente como abaixo:\n${listarProjetos(dados.projetos)}`);
    process.exit(1);
  }
  tarefas = achados.map((p) => ({ projeto: p, print: true, video: true }));
} else {
  tarefas = dados.projetos
    .map((p) => ({
      projeto: p,
      print: !args.videos && (args.todos || !existe(p.imagem)),
      video: args.todos || !existe(p.video),
    }))
    .filter((t) => t.print || (t.video && temFfmpeg));
}
if (!temFfmpeg) tarefas.forEach((t) => { t.video = false; });
tarefas = tarefas.filter((t) => t.print || t.video);

if (tarefas.length === 0) {
  console.log('Todos os projetos já têm print e vídeo. Nada a fazer.');
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
for (const { projeto, print, video } of tarefas) {
  console.log(`📸 ${projeto.url}${print ? ' (print)' : ''}${video ? ' (vídeo)' : ''}`);
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

    if (print) {
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
    }

    if (video) {
      const destino = `${PASTA_VIDEOS}/${projeto.slug}.mp4`;
      await gravarVideo(pagina, path.join(RAIZ, destino));
      projeto.video = destino;
      const kb = Math.round(fs.statSync(path.join(RAIZ, destino)).size / 1024);
      console.log(`   🎬 ${destino}  (${kb} KB)`);
    }
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

/**
 * Grava a tela em tempo real (screencast do Chromium) enquanto a página rola
 * devagar e volta ao topo; monta um MP4 respeitando o tempo real de cada quadro.
 */
async function gravarVideo(pagina, destino) {
  const pastaQuadros = fs.mkdtempSync(path.join(os.tmpdir(), 'quadros-'));
  const cdp = await pagina.context().newCDPSession(pagina);
  const quadros = [];
  cdp.on('Page.screencastFrame', (f) => {
    quadros.push({ data: f.data, t: f.metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await pagina.evaluate(() => window.scrollTo(0, 0));
  await pagina.waitForTimeout(400);
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 1440, maxHeight: 900, everyNthFrame: 1 });

  // Roteiro: pausa no topo, desce ~1,6 tela com aceleração suave, pausa, volta ao topo.
  await pagina.evaluate(async () => {
    const espera = (ms) => new Promise((r) => setTimeout(r, ms));
    const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const rolar = (de, ate, ms) => new Promise((res) => {
      const inicio = performance.now();
      const passo = (agora) => {
        const u = Math.min(1, (agora - inicio) / ms);
        window.scrollTo(0, de + (ate - de) * suave(u));
        if (u < 1) requestAnimationFrame(passo); else res();
      };
      requestAnimationFrame(passo);
    });
    const alvo = Math.max(0, Math.min(document.documentElement.scrollHeight - window.innerHeight, window.innerHeight * 1.6));
    await espera(1200);
    await rolar(0, alvo, 3600);
    await espera(1000);
    await rolar(alvo, 0, 2800);
    await espera(900);
  });
  await cdp.send('Page.stopScreencast');
  await cdp.detach().catch(() => {});

  if (quadros.length < 2) throw new Error('nenhum quadro gravado para o vídeo');

  // Lista do ffmpeg com a duração real de cada quadro
  const linhas = [];
  quadros.forEach((q, i) => {
    const arquivo = path.join(pastaQuadros, `q${String(i).padStart(5, '0')}.jpg`);
    fs.writeFileSync(arquivo, Buffer.from(q.data, 'base64'));
    const dur = i < quadros.length - 1 ? Math.max(0.001, quadros[i + 1].t - q.t) : 0.4;
    linhas.push(`file '${arquivo}'`, `duration ${dur.toFixed(4)}`);
  });
  linhas.push(`file '${path.join(pastaQuadros, `q${String(quadros.length - 1).padStart(5, '0')}.jpg`)}'`);
  const lista = path.join(pastaQuadros, 'lista.txt');
  fs.writeFileSync(lista, linhas.join('\n'));

  fs.mkdirSync(path.dirname(destino), { recursive: true });
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'concat', '-safe', '0', '-i', lista,
    '-vf', 'fps=30,scale=1280:-2:flags=lanczos,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-profile:v', 'high',
    '-movflags', '+faststart', '-an',
    destino,
  ]);
  fs.rmSync(pastaQuadros, { recursive: true, force: true });
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
