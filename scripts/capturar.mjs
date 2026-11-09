// Tira o "print" e grava um vídeo curto de prévia dos sites do portfólio.
//
// Uso:
//   node scripts/capturar.mjs                 -> projetos sem print e/ou sem vídeo
//   node scripts/capturar.mjs --projeto "Maira Justo"   -> refaz print e vídeo desse (nome, slug ou link)
//   node scripts/capturar.mjs --todos         -> refaz print e vídeo de todos os projetos
//   node scripts/capturar.mjs --videos        -> só os vídeos que faltam (não mexe nos prints)
//   node scripts/capturar.mjs --todos --videos -> regrava os vídeos de todos (não mexe nos prints)
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
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const contexto = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, locale: 'pt-BR', userAgent: USER_AGENT });
let contextoVideo = null;

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
      await gravarVideo(projeto.url, path.join(RAIZ, destino));
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
async function gravarVideo(url, destino) {
  // Página própria em resolução normal (1440x900, sem retina): o vídeo final tem
  // 1280x800, e desenhar em resolução dupla deixava a máquina do GitHub lenta
  // demais para registrar todos os quadros nos sites mais pesados.
  if (!contextoVideo) {
    contextoVideo = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, locale: 'pt-BR', userAgent: USER_AGENT });
  }
  const pagina = await contextoVideo.newPage();
  try {
    await abrir(pagina, url);
    await prepararPagina(pagina);
    await gravarTela(pagina, destino);
  } finally {
    await pagina.close();
  }
}

async function gravarTela(pagina, destino) {
  const pastaQuadros = fs.mkdtempSync(path.join(os.tmpdir(), 'quadros-'));
  const cdp = await pagina.context().newCDPSession(pagina);
  const quadros = [];
  cdp.on('Page.screencastFrame', (f) => {
    quadros.push({ data: f.data, t: f.metadata.timestamp });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await pagina.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await pagina.mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2);
  await pagina.waitForTimeout(600);
  const alvo = await pagina.evaluate(() => Math.max(0, Math.min(
    document.documentElement.scrollHeight - window.innerHeight,
    window.innerHeight * 1.6,
  )));
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: 1440, maxHeight: 900, everyNthFrame: 1 });

  // Roteiro: pausa no topo, desce ~1,6 tela, pausa, volta ao topo.
  // A rolagem é feita com a roda do mouse, em pequenos passos contínuos (acelera e
  // desacelera), como uma pessoa rolando: assim sites com rolagem suave própria
  // (Lenis, scroll-behavior: smooth etc.) se movem do jeito que se movem para um visitante.
  await pagina.waitForTimeout(1200);
  await rolarComRoda(pagina, alvo, 3800);
  await pagina.waitForTimeout(1300);
  await rolarComRoda(pagina, -alvo, 3200);
  await pagina.waitForTimeout(1200);
  // Garante que termina exatamente no topo (o loop do vídeo fica contínuo)
  if (await pagina.evaluate(() => window.scrollY > 2)) {
    await rolarComRoda(pagina, -(await pagina.evaluate(() => window.scrollY)) - 40, 500);
    await pagina.waitForTimeout(700);
  }
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

/**
 * Rola `distancia` px ao longo de `ms`, seguindo uma curva suave (acelera e
 * desacelera), com um pequeno passo a cada quadro, dentro da própria página:
 * - cada passo é enviado como um evento de roda do mouse; se o site usa uma
 *   biblioteca de rolagem suave (Lenis, Locomotive...), ela trata o evento e
 *   anima do jeito dela, como faria com um visitante;
 * - se ninguém tratar o evento, a página é rolada diretamente.
 * A rolagem suave do CSS (scroll-behavior: smooth) é desligada só durante a
 * gravação, porque ela transforma cada passo numa animação própria e faz a
 * página “pular”.
 */
async function rolarComRoda(pagina, distancia, ms) {
  await pagina.evaluate(async ([dist, duracao]) => {
    if (!document.getElementById('__sem-rolagem-suave')) {
      const st = document.createElement('style');
      st.id = '__sem-rolagem-suave';
      st.textContent = 'html, body { scroll-behavior: auto !important; }';
      document.head.appendChild(st);
    }
    const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    await new Promise((resolve) => {
      const inicio = performance.now();
      let enviado = 0;
      const quadro = (agora) => {
        const u = Math.min(1, (agora - inicio) / duracao);
        const passo = dist * suave(u) - enviado;
        enviado += passo;
        if (passo) {
          const x = window.innerWidth / 2;
          const y = window.innerHeight / 2;
          const alvo = document.elementFromPoint(x, y) || document.body;
          const evento = new WheelEvent('wheel', { deltaY: passo, deltaMode: 0, clientX: x, clientY: y, bubbles: true, cancelable: true });
          const ninguemTratou = alvo.dispatchEvent(evento);
          if (ninguemTratou) window.scrollBy(0, passo);
        }
        if (u < 1) requestAnimationFrame(quadro); else resolve();
      };
      requestAnimationFrame(quadro);
    });
  }, [distancia, ms]);
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
