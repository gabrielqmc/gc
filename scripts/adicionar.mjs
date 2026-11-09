// Adiciona um novo site ao portfólio (projetos.json).
// Depois disso, rode "npm run capturar" e "npm run gerar" (ou "npm run novo", que faz tudo).
//
// Uso:
//   node scripts/adicionar.mjs --url https://site.com.br [--nome "Nome"] [--descricao "..."] [--tags "Estética, Website"] [--destaque sim|nao]
import { lerDados, salvarDados, lerArgs, slugify, slugUnico, validarUrl } from './lib.mjs';

const args = lerArgs();
if (!args.url || args.url === true) {
  console.error('Informe a URL: node scripts/adicionar.mjs --url https://site.com.br');
  process.exit(1);
}

const url = validarUrl(String(args.url).trim());
const dados = lerDados();

const normalizar = (u) => u.replace(/\/+$/, '').toLowerCase();
const repetido = dados.projetos.find((p) => normalizar(p.url) === normalizar(url));
if (repetido) {
  console.error(`Esse site já está no portfólio (slug "${repetido.slug}").`);
  process.exit(1);
}

const texto = (v) => (typeof v === 'string' ? v.trim() : '');
const nome = texto(args.nome);
const base = slugify(nome || new URL(url).hostname.replace(/^www\./, '').split('.')[0]);

const projeto = {
  slug: slugUnico(base, dados.projetos),
  nome,
  url,
  descricao: texto(args.descricao),
  tags: texto(args.tags).split(',').map((t) => t.trim()).filter(Boolean),
  destaque: !['nao', 'não', 'false', '0', 'no'].includes(String(args.destaque ?? 'sim').toLowerCase()),
};

// Projetos novos entram no topo da lista (mais recentes primeiro).
dados.projetos.unshift(projeto);
salvarDados(dados);
console.log(`➕ Projeto "${projeto.slug}" adicionado ao projetos.json.`);
