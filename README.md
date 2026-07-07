# Gestor de Tours & Invoices

App para lançamentos diários de tours, cálculo de comissão do City Tour (escalonada),
registro de humor/nota do dia e geração de invoice em PDF. Funciona em qualquer navegador,
com os dados guardados num banco de dados (não dependem de um computador específico).

## Passo a passo para colocar no ar (GitHub + Vercel + banco de dados)

Não é preciso saber programar — é só seguir os passos abaixo, uma vez só.

### 1. Criar o repositório no GitHub
1. Entre em https://github.com e crie uma conta (se ainda não tiver).
2. Clique em **New repository**, dê um nome (ex: `gestor-de-tours`), deixe **Private** marcado, e clique em **Create repository**.
3. Na sua máquina, dentro da pasta deste projeto, rode:
   ```bash
   git init
   git add .
   git commit -m "Primeira versão do app"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/gestor-de-tours.git
   git push -u origin main
   ```
   (troque `SEU-USUARIO` pelo seu usuário do GitHub — o próprio GitHub mostra esse comando
   exato na página do repositório recém-criado, em "…or push an existing repository from
   the command line").

### 2. Importar o projeto na Vercel
1. Entre em https://vercel.com e crie uma conta (pode entrar direto com o GitHub).
2. Clique em **Add New → Project**, escolha o repositório `gestor-de-tours` e clique em **Import**.
3. Não precisa mexer em nada nas configurações — clique em **Deploy**.
4. O primeiro deploy vai falhar (ainda não existe banco de dados conectado) — isso é esperado, siga para o próximo passo.

### 3. Criar o banco de dados
1. Dentro do projeto na Vercel, vá na aba **Storage**.
2. Clique em **Create Database**, escolha **Neon** (Postgres serverless, tem plano gratuito) e siga o assistente.
3. Depois de criado, clique em **Connect Project** e selecione o seu projeto — a Vercel
   cria automaticamente a variável de ambiente `DATABASE_URL` (ou nome parecido).
4. Vá em **Settings → Environment Variables** do projeto e confirme que existe uma variável
   chamada `DATABASE_URL` com a string de conexão. Se o nome vier diferente
   (ex: `DATABASE_URL_UNPOOLED`), copie o valor para uma variável chamada `DATABASE_URL`.

### 4. Criar as tabelas do banco
1. Ainda na aba **Storage** do projeto na Vercel, abra o banco Neon e procure a opção
   **SQL Editor** (ou **Query**).
2. Cole todo o conteúdo do arquivo `schema.sql` (está na raiz deste projeto) e execute.
   Isso cria as tabelas `entries` e `settings` e já deixa configurações padrão salvas.

### 5. Rodar o deploy de novo
1. Volte para a aba **Deployments** do projeto na Vercel.
2. Clique nos "..." do último deploy (o que falhou) e escolha **Redeploy**.
3. Agora deve funcionar. A Vercel te dá uma URL tipo `gestor-de-tours.vercel.app` —
   essa é a URL que você acessa de qualquer navegador, celular ou computador.

### Pronto
A partir daqui, sempre que você quiser mudar alguma coisa no app, é só me pedir, eu
atualizo o código, você substitui os arquivos no GitHub (ou eu te aviso exatamente o
que mudar) e a Vercel atualiza sozinha.

## Rodando localmente (opcional, só se quiser testar no seu computador antes)
```bash
npm install
# crie um arquivo .env.local com a linha:
# DATABASE_URL=postgres://... (a mesma string de conexão do Neon)
npm run dev
```
Abra http://localhost:3000

## Ajustando a comissão do City Tour
Direto no app, na aba **Configurações**: defina o limite de tours vendidos, a taxa até
esse limite e a taxa acima dele. Isso já estava configurado como exemplo ($15 até 15
tours, $20 acima) — ajuste para os valores reais.
