# 📄 OrçaFácil — Gerador de Orçamentos Profissionais

O **OrçaFácil** é um Micro-SaaS projetado para ajudar prestadores de serviços e autônomos (eletricistas, pintores, manicures, freelancers) a criarem orçamentos profissionais e enviarem direto para os seus clientes via WhatsApp ou PDF.

---

## 🛠️ Tecnologias e Infraestrutura

* **Frontend:** HTML5, Tailwind CSS, JavaScript (Vanilla ES6+)
* **Hospedagem:** Vercel (Deploy contínuo via GitHub)
* **Domínio & SSL:** `useorcafacilapp.com.br` via Registro.br e Vercel
* **Banco de Dados & Auth:** Supabase (PostgreSQL, Row Level Security - RLS)
* **Pagamentos:** Asaas (Integração Pix para plano PRO)

---

## 📌 Funcionalidades Implementadas

### 1. Configuração, Arquitetura Base & Deploy
- [x] **Ambiente e Stack Leve:** Estruturação nativa com HTML5, JavaScript Vanilla (ES6+) e Tailwind CSS, garantindo alta performance sem dependência de build pesado.
- [x] **Integração Backend & Banco de Dados:** Conexão com o ecossistema Supabase (Auth, PostgreSQL, Row Level Security e Triggers automatizadas).
- [x] **Layout Mobile-First & Preview:** Interface responsiva otimizada para uso em smartphones no campo e visualização simultânea do documento A4 em telas maiores.
- [x] **Pipeline de Deploy Contínuo:** Integração do repositório GitHub com a Vercel e configuração do domínio personalizado (`useorcafacilapp.com.br`).

### 2. Interface Dinâmica, Motor de Cálculos e Controle de Acesso
- [x] **Preenchimento em Tempo Real:** Edição simultânea dos dados do prestador, cliente e observações refletida instantaneamente na visualização A4.
- [x] **Tabela Dinâmica de Itens:** Adição e remoção interativa de serviços e produtos.
- [x] **Cálculo Automático de Subtotais:** Atualização em tempo real do cálculo (Quantidade × Valor Unitário) e da soma total da proposta.
- [x] **Validação de Acesso & Limite Gratuito:** Verificação do status de usuário através do banco de dados (Supabase Auth/RLS).
- [x] **Checkout Pix & Autenticação:** Modal integrado para login/cadastro de conta e exibição do QR Code Pix para upgrade ao Plano PRO ilimitado.

## 🔐 Arquitetura de Segurança & Dados

* **Autenticação:** Gerenciada pelo Supabase Auth com modal responsivo em Tailwind CSS.
* **Controle de Acesso (RLS):** Políticas aplicadas na tabela `public.profiles` para garantir que o usuário acesse apenas seus próprios dados.
* **Gatilho de Cadastro (`Trigger`):** Função `on_auth_user_created` no PostgreSQL para criar automaticamente a linha do perfil assim que o e-mail é registrado.
* **Gestão de Assinatura:** Coluna `is_pro` vinculada ao ID do usuário para liberação de uso ilimitado.


## 🚀 Como Rodar Localmente

1. Clone o repositório:
   ```bash
   git clone [https://github.com/renanfernandes-s/orcafacil.git](https://github.com/renanfernandes-s/orcafacil.git)
---

## 📂 Estrutura de Pastas Atual

Carregando...