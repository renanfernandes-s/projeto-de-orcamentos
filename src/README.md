# 📄 OrçaFácil — Gerador de Orçamentos Profissionais

O **OrçaFácil** é um Micro-SaaS projetado para ajudar prestadores de serviços e autônomos (eletricistas, pintores, manicures, freelancers) a criarem orçamentos profissionais e enviarem direto para os seus clientes via WhatsApp ou PDF.

---

## 🛠️ Tecnologias Utilizadas

* **Build Tool:** [Vite](https://vitejs.dev/)
* **Linguagem:** JavaScript (Vanilla ES6+)
* **Estilização:** [Tailwind CSS v3](https://tailwindcss.com/) + PostCSS
* **Ícones & Layout:** HTML5 semântico e design responsivo (Mobile First)

---

## 📌 Funcionalidades Implementadas

### 1. Configuração e Estrutura Base (Segunda-feira)
- [x] Inicialização do ambiente de desenvolvimento leve e rápido com Vite.
- [x] Configuração completa do Tailwind CSS v3 para estilização utilitária.
- [x] Criação da estrutura de pastas modularizada (`src/`, `public/`).
- [x] Layout principal responsivo (Grid de 2 colunas para desktop, pilha para mobile).

### 2. Interface Dinâmica & Motor de Cálculos (Terça-feira)
- [x] **Preenchimento em Tempo Real:** Edição simultânea dos dados do prestador, cliente e observações refletida no documento A4.
- [x] **Tabela Dinâmica de Itens:** Adição e remoção interativa de serviços e produtos.
- [x] **Cálculo Automático de Subtotais:** Atualização em tempo real de quantidade × valor unitário e soma do valor total.
- [x] **Estrutura de Checkout Pix (Modal):** Interface visual pronta para exibição do QR Code quando o limite gratuito for atingido.

---

## 📂 Estrutura de Pastas Atual

```text
orcafacil/
├── node_modules/
├── public/
├── src/
│   ├── main.js          # Lógica principal, manipulação do DOM e cálculos
│   └── style.css        # Importação das diretivas do Tailwind CSS
├── index.html           # Interface do formulário, folha A4 e modal Pix
├── package.json         # Dependências do projeto
├── postcss.config.js    # Configuração do PostCSS para Tailwind
├── tailwind.config.js   # Configuração de escopo do Tailwind CSS
└── README.md            # Documentação do projeto