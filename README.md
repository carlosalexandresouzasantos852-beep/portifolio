# Site de serviços de programação (com banco de dados)

Site para você apresentar seus serviços (bots de Discord, sites, suporte),
com botão de WhatsApp em cada pacote e um painel administrativo que salva
tudo em um **banco de dados SQLite de verdade**. Assim, quando você edita
algo no painel, a alteração fica gravada no servidor e qualquer pessoa que
abrir o link do site já vê a versão atualizada — não depende do seu
computador nem do seu navegador.

## O que tem aqui

- `server.js` — o servidor (Node.js + Express) que guarda os dados no banco
- `public/index.html` — o site que os visitantes veem (e o painel admin)
- `data/site.db` — o arquivo do banco de dados (é criado sozinho na primeira vez que o servidor roda)
- `.env.example` — onde fica o código de acesso do painel administrativo

## Como rodar no seu computador (pra testar)

Você precisa ter o [Node.js](https://nodejs.org) instalado (versão 18 ou mais nova).

```bash
npm install
cp .env.example .env
npm start
```

Depois é só abrir **http://localhost:3000** no navegador. O ícone de
engrenagem no canto abre o painel administrativo (o código padrão é
`admin123` — troque no arquivo `.env`, na linha `ADMIN_CODE`).

## Como colocar no ar de verdade (pra mandar o link pros clientes)

Esse projeto é um servidor Node.js comum, então ele roda em qualquer
hospedagem que suporte Node. As mais fáceis pra começar, de graça ou bem
baratas:

- **Render.com** — cria um "Web Service", aponta pro seu repositório (ou
  sobe os arquivos), comando de start `npm start`. Ele te dá um link tipo
  `seusite.onrender.com`.
- **Railway.app** — parecido com o Render, também bem simples.
- Qualquer VPS (ex: Hostinger, DigitalOcean) — sobe os arquivos, instala o
  Node, roda `npm install && npm start` (de preferência com um gerenciador
  tipo `pm2` pra manter o site sempre ligado).

Em qualquer uma dessas opções, defina a variável de ambiente `ADMIN_CODE`
nas configurações do serviço (é o mesmo papel do arquivo `.env`, só que
direto no painel da hospedagem) — assim seu código de acesso não fica
exposto nos arquivos do projeto.

**Atenção com o banco de dados:** o arquivo `data/site.db` precisa
continuar existindo entre uma atualização e outra do site. Em algumas
hospedagens gratuitas (como o Render free) o disco pode ser apagado quando
o serviço reinicia sozinho por inatividade — se notar isso acontecendo,
me avise que a gente ajusta pra usar um banco externo (tipo Postgres) que
não tem esse problema.

## Sobre a senha do painel

O código de acesso (`ADMIN_CODE`) é uma trava simples: protege contra
visitante curioso, mas não é uma segurança robusta tipo login de banco.
Pra esse tipo de site (portfólio pessoal, poucos acessos), costuma ser
suficiente. Se quiser algo mais forte no futuro (senha por usuário, etc.),
dá pra evoluir.
