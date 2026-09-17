# 📄 OrçaFácil — Gerador de Orçamentos Profissionais

O OrçaFácil é uma aplicação web para prestadores de serviços criarem orçamentos profissionais, personalizarem dados do cliente e enviarem tudo rapidamente por WhatsApp ou PDF.

A solução foi pensada para uso mobile-first, com foco em profissionais autônomos e pequenas empresas que precisam gerar propostas sem burocracia.

---

## 🧩 Stack

- Frontend: HTML, JavaScript vanilla, Tailwind CSS
- Build e serve: Vite
- Banco e autenticação: Supabase
- Pagamentos: Asaas
- Deploy: Vercel

---

## ✅ Funcionalidades principais

- Criação de orçamento com dados do prestador e do cliente
- Adição dinâmica de itens/serviços
- Cálculo automático de subtotal, descontos e total
- Pré-visualização do documento em layout A4
- Geração de PDF do orçamento
- Envio do orçamento via WhatsApp
- Login e autenticação com Supabase
- Plano PRO com controle de assinatura manual
- Aviso visual quando a assinatura está prestes a vencer
- Armazenamento de documentos e perfil do usuário

---

## 🔐 Fluxo de assinatura e segurança

A aplicação usa o Supabase para autenticação e armazenamento de perfil do usuário. O perfil contém flags como `is_pro`, `plan_status`, `plan_started_at`, `plan_expires_at` e dados do documento do prestador.

O plano PRO pode ser ativado por pagamento manual via Asaas, com data de validade registrada no banco. A verificação do acesso é feita no frontend e no perfil do usuário, e o aviso de vencimento aparece quando a assinatura está próxima do fim.

A estrutura de migrações em `supabase/migrations/` cobre regras de segurança e períodos de assinatura manual.

---

## 🚀 Como rodar localmente

1. Clone o repositório:

```bash
git clone <url-do-repositorio>
cd orcafacil
```

2. Instale as dependências:

```bash
npm install
```

3. Inicie o ambiente de desenvolvimento:

```bash
npm run dev
```

4. Para gerar o build de produção:

```bash
npm run build
```

5. Para visualizar o build gerado:

```bash
npm run preview
```

---

## 📁 Estrutura do projeto

```text
orcafacil/
├── api/                          # Rotas e integrações de backend
│   ├── _payment-utils.mjs
│   ├── consumir-pdf.mjs
│   ├── gerar-checkout.mjs
│   ├── gerar-pix.mjs
│   ├── status-pagamento.mjs
│   └── webhook-asaas.mjs
├── public/                      # Assets públicos
├── src/                         # Código do frontend
│   ├── assets/
│   ├── main.js
│   ├── style.css
│   ├── counter.js
│   ├── login.js
│   └── supabase.js
├── supabase/
│   └── migrations/
├── index.html
├── login.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
├── vercel.json
├── README.md
└── .gitignore
```

---

## 🔧 Variáveis de ambiente

Este projeto depende de variáveis de ambiente para autenticação e pagamentos. No ambiente de produção/Vercel, configure as chaves e URLs necessárias para:

- Supabase
- Asaas
- Webhook do Asaas

O arquivo `.env` não deve ser versionado.

Exemplo conceitual:

```env
VITE_SUPABASE_URL="https://xxxxx.supabase.co"
VITE_SUPABASE_ANON_KEY="xxxxx"
ASAAS_API_KEY="xxxxx"
ASAAS_WEBHOOK_TOKEN="xxxxx"
```

Os nomes exatos podem variar conforme a implementação do projeto e o ambiente em que for publicado.

---

## 💳 Pagamentos e assinatura PRO

- O fluxo de pagamento do plano PRO foi integrado com o Asaas.
- A assinatura é controlada por data de expiração e status do perfil.
- O usuário só é considerado PRO quando o status está ativo e a data de expiração ainda é válida.
- O aviso de vencimento aparece quando a assinatura está próxima do fim, no topo da tela do usuário logado.

Migrations relevantes no projeto:

- `supabase/migrations/202609140001_payment_safety.sql`
- `supabase/migrations/202609150001_professional_document.sql`
- `supabase/migrations/202609160001_manual_subscription.sql`

---

## 🧪 Observações de uso

- O app foi pensado para funcionar em celular e desktop, mantendo a experiência mobile-first.
- O documento final pode ser exportado em PDF e compartilhado pelo WhatsApp.
- O fluxo de assinatura manual foi desenhado para facilitar o controle de acesso sem depender de renovação automática ou recorrência complexa.

---

## 📌 Dica de manutenção

Ao alterar a lógica de pagamento ou assinatura, verifique sempre:

1. `plan_status`
2. `plan_expires_at`
3. `is_pro`
4. o banner de vencimento em `index.html` e `src/main.js`

Isso garante que o comportamento da assinatura continue consistente para usuários novos e antigos.
