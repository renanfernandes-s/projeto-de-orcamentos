import './style.css';
import html2pdf from 'html2pdf.js';
import { supabase, atualizarSenha } from './supabase.js';

// --- Estado da Aplicação ---
let currentUser = null;
let isProUser = false;
let userPdfCount = 0;

let itens = [
  { id: Date.now(), descricao: 'Serviço Exemplo', qtd: 1, preco: 150.00 }
];

// --- Seleção de Elementos do DOM ---
const listaItensEl = document.getElementById('lista-itens');
const btnAddItemEl = document.getElementById('btn-add-item');
const valorSubtotalEl = document.getElementById('valor-subtotal');
const valorTotalEl = document.getElementById('valor-total');

const btnGerarPdfEl = document.getElementById('btn-gerar-pdf');
const btnEnviarWhatsEl = document.getElementById('btn-enviar-whats');

const userEmailEl = document.getElementById('user-email');
const proBadgeEl = document.getElementById('pro-badge');

// --- Formatação Monetária ---
const formatarMoeda = (valor) => {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// --- Renderização e Cálculos ---
function calcularTotais() {
  const subtotal = itens.reduce((acc, item) => acc + (item.qtd * item.preco), 0);
  valorSubtotalEl.textContent = formatarMoeda(subtotal);
  valorTotalEl.textContent = formatarMoeda(subtotal);
}

function renderizarTabela() {
  listaItensEl.innerHTML = '';

  itens.forEach((item, index) => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-100 hover:bg-slate-50/50 transition';

    tr.innerHTML = `
      <td class="py-2 pr-2">
        <input 
          type="text" 
          value="${item.descricao}" 
          data-index="${index}" 
          data-field="descricao"
          class="item-input w-full text-xs bg-transparent border-b border-transparent focus:border-indigo-500 outline-none font-medium text-slate-700" 
          placeholder="Descrição do item"
        >
      </td>
      <td class="py-2 px-2 text-center w-12">
        <input 
          type="number" 
          min="1" 
          value="${item.qtd}" 
          data-index="${index}" 
          data-field="qtd"
          class="item-input w-full text-xs text-center bg-transparent border-b border-transparent focus:border-indigo-500 outline-none font-medium text-slate-700"
        >
      </td>
      <td class="py-2 pl-2 text-right w-24">
        <input 
          type="number" 
          step="0.01" 
          min="0" 
          value="${item.preco}" 
          data-index="${index}" 
          data-field="preco"
          class="item-input w-full text-xs text-right bg-transparent border-b border-transparent focus:border-indigo-500 outline-none font-semibold text-slate-800"
        >
      </td>
      <td class="py-2 pl-1 text-center w-6">
        <button 
          type="button" 
          data-index="${index}" 
          class="btn-remove text-slate-300 hover:text-red-500 font-bold text-sm transition"
          title="Remover Item"
        >&times;</button>
      </td>
    `;

    listaItensEl.appendChild(tr);
  });

  calcularTotais();
}

// --- Manipulação dos Itens ---
function adicionarItem() {
  itens.push({
    id: Date.now(),
    descricao: '',
    qtd: 1,
    preco: 0.00
  });
  renderizarTabela();
}

function removerItem(index) {
  if (itens.length === 1) {
    alert("O orçamento precisa ter pelo menos 1 item.");
    return;
  }
  itens.splice(index, 1);
  renderizarTabela();
}

function atualizarItem(index, field, value) {
  if (field === 'qtd') {
    itens[index].qtd = Math.max(1, parseInt(value) || 1);
  } else if (field === 'preco') {
    itens[index].preco = Math.max(0, parseFloat(value) || 0);
  } else {
    itens[index].descricao = value;
  }
  calcularTotais();
}

// --- Event Listeners dos Itens ---
btnAddItemEl.addEventListener('click', adicionarItem);

listaItensEl.addEventListener('input', (e) => {
  if (e.target.classList.contains('item-input')) {
    const index = e.target.dataset.index;
    const field = e.target.dataset.field;
    atualizarItem(index, field, e.target.value);
  }
});

listaItensEl.addEventListener('click', (e) => {
  if (e.target.classList.contains('btn-remove')) {
    const index = parseInt(e.target.dataset.index);
    removerItem(index);
  }
});

// --- Integração com Supabase (Sessão do Usuário e Saldo) ---
async function carregarUsuario() {
  const { data: { user } } = await supabase.auth.getUser();
  currentUser = user;

  if (user) {
    const userInfoCard = document.getElementById('user-info-card');
    if (userInfoCard) userInfoCard.classList.remove('hidden');

    userEmailEl.textContent = user.email;

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_pro, pdf_count')
      .eq('id', user.id)
      .single();

    if (profile) {
      isProUser = !!profile.is_pro;
      userPdfCount = profile.pdf_count || 0;

      if (isProUser) {
        proBadgeEl.classList.remove('hidden');
      } else {
        proBadgeEl.classList.add('hidden');
      }
    }
  }
}

// --- 1. Função Apenas para Gerar PDF (Com Bloqueio Seguro) ---
async function gerarPDF() {
  // 1. Exige que o usuário esteja logado
  if (!currentUser) {
    alert("Você precisa fazer login para gerar o orçamento.");
    window.location.href = '/login.html';
    return;
  }

  // 2. Trava de 3 PDFs para não-PRO no Banco de Dados
  if (!isProUser && userPdfCount >= 3) {
    alert("Você atingiu o limite de 3 PDFs gratuitos da sua conta!\n\nFaça o upgrade para o plano PRO para gerar orçamentos ilimitados.");
    return;
  }

  const prestadorNome = document.getElementById('prestador-nome').value.trim();
  const prestadorFone = document.getElementById('prestador-fone').value.trim();
  const clienteNome = document.getElementById('cliente-nome').value.trim();
  const clienteFone = document.getElementById('cliente-fone').value.trim();

  if (!prestadorNome || !clienteNome) {
    alert("Por favor, preencha o seu nome e o nome do cliente.");
    return;
  }

  btnGerarPdfEl.disabled = true;
  btnGerarPdfEl.textContent = "Gerando PDF...";

  const container = document.createElement('div');
  container.className = "p-8 bg-white font-sans text-slate-800 max-w-2xl mx-auto";
  const subtotal = itens.reduce((acc, item) => acc + (item.qtd * item.preco), 0);

  container.innerHTML = `
    <!-- Cabeçalho -->
    <div class="flex justify-between items-start border-b border-slate-200 pb-6 mb-6">
      <div>
        <h1 class="text-2xl font-black text-indigo-950 tracking-tight">ORÇAMENTO</h1>
        <p class="text-xs text-slate-400 mt-1">Data: ${new Date().toLocaleDateString('pt-BR')}</p>
      </div>
      <div class="text-right">
        <span class="text-base font-black text-slate-800">Use <span class="text-emerald-500">OrçaFácil</span>.app</span>
      </div>
    </div>

    <!-- Dados De/Para -->
    <div class="grid grid-cols-2 gap-6 mb-8 text-xs">
      <div class="bg-slate-50 p-3.5 rounded-lg border border-slate-100">
        <p class="font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-1">PRESTADOR DE SERVIÇO</p>
        <p class="font-bold text-slate-800 text-sm">${prestadorNome}</p>
        ${prestadorFone ? `<p class="text-slate-600 mt-0.5">${prestadorFone}</p>` : ''}
      </div>
      <div class="bg-slate-50 p-3.5 rounded-lg border border-slate-100">
        <p class="font-bold text-slate-400 uppercase tracking-wider text-[10px] mb-1">CLIENTE</p>
        <p class="font-bold text-slate-800 text-sm">${clienteNome}</p>
        ${clienteFone ? `<p class="text-slate-600 mt-0.5">${clienteFone}</p>` : ''}
      </div>
    </div>

    <!-- Tabela de Serviços -->
    <table class="w-full text-left text-xs mb-8 border-collapse">
      <thead>
        <tr class="border-b-2 border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
          <th class="py-2.5">Descrição do Item / Serviço</th>
          <th class="py-2.5 text-center w-16">Qtd.</th>
          <th class="py-2.5 text-right w-28">Preço Un.</th>
          <th class="py-2.5 text-right w-28">Subtotal</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        ${itens.map(item => `
          <tr>
            <td class="py-3 font-medium text-slate-700">${item.descricao || 'Item sem descrição'}</td>
            <td class="py-3 text-center text-slate-600">${item.qtd}</td>
            <td class="py-3 text-right text-slate-600">${formatarMoeda(item.preco)}</td>
            <td class="py-3 text-right font-semibold text-slate-800">${formatarMoeda(item.qtd * item.preco)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- Total -->
    <div class="flex justify-end mb-12">
      <div class="w-1/2 bg-indigo-950 text-white p-4 rounded-xl text-right">
        <span class="text-xs uppercase tracking-wider text-slate-300 block mb-1">Valor Total</span>
        <span class="text-2xl font-black text-emerald-400">${formatarMoeda(subtotal)}</span>
      </div>
    </div>

    <!-- Rodapé -->
    <div class="text-center pt-6 border-t border-slate-100 text-[10px] text-slate-400">
      <p>Este orçamento tem validade de 15 dias. Gerado por Use OrçaFácilAPP.</p>
    </div>
  `;

  const opt = {
    margin: 10,
    filename: `orcamento-${clienteNome.toLowerCase().replace(/\s+/g, '-')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    await html2pdf().set(opt).from(container).save();

    // Incrementa no Supabase apenas para usuários Free
    if (!isProUser) {
      userPdfCount += 1;
      await supabase
        .from('profiles')
        .update({ pdf_count: userPdfCount })
        .eq('id', currentUser.id);
    }

    // Libera o botão do WhatsApp
    btnEnviarWhatsEl.classList.remove('hidden');
    btnGerarPdfEl.textContent = "✓ PDF BAIXADO (Gerar Novamente)";
  } catch (err) {
    console.error("Erro ao gerar PDF:", err);
    alert("Ocorreu um erro ao gerar o PDF.");
  } finally {
    btnGerarPdfEl.disabled = false;
  }
}

// --- 2. Função Apenas para Abrir o WhatsApp ---
function enviarWhatsApp() {
  const clienteNome = document.getElementById('cliente-nome').value.trim();
  const clienteFone = document.getElementById('cliente-fone').value.trim();
  const subtotal = itens.reduce((acc, item) => acc + (item.qtd * item.preco), 0);

  if (!clienteFone) {
    alert("Por favor, preencha o WhatsApp do cliente para enviar.");
    return;
  }

  const foneLimpo = clienteFone.replace(/\D/g, '');
  const mensagem = encodeURIComponent(`Olá ${clienteNome}, segue o seu orçamento no valor total de ${formatarMoeda(subtotal)}. (Em anexo no PDF).`);

  window.open(`https://wa.me/55${foneLimpo}?text=${mensagem}`, '_blank');
}

// --- Vinculação de Eventos ---
btnGerarPdfEl.addEventListener('click', gerarPDF);
btnEnviarWhatsEl.addEventListener('click', enviarWhatsApp);

supabase.auth.onAuthStateChange(async (event) => {
  if (event === 'PASSWORD_RECOVERY') {
    const novaSenha = prompt("Digite sua nova senha:");
    if (novaSenha) {
      await atualizarSenha(novaSenha);
    }
  }
});

// --- Inicialização da Aplicação ---
document.addEventListener('DOMContentLoaded', () => {
  renderizarTabela();
  carregarUsuario();
});