# Portfólio – Gabriel Capinzaiki

Site estático (HTML + Tailwind) com o portfólio de sites desenvolvidos.
Os projetos ficam em **`projetos.json`**. As páginas `index.html` e `projetos.html` são **geradas automaticamente**, então não edite esses dois arquivos à mão.

## ➕ Adicionar um site ao portfólio (automático)

1. No GitHub, abra a aba **Actions**.
2. Escolha **"Adicionar projeto ao portfólio"** e clique em **Run workflow**.
3. Cole o **link do site**. Nome, descrição e etiquetas são opcionais: se ficarem vazios, o nome e a descrição são lidos do próprio site.
4. Clique em **Run workflow**. Em cerca de 2 minutos o robô:
   - abre o site e tira um print (1440×900, em WebP otimizado);
   - adiciona o card em `projetos.html` (e na página inicial, se "destaque" estiver marcado) e no carrossel do topo;
   - faz o commit, e a hospedagem publica a nova versão.

## 🗑️ Remover um site do portfólio

1. Na aba **Actions**, escolha **"Remover projeto do portfólio"** e clique em **Run workflow**.
2. Digite o **nome**, o **slug** ou o **link** do projeto (ex.: `Maira Justo` ou `mairajusto.vercel.app`).
3. Clique em **Run workflow**. O card e o print saem do site em cerca de 1 minuto.

Se o nome não bater com nenhum projeto, a execução falha (❌) e o log mostra a lista de projetos com os nomes certos.

## 🔄 Atualizar o print de um site

Quando um cliente mudar o site, rode o workflow **"Atualizar site"** e preencha:
- **"Ou refazer o print de UM projeto"** com o nome, slug ou link, para atualizar só esse; ou
- marque **"Refazer o print de TODOS os projetos"** para atualizar todos.

## ✏️ Editar um projeto

Edite o `projetos.json` (dá para fazer direto pelo GitHub, no ícone de lápis):

```json
{
  "slug": "maira-justo",
  "nome": "Maira Justo",
  "url": "https://mairajusto.vercel.app/",
  "descricao": "Texto do card…",
  "tags": ["Estética & Doula"],
  "destaque": true,
  "imagem": "assets/img/projetos/maira-justo.webp"
}
```

- **Ordem**: os cards aparecem na ordem da lista (os novos entram no topo).
- **`destaque: true`**: aparece na página inicial (no máximo `site.maxDestaques`).
- **`site.url`**: domínio do site (ex.: `https://gabrielcapinzaiki.com.br`). Ele é necessário para a prévia no WhatsApp e no LinkedIn e para gerar `sitemap.xml` e `robots.txt`.

Ao salvar, o workflow **"Atualizar site"** gera as páginas novamente sozinho.

## 💻 Rodando no computador (opcional)

```bash
npm install
npx playwright install chromium
```

```bash
npm run novo -- --url https://site-do-cliente.com.br --tags "Estética, Website"
```

```bash
npm run capturar
```

```bash
npm run gerar
```

| Comando | O que faz |
| --- | --- |
| `npm run novo -- --url …` | Adiciona o site ao `projetos.json` |
| `npm run remover -- --projeto "Nome"` | Remove o projeto e apaga os prints dele |
| `npm run capturar` | Tira o print dos projetos que ainda não têm imagem |
| `npm run capturar -- --projeto "Nome"` | Refaz o print de um projeto |
| `npm run prints:todos` | Refaz o print de todos os projetos |
| `npm run gerar` | Gera o CSS (Tailwind) e as páginas `index.html` e `projetos.html` |

## 📁 Estrutura

```
projetos.json            dados dos projetos (é aqui que você mexe)
src/index.html           modelo da página inicial
src/projetos.html        modelo da página de projetos
src/projeto.html         modelo da página de cada projeto (gera trabalhos/<slug>.html)
src/partials/            head, header (com menu mobile) e footer compartilhados
src/styles.css           estilos (Tailwind)
scripts/                 adicionar, remover, capturar (print) e build (gerar páginas)
assets/js/main.js        animações e interações (GSAP, ScrollTrigger, Lenis e WebGL)
assets/                  CSS gerado, bibliotecas (assets/js/vendor) e imagens otimizadas
.github/workflows/       automações do GitHub Actions
```
