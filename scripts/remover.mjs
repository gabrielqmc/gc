// Remove um site do portfólio (projetos.json) e apaga os prints dele.
// Depois disso, rode "npm run gerar" para atualizar as páginas.
//
// Uso:
//   node scripts/remover.mjs --projeto "Maira Justo"
//   node scripts/remover.mjs --projeto maira-justo
//   node scripts/remover.mjs --projeto https://mairajusto.vercel.app/
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ, lerDados, salvarDados, lerArgs, caminhoVariante, encontrarProjetos, listarProjetos } from './lib.mjs';

const args = lerArgs();
const busca = typeof args.projeto === 'string' ? args.projeto.trim() : '';
const dados = lerDados();
const lista = () => listarProjetos(dados.projetos);

if (!busca) {
  console.error(`Informe o projeto (nome, slug ou link): node scripts/remover.mjs --projeto "Nome"\n\nProjetos atuais:\n${lista()}`);
  process.exit(1);
}

const encontrados = encontrarProjetos(dados.projetos, busca);

if (encontrados.length !== 1) {
  console.error(`${encontrados.length ? 'Mais de um' : 'Nenhum'} projeto corresponde a "${busca}". Use o nome, o slug ou o link exatamente como abaixo:\n${lista()}`);
  process.exit(1);
}

const [projeto] = encontrados;
dados.projetos = dados.projetos.filter((p) => p !== projeto);
salvarDados(dados);

if (projeto.imagem) {
  for (const arquivo of [projeto.imagem, caminhoVariante(projeto.imagem, 640)]) {
    const caminho = path.join(RAIZ, arquivo);
    if (fs.existsSync(caminho)) fs.rmSync(caminho);
  }
}

console.log(`🗑️  Projeto "${projeto.nome}" removido do portfólio.`);
