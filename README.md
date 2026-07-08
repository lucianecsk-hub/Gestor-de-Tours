# Gestor de Tours & Invoices

App para lançamentos diários de tours, cálculo de comissão do City Tour (escalonada),
registro de humor/nota do dia e geração de invoice em PDF. Cada pessoa tem login próprio
(e-mail e senha) e só enxerga os próprios dados — protegido por Row Level Security no Supabase.

## Configuração do Supabase (já em andamento)

### 1. Rodar o schema
No painel do Supabase → **SQL Editor** → **New query** → cole todo o conteúdo do arquivo
`schema.sql` (raiz deste projeto) → **Run**.

Isso cria:
- Tabela `entries` (um registro por lançamento)
- Tabela `settings` (uma linha por usuário, com as configurações de comissão/invoice)
- Row Level Security ativado em ambas, com políticas que só liberam cada usuário
  ver/editar as próprias linhas (`user_id = auth.uid()`)

### 2. Ativar login por e-mail e senha
No painel do Supabase → **Authentication → Providers** → confirme que **Email** está
habilitado (vem habilitado por padrão). Se quiser pular a etapa de confirmação por e-mail
(mais simples para uso pessoal), vá em **Authentication → Settings** e desmarque
"Confirm email".

### 3. Variáveis de ambiente na Vercel
No projeto na Vercel → **Settings → Environment Variables**, adicione:
- `NEXT_PUBLIC_SUPABASE_URL` → a URL do seu projeto Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → a "anon/publishable key" (Settings → API no Supabase)

Essas duas são seguras para expor publicamente — quem protege os dados é o RLS, não o
sigilo dessas chaves.

### 4. Redeploy
Depois de configurar as variáveis, vá em **Deployments** na Vercel e clique em
**Redeploy** no último deploy.

## Como funciona o login
- Primeira vez: crie uma conta com e-mail e senha na própria tela do app.
- Cada usuário só vê seus próprios lançamentos e configurações (garantido pelo banco,
  não só pela interface).
- Botão "Sair" no canto superior direito encerra a sessão.

## Rodando localmente (opcional)
```bash
npm install
# crie um arquivo .env.local com:
# NEXT_PUBLIC_SUPABASE_URL=...
# NEXT_PUBLIC_SUPABASE_ANON_KEY=...
npm run dev
```
Abra http://localhost:3000

## Ajustando a comissão do City Tour
Direto no app, aba **Configurações**: defina o limite de tours vendidos, a taxa até esse
limite e a taxa acima dele.
