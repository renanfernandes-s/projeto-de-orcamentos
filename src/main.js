import './style.css';
import html2pdf from 'html2pdf.js';
import { supabase, atualizarSenha } from './supabase.js';

// --- Estado da Aplicação ---
let currentUser = null;
let isProUser = false;
let userPdfCount = 0;
let pdfWorkerAtual = null;
let pdfPreviewUrlAtual = null;
let nomeArquivoAtual = 'orcamento.pdf';

let itens = [];

// --- Seleção de Elementos do DOM ---
const observacoesEl = document.getElementById('observacoes');
const userAreaEl = document.getElementById('user-area');
const btnGoLoginEl = document.getElementById('btn-go-login');
const userInfoCardEl = document.getElementById('user-info-card');
const userEmailEl = document.getElementById('user-email');
const proBadgeEl = document.getElementById('pro-badge');
const btnLogoutEl = document.getElementById('btn-logout');

const listaItensEl = document.getElementById('lista-itens');
const btnAddItemEl = document.getElementById('btn-add-item');
const valorSubtotalEl = document.getElementById('valor-subtotal');
const valorTotalEl = document.getElementById('valor-total');

const btnGerarPdfEl = document.getElementById('btn-gerar-pdf');
const btnEnviarWhatsEl = document.getElementById('btn-enviar-whats');
const modalPreviewEl = document.getElementById('modal-preview');
const iframePdfPreviewEl = document.getElementById('iframe-pdf-preview');
const btnFecharPreviewEl = document.getElementById('btn-fechar-preview');
const btnBaixarPreviewEl = document.getElementById('btn-baixar-preview');
const btnCancelarPreviewEl = document.getElementById('btn-cancelar-preview');

function fecharPreview() {
  modalPreviewEl?.classList.add('hidden');
  modalPreviewEl?.classList.remove('flex');

  if (iframePdfPreviewEl) {
    iframePdfPreviewEl.src = '';
  }

  if (pdfPreviewUrlAtual) {
    URL.revokeObjectURL(pdfPreviewUrlAtual);
    pdfPreviewUrlAtual = null;
  }

  pdfWorkerAtual = null;
}

async function baixarPreview() {
  if (!pdfWorkerAtual || !btnBaixarPreviewEl) {
    return;
  }

  btnBaixarPreviewEl.disabled = true;
  btnBaixarPreviewEl.textContent = 'Baixando...';

  try {
    await pdfWorkerAtual.save();

    if (!isProUser && currentUser) {
      userPdfCount += 1;

      await supabase
        .from('profiles')
        .update({ pdf_count: userPdfCount })
        .eq('id', currentUser.id);
    }

    btnEnviarWhatsEl?.classList.remove('hidden');
    fecharPreview();
    btnGerarPdfEl.textContent = '✓ PDF BAIXADO (Gerar Novamente)';
  } catch (err) {
    console.error('Erro ao baixar PDF:', err);
    alert('Ocorreu um erro ao baixar o PDF.');
  } finally {
    btnBaixarPreviewEl.disabled = false;
    btnBaixarPreviewEl.textContent = 'Baixar PDF';
  }
}

btnFecharPreviewEl?.addEventListener('click', fecharPreview);
btnCancelarPreviewEl?.addEventListener('click', fecharPreview);
btnBaixarPreviewEl?.addEventListener('click', baixarPreview);

// --- Seleção de Elementos do Modal PRO e Pix ---
const modalProEl = document.getElementById('modal-pro');
const btnAssinarProEl = document.getElementById('btn-assinar-pro');
const btnFecharModalEl = document.getElementById('btn-fechar-modal');
const btnCopiarPixEl = document.getElementById('btn-copiar-pix');
const btnConcluirProEl = document.getElementById('btn-concluir-pro');

const etapaOfertaEl = document.getElementById('modal-etapa-oferta');
const etapaPixEl = document.getElementById('modal-etapa-pix');
const etapaSucessoEl = document.getElementById('modal-etapa-sucesso');

// Elementos visuais do QR Code Pix
const containerQrCodeEl = document.getElementById('container-qrcode-pix');
const inputPixCopiaColaEl = document.getElementById('pix-copia-cola');

// --- Formatação Monetária ---
const formatarMoeda = (valor) => {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const escaparHTML = (str) => {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// --- Renderização e Cálculos ---
function calcularTotais() {
  const subtotal = itens.reduce((acc, item) => acc + (item.qtd * item.preco), 0);
  valorSubtotalEl.textContent = formatarMoeda(subtotal);
  valorTotalEl.textContent = formatarMoeda(subtotal);
}

function renderizarTabela() {
  listaItensEl.innerHTML = '';

  if (itens.length === 0) {
    calcularTotais();
    return;
  }

  itens.forEach((item, index) => {
    const tr = document.createElement('tr');
    tr.className = 'border-b border-gray-100';

    // 1. Célula de Descrição
    const tdDesc = document.createElement('td');
    tdDesc.className = 'p-2';
    const inputDesc = document.createElement('input');
    inputDesc.type = 'text';
    inputDesc.value = item.descricao || '';
    inputDesc.placeholder = 'Descrição do serviço ou item';
    inputDesc.dataset.index = index;
    inputDesc.dataset.field = 'descricao';
    inputDesc.className = 'item-input w-full p-2 border rounded';
    tdDesc.appendChild(inputDesc);

    // 2. Célula de Quantidade
    const tdQtd = document.createElement('td');
    tdQtd.className = 'p-2';
    const inputQtd = document.createElement('input');
    inputQtd.type = 'number';
    inputQtd.min = '1';
    inputQtd.value = item.qtd;
    inputQtd.dataset.index = index;
    inputQtd.dataset.field = 'qtd';
    inputQtd.className = 'item-input w-20 p-2 border rounded text-center';
    tdQtd.appendChild(inputQtd);

    // 3. Célula de Preço
    const tdPreco = document.createElement('td');
    tdPreco.className = 'p-2';
    const inputPreco = document.createElement('input');
    inputPreco.type = 'number';
    inputPreco.step = '0.01';
    inputPreco.min = '0';
    inputPreco.value = item.preco;
    inputPreco.dataset.index = index;
    inputPreco.dataset.field = 'preco';
    inputPreco.className = 'item-input w-28 p-2 border rounded text-right';
    tdPreco.appendChild(inputPreco);

    // 4. Célula de Ação (Remover)
    const tdAcao = document.createElement('td');
    tdAcao.className = 'p-2 text-center';
    const btnRemove = document.createElement('button');
    btnRemove.type = 'button';
    btnRemove.textContent = '🗑️';
    btnRemove.dataset.index = index;
    btnRemove.className = 'btn-remove text-red-500 hover:text-red-700 p-1';
    tdAcao.appendChild(btnRemove);

    // Anexa as 4 células (td) na linha (tr)
    tr.appendChild(tdDesc);
    tr.appendChild(tdQtd);
    tr.appendChild(tdPreco);
    tr.appendChild(tdAcao);

    // Anexa a linha (tr) no tbody/container da tabela (listaItensEl)
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
  calcularTotais();
}

function removerItem(index) {
  itens.splice(index, 1);
  renderizarTabela();
  calcularTotais();
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

// --- Event Listeners do Modal PRO e Geração de Pix Real ---
if (btnFecharModalEl) {
  btnFecharModalEl.addEventListener('click', () => {
    modalProEl.classList.add('hidden');
    etapaOfertaEl.classList.remove('hidden');
    etapaPixEl.classList.add('hidden');
    etapaSucessoEl.classList.add('hidden');
  });
}

if (btnAssinarProEl) {
  btnAssinarProEl.addEventListener('click', async () => {
    if (!currentUser) {
      alert("Você precisa estar logado para assinar.");
      return;
    }

    const cpfInformado = prompt("Digite seu CPF para gerar a cobrança Pix (somente números):");

    if (!cpfInformado) {
      alert("O CPF é obrigatório para prosseguir com o pagamento.");
      return;
    }

    btnAssinarProEl.disabled = true;
    btnAssinarProEl.textContent = "Gerando Pix seguro...";

    try {
      // 1. Obtém a sessão ativa com o JWT Token do usuário
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Sessão expirada. Por favor, faça login novamente.");
      }

      const prestadorNome = document.getElementById('prestador-nome')?.value.trim() || currentUser.email;

      // 2. Faz a chamada autenticada direcionada para a extensão .mjs
      const response = await fetch('/api/gerar-pix.mjs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          cpfCnpj: cpfInformado.replace(/\D/g, ''),
          name: prestadorNome
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao gerar Pix');
      }

      // Injeta a imagem real do QR Code retornada pelo Asaas
      if (containerQrCodeEl) {
        containerQrCodeEl.innerHTML = `<img src="data:image/png;base64,${data.encodedImage}" alt="QR Code Pix" class="w-48 h-48 mx-auto object-contain">`;
      }

      // Preenche o input Copia e Cola
      if (inputPixCopiaColaEl) {
        inputPixCopiaColaEl.value = data.payload;
      }

      // Avança para a etapa do Pix
      etapaOfertaEl.classList.add('hidden');
      etapaPixEl.classList.remove('hidden');

      // Inicia verificação automática de status da aprovação via webhook
      iniciarVerificacaoStatusPro();

    } catch (err) {
      console.error(err);
      alert(err.message || "Não foi possível gerar o QR Code Pix. Tente novamente.");
    } finally {
      btnAssinarProEl.disabled = false;
      btnAssinarProEl.textContent = "Assinar Agora (Pix)";
    }
  });
}

if (btnCopiarPixEl) {
  btnCopiarPixEl.addEventListener('click', () => {
    if (inputPixCopiaColaEl) {
      inputPixCopiaColaEl.select();
      navigator.clipboard.writeText(inputPixCopiaColaEl.value);
      alert("Código Pix Copia e Cola copiado com sucesso!");
    }
  });
}

if (btnConcluirProEl) {
  btnConcluirProEl.addEventListener('click', () => {
    modalProEl.classList.add('hidden');
    window.location.reload();
  });
}

// Verificador automático de aprovação em segundo plano
function iniciarVerificacaoStatusPro() {
  const intervalo = setInterval(async () => {
    if (!currentUser) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_pro')
      .eq('id', currentUser.id)
      .single();

    if (profile && profile.is_pro) {
      clearInterval(intervalo);
      isProUser = true;
      if (proBadgeEl) proBadgeEl.classList.remove('hidden');

      etapaPixEl.classList.add('hidden');
      etapaSucessoEl.classList.remove('hidden');
    }
  }, 5000);
}

// --- Integração com Supabase (Sessão do Usuário) ---
async function carregarUsuario() {
  const { data: { user } } = await supabase.auth.getUser();
  currentUser = user;

  if (user) {
    if (btnGoLoginEl) btnGoLoginEl.classList.add('hidden');
    if (userInfoCardEl) userInfoCardEl.classList.remove('hidden');
    if (userEmailEl) userEmailEl.textContent = user.email;

    let { data: profile } = await supabase
      .from('profiles')
      .select('is_pro, pdf_count')
      .eq('id', user.id)
      .single();

    if (!profile) {
      const { data: novoPerfil } = await supabase
        .from('profiles')
        .insert([{ id: user.id, is_pro: false, pdf_count: 0 }])
        .select('is_pro, pdf_count')
        .single();

      profile = novoPerfil;
    }

    if (profile) {
      isProUser = !!profile.is_pro;
      userPdfCount = profile.pdf_count || 0;

      if (proBadgeEl) {
        if (isProUser) {
          proBadgeEl.classList.remove('hidden');
        } else {
          proBadgeEl.classList.add('hidden');
        }
      }
    }
  } else {
    if (btnGoLoginEl) btnGoLoginEl.classList.remove('hidden');
    if (userInfoCardEl) userInfoCardEl.classList.add('hidden');
  }
}

// --- Função de Logout ---
if (btnLogoutEl) {
  btnLogoutEl.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.reload();
  });
}

// --- Função para Gerar PDF ---
async function gerarPDF() {
  if (!currentUser) {
    alert("Você precisa fazer login para gerar o orçamento.");
    window.location.href = '/login.html';
    return;
  }

  if (!isProUser && userPdfCount >= 3) {
    if (modalProEl) {
      modalProEl.classList.remove('hidden');
    } else {
      alert("Você atingiu o limite de 3 PDFs gratuitos. Faça o upgrade para o plano PRO!");
    }
    return;
  }
  // --- Coleta de Dados do Formulário ---
  const prestadorNome = escaparHTML(document.getElementById('prestador-nome').value.trim());
  const prestadorFone = escaparHTML(document.getElementById('prestador-fone').value.trim());
  const clienteNome = escaparHTML(document.getElementById('cliente-nome').value.trim());
  const clienteFone = escaparHTML(document.getElementById('cliente-fone').value.trim());
  const observacoes = escaparHTML(observacoesEl?.value.trim() || '');
  const clienteNomeOriginal = document.getElementById('cliente-nome').value.trim();

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
    <div class="flex justify-between items-start border-b border-slate-200 pb-6 mb-6">
      <div>
        <h1 class="text-2xl font-black text-indigo-950 tracking-tight">ORÇAMENTO</h1>
        <p class="text-xs text-slate-400 mt-1">Data: ${new Date().toLocaleDateString('pt-BR')}</p>
      </div>
      <div class="text-right">
        <span class="text-base font-black text-slate-800">Use <span class="text-emerald-500">OrçaFácil</span>.app</span>
      </div>
    </div>

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
            <td class="py-3 font-medium text-slate-700">${escaparHTML(item.descricao || 'Item sem descrição')}</td>
            <td class="py-3 text-center text-slate-600">${item.qtd}</td>
            <td class="py-3 text-right text-slate-600">${formatarMoeda(item.preco)}</td>
            <td class="py-3 text-right font-semibold text-slate-800">${formatarMoeda(item.qtd * item.preco)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="flex justify-end mb-12">
      <div class="w-1/2 bg-indigo-950 text-white p-4 rounded-xl text-right">
        <span class="text-xs uppercase tracking-wider text-slate-300 block mb-1">Valor Total</span>
        <span class="text-2xl font-black text-emerald-400">${formatarMoeda(subtotal)}</span>
      </div>
    </div>

    ${observacoes ? `
      <div class="mb-8 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs">
        <p class="mb-1 font-bold uppercase tracking-wider text-slate-400">
          Observações / Condições Gerais
        </p>
        <p class="whitespace-pre-line text-slate-700">${observacoes}</p>
      </div>
    ` : ''}

    <div class="text-center pt-6 border-t border-slate-100 text-[10px] text-slate-400">
      <p>Este orçamento tem validade de 15 dias. Gerado por Use OrçaFácilAPP.</p>
    </div>
  `;

  const opt = {
    margin: 10,
    filename: `orcamento-${clienteNomeOriginal.toLowerCase().replace(/\s+/g, '-')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    nomeArquivoAtual = opt.filename;

    pdfWorkerAtual = html2pdf()
      .set(opt)
      .from(container);

    const pdfBlob = await pdfWorkerAtual.outputPdf('blob');

    if (pdfPreviewUrlAtual) {
      URL.revokeObjectURL(pdfPreviewUrlAtual);
    }

    pdfPreviewUrlAtual = URL.createObjectURL(pdfBlob);

    if (iframePdfPreviewEl) {
      iframePdfPreviewEl.src = pdfPreviewUrlAtual;
    }

    if (modalPreviewEl) {
      modalPreviewEl.classList.remove('hidden');
      modalPreviewEl.classList.add('flex');
    }

    btnGerarPdfEl.textContent = '👁️ Pré-visualizar PDF novamente';
  } catch (err) {
    console.error('Erro ao gerar pré-visualização:', err);
    alert('Ocorreu um erro ao gerar a pré-visualização do PDF.');

  } finally {
    btnGerarPdfEl.disabled = false;
  }
}
//Liberar a URL do objeto Blob quando a janela for fechada ou recarregada
window.addEventListener('beforeunload', () => {
  if (pdfPreviewUrlAtual) {
    URL.revokeObjectURL(pdfPreviewUrlAtual);
  }
});

// --- Função para Abrir WhatsApp ---
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

// --- Vinculação de Eventos Finais ---
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