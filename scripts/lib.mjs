// Funções compartilhadas pelos scripts do portfólio.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const ARQUIVO_DADOS = path.join(RAIZ, 'projetos.json');
export const PASTA_PRINTS = 'assets/img/projetos';

export function lerDados() {
  return JSON.parse(fs.readFileSync(ARQUIVO_DADOS, 'utf8'));
}

export function salvarDados(dados) {
  fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(dados, null, 2) + '\n');
}

export function slugify(texto) {
  return String(texto)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'projeto';
}

export function slugUnico(base, projetos) {
  const usados = new Set(projetos.map((p) => p.slug));
  let slug = base;
  for (let i = 2; usados.has(slug); i++) slug = `${base}-${i}`;
  return slug;
}

export function validarUrl(url) {
  let u;
  try { u = new URL(url); } catch { throw new Error(`URL inválida: "${url}"`); }
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error(`A URL precisa começar com http:// ou https:// ("${url}")`);
  return u.href;
}

/** Lê argumentos no formato --chave valor / --flag */
export function lerArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const chave = a.slice(2);
    const prox = argv[i + 1];
    if (prox === undefined || prox.startsWith('--')) args[chave] = true;
    else { args[chave] = prox; i++; }
  }
  return args;
}

export function caminhoVariante(imagem, largura) {
  return imagem.replace(/\.webp$/, `-${largura}.webp`);
}

export function existe(relativo) {
  return Boolean(relativo) && fs.existsSync(path.join(RAIZ, relativo));
}
