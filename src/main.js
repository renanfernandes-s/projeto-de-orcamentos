import './style.css';
import html2pdf from 'html2pdf.js';
import { supabase, atualizarSenha } from './supabase.js';

// --- Estado da Aplicação ---
let currentUser = null;
let isProUser = false;
let userPdfCount = 0;
let pdfWorkerAtual = null;
let nomeArquivoAtual = 'orcamento.pdf';
let intervalProId = null; // Guard do ID do polling

let itens = [];

// --- Seleção de Elementos do DOM ---
const observacoesEl = document.getElementById('observacoes');
const userAreaEl = document.getElementById('user-area');
const btnGoLoginEl = document.getElementById('btn-go-login');
const userInfoCardEl = document.getElementById('user-info-card');
const userEmailEl = document.getElementById('user-email');
const proBadgeEl = document.getElementById('pro-badge');
const btnLogoutEl = document.getElementById('btn-logout');
const prestadorDocumentoInputEl = document.getElementById('prestador-documento');
const prestadorDocumentoSalvarEl = document.getElementById('prestador-documento-salvar');

const listaItensEl = document.getElementById('lista-itens');
const btnAddItemEl = document.getElementById('btn-add-item');
const valorSubtotalEl = document.getElementById('valor-subtotal');
const valorTotalEl = document.getElementById('valor-total');

const btnGerarPdfEl = document.getElementById('btn-gerar-pdf');
const btnEnviarWhatsEl = document.getElementById('btn-enviar-whats');
const modalPreviewEl = document.getElementById('modal-preview');
const containerPdfPreviewEl = document.getElementById('container-pdf-preview');
const btnFecharPreviewEl = document.getElementById('btn-fechar-preview');
const btnBaixarPreviewEl = document.getElementById('btn-baixar-preview');
const btnCancelarPreviewEl = document.getElementById('btn-cancelar-preview');

// --- Seleção de Elementos do Modal PRO e Pagamento ---
const modalProEl = document.getElementById('modal-pro');
const btnAssinarProEl = document.getElementById('btn-assinar-pro');
const btnGerarCartaoEl = document.getElementById('btn-gerar-cartao');
const btnConfirmarCartaoEl = document.getElementById('btn-confirmar-cartao');
const btnFecharModalEl = document.getElementById('btn-fechar-modal');
const btnCopiarPixEl = document.getElementById('btn-copiar-pix');
const btnConcluirProEl = document.getElementById('btn-concluir-pro');

const etapaOfertaEl = document.getElementById('modal-etapa-oferta');
const etapaPixEl = document.getElementById('modal-etapa-pix');
const etapaCartaoEl = document.getElementById('modal-etapa-cartao');
const etapaSucessoEl = document.getElementById('modal-etapa-sucesso');

// Elementos de Entrada e Status
const containerQrCodeEl = document.getElementById('container-qrcode-pix');
const inputPixCopiaColaEl = document.getElementById('pix-copia-cola');
const cartaoCpfInputEl = document.getElementById('cartao-cpf');
const statusAguardandoCartaoEl = document.getElementById('status-aguardando-cartao');

// Botões de Voltar para a Oferta
const btnsVoltarOferta = document.querySelectorAll('.btn-voltar-oferta');

// --- Função Helper de Validação de CPF/CNPJ ---
// ✅ CORREÇÃO DA VALIDAÇÃO MATEMÁTICA REAL DE CPF/CNPJ
function validarCpfCnpjFormato(val) {
  const str = String(val || '').replace(/\D/g, '');

  if (str.length === 11) {
    if (/^(\d)\1{10}$/.test(str)) return false;
    let soma = 0, resto;
    for (let i = 1; i <= 9; i++) soma += parseInt(str.substring(i - 1, i)) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(str.substring(9, 10))) return false;

    soma = 0;
    for (let i = 1; i <= 10; i++) soma += parseInt(str.substring(i - 1, i)) * (12 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    return resto === parseInt(str.substring(10, 11));
  }

  if (str.length === 14) {
    if (/^(\d)\1{13}$/.test(str)) return false;
    let tamanho = str.length - 2;
    let numeros = str.substring(0, tamanho);
    const digitos = str.substring(tamanho);
    let soma = 0, pos = tamanho - 7;
    for (let i = tamanho; i >= 1; i--) {
      soma += numeros.charAt(tamanho - i) * pos--;
      if (pos < 2) pos = 9;
    }
    let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    if (resultado !== parseInt(digitos.charAt(0))) return false;

    tamanho = tamanho + 1;
    numeros = str.substring(0, tamanho);
    soma = 0;
    pos = tamanho - 7;
    for (let i = tamanho; i >= 1; i--) {
      soma += numeros.charAt(tamanho - i) * pos--;
      if (pos < 2) pos = 9;
    }
    resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
    return resultado === parseInt(digitos.charAt(1));
  }

  return false;
}

function limparDocumento(value) {
  return String(value || '').replace(/\D/g, '');
}

function formatarDocumento(value) {
  const digits = limparDocumento(value);

  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
      .slice(0, 14);
  }

  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
    .slice(0, 18);
}

async function sincronizarDocumentoPerfil(documento, salvar) {
  if (!currentUser) return;

  const documentoLimpo = limparDocumento(documento);

  if (!salvar) {
    const { error } = await supabase
      .from('profiles')
      .update({ documento: null, documento_salvo: false })
      .eq('id', currentUser.id);

    if (error) {
      console.error('Erro ao limpar documento salvo:', error);
      alert('Não foi possível remover o documento salvo. Tente novamente.');
    }

    return;
  }

  if (!documentoLimpo) {
    alert('Digite um CPF ou CNPJ para salvar no perfil.');
    if (prestadorDocumentoSalvarEl) prestadorDocumentoSalvarEl.checked = false;
    return;
  }

  if (!validarCpfCnpjFormato(documentoLimpo)) {
    alert('CPF ou CNPJ inválido. Informe um documento válido para salvar.');
    if (prestadorDocumentoSalvarEl) prestadorDocumentoSalvarEl.checked = false;
    return;
  }

  const { error } = await supabase
    .from('profiles')
    .update({ documento: documentoLimpo, documento_salvo: true })
    .eq('id', currentUser.id);

  if (error) {
    console.error('Erro ao salvar documento do perfil:', error);
    alert('Não foi possível salvar o CPF/CNPJ no perfil. Tente novamente.');
  }
}

// --- Função de Download do PDF Preview ---
async function baixarPreview() {
  if (!pdfWorkerAtual || !btnBaixarPreviewEl) return;

  btnBaixarPreviewEl.disabled = true;
  btnBaixarPreviewEl.textContent = 'Baixando...';

  try {
    if (!isProUser) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessão expirada. Faça login novamente.');

      const consumoResponse = await fetch('/api/consumir-pdf', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const consumoData = await consumoResponse.json();
      if (!consumoResponse.ok) throw new Error(consumoData.error || 'Não foi possível validar o limite de PDFs.');
      userPdfCount = consumoData.pdfCount ?? userPdfCount;
    }

    await pdfWorkerAtual.save();

    btnEnviarWhatsEl?.classList.remove('hidden');
    btnEnviarWhatsEl?.classList.add('flex');
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

// --- Formatação Monetária e Helpers ---
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

    tr.appendChild(tdDesc);
    tr.appendChild(tdQtd);
    tr.appendChild(tdPreco);
    tr.appendChild(tdAcao);

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

// --- Navegação e Eventos do Modal PRO ---

// Fechar Modal
if (btnFecharModalEl) {
  btnFecharModalEl.addEventListener('click', () => {
    pararVerificacaoStatusPro();
    modalProEl?.classList.add('hidden');
    modalProEl?.classList.remove('flex');
    etapaOfertaEl?.classList.remove('hidden');
    etapaPixEl?.classList.add('hidden');
    etapaCartaoEl?.classList.add('hidden');
    etapaSucessoEl?.classList.add('hidden');
  });
}

// Botões de Voltar para Etapa de Oferta
btnsVoltarOferta.forEach(btn => {
  btn.addEventListener('click', () => {
    pararVerificacaoStatusPro();
    etapaPixEl?.classList.add('hidden');
    etapaCartaoEl?.classList.add('hidden');
    etapaOfertaEl?.classList.remove('hidden');
  });
});

// Transição para Etapa Cartão
if (btnGerarCartaoEl) {
  btnGerarCartaoEl.addEventListener('click', () => {
    etapaOfertaEl?.classList.add('hidden');
    etapaCartaoEl?.classList.remove('hidden');
  });
}

// --- Fluxo 1: Geração do Pix Real ---
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

    if (!validarCpfCnpjFormato(cpfInformado)) {
      alert("CPF inválido! Por favor, informe um CPF com 11 dígitos ou CNPJ com 14 dígitos.");
      return;
    }

    btnAssinarProEl.disabled = true;
    btnAssinarProEl.textContent = "Gerando Pix seguro...";

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Sessão expirada. Por favor, faça login novamente.");
      }

      const prestadorNome = document.getElementById('prestador-nome')?.value.trim() || currentUser.email;

      const response = await fetch('/api/gerar-pix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'Idempotency-Key': crypto.randomUUID()
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

      if (containerQrCodeEl) {
        containerQrCodeEl.innerHTML = `<img src="data:image/png;base64,${data.encodedImage}" alt="QR Code Pix" class="w-48 h-48 mx-auto object-contain">`;
      }

      if (inputPixCopiaColaEl) {
        inputPixCopiaColaEl.value = data.payload;
      }

      etapaOfertaEl?.classList.add('hidden');
      etapaPixEl?.classList.remove('hidden');

      iniciarVerificacaoStatusPro(data.paymentId);

    } catch (err) {
      console.error(err);
      alert(err.message || "Não foi possível gerar o QR Code Pix. Tente novamente.");
    } finally {
      btnAssinarProEl.disabled = false;
      btnAssinarProEl.textContent = "📱 Pagar R$ 14,90 via PIX";
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

// --- Fluxo 2: Geração do Checkout Cartão de Crédito ---
if (btnConfirmarCartaoEl) {
  btnConfirmarCartaoEl.addEventListener('click', async () => {
    const cpfCnpj = cartaoCpfInputEl?.value.trim().replace(/\D/g, '');


    // Abrir a janela em branco antes de qualquer operação assíncrona
    if (!cpfCnpj || !validarCpfCnpjFormato(cpfCnpj)) {
      alert("Por favor, digite um CPF válido (11 dígitos) ou CNPJ (14 dígitos).");
      cartaoCpfInputEl?.focus();
      return; // Nenhuma janela foi aberta ainda, fluxo correto.
    }

    const janelaCheckout = window.open('about:blank', '_blank');

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        janelaCheckout?.close();
        alert("Sessão expirada. Faça login novamente para continuar.");
        return;
      }

      btnConfirmarCartaoEl.disabled = true;
      btnConfirmarCartaoEl.innerHTML = `<span class="animate-spin">⏳</span> Gerando Link...`;

      const prestadorNome = document.getElementById('prestador-nome')?.value.trim() || currentUser.email;

      const response = await fetch('/api/gerar-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'Idempotency-Key': crypto.randomUUID()
        },
        body: JSON.stringify({
          cpfCnpj: cpfCnpj,
          name: prestadorNome
        })
      });

      const data = await response.json();

      if (!response.ok || !data.invoiceUrl) {
        janelaCheckout?.close();
        throw new Error(data.error || 'A URL do checkout não pôde ser gerada.');
      }

      // Redireciona a janela aberta
      if (janelaCheckout) {
        janelaCheckout.location.href = data.invoiceUrl;
      }

      // Atualiza status na interface
      statusAguardandoCartaoEl?.classList.remove('hidden');
      statusAguardandoCartaoEl?.classList.add('flex');

      iniciarVerificacaoStatusPro(data.paymentId);

    } catch (err) {
      janelaCheckout?.close();
      console.error('Erro no checkout via cartão:', err);
      alert(err.message || 'Erro ao processar requisição.');
    } finally {
      btnConfirmarCartaoEl.disabled = false;
      btnConfirmarCartaoEl.textContent = "Ir para Pagamento Seguro 🔒";
    }
  });
}

if (btnConcluirProEl) {
  btnConcluirProEl.addEventListener('click', () => {
    pararVerificacaoStatusPro();
    modalProEl?.classList.add('hidden');
    modalProEl?.classList.remove('flex');
    window.location.reload();
  });
}

// Verificador automático de aprovação em segundo plano (Polling)
function iniciarVerificacaoStatusPro(paymentId) {
  pararVerificacaoStatusPro();

  if (!paymentId) return;

  let tentativas = 0;
  const maxTentativas = 36; // 3 minutos (36 * 5 seg)

  intervalProId = setInterval(async () => {
    if (!currentUser) return;

    tentativas++;

    // Chegou ao limite de tempo sem confirmação
    if (tentativas >= maxTentativas) {
      pararVerificacaoStatusPro();
      alert("O tempo de verificação expirou. Se você já realizou o pagamento, aguarde alguns instantes ou recarregue a página.");

      // Opcional: restaura os botões da interface
      if (btnAssinarProEl) {
        btnAssinarProEl.disabled = false;
        btnAssinarProEl.textContent = "📱 Pagar R$ 14,90 via PIX";
      }
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/status-pagamento?paymentId=${encodeURIComponent(paymentId)}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const data = await response.json();

      if (response.ok && (data.status === 'RECEIVED' || data.status === 'CONFIRMED')) {
        pararVerificacaoStatusPro();
        isProUser = true;
        if (proBadgeEl) proBadgeEl.classList.remove('hidden');

        etapaPixEl?.classList.add('hidden');
        etapaCartaoEl?.classList.add('hidden');
        etapaSucessoEl?.classList.remove('hidden');
      }
    } catch (err) {
      console.error('Erro na checagem de status:', err);
    }
  }, 5000);
}

function pararVerificacaoStatusPro() {
  if (intervalProId) {
    clearInterval(intervalProId);
    intervalProId = null;
  }
}

// --- Integração com Supabase (Sessão do Usuário) ---
async function carregarUsuario() {
  const { data: { user } } = await supabase.auth.getUser();
  currentUser = user;

  if (user) {
    if (btnGoLoginEl) btnGoLoginEl.classList.add('hidden');
    if (userInfoCardEl) {
      userInfoCardEl.classList.remove('hidden');
      userInfoCardEl.classList.add('flex');
    }
    if (userEmailEl) userEmailEl.textContent = user.email;

    let profileQuery = supabase
      .from('profiles')
      .select('is_pro, pdf_count, documento, documento_salvo')
      .eq('id', user.id)
      .single();

    let { data: profile, error } = await profileQuery;

    if (error && error.code === '42703') {
      ({ data: profile, error } = await supabase
        .from('profiles')
        .select('is_pro, pdf_count')
        .eq('id', user.id)
        .single());
    }

    if (!profile) {
      const { data: novoPerfil, error: insertError } = await supabase
        .from('profiles')
        .insert([{ id: user.id, is_pro: false, pdf_count: 0, documento: null, documento_salvo: false }])
        .select('is_pro, pdf_count, documento, documento_salvo')
        .single();

      if (insertError && insertError.code === '42703') {
        const { data: perfilFallback } = await supabase
          .from('profiles')
          .insert([{ id: user.id, is_pro: false, pdf_count: 0 }])
          .select('is_pro, pdf_count')
          .single();

        profile = perfilFallback;
      } else {
        profile = novoPerfil;
      }
    }

    if (profile) {
      isProUser = !!profile.is_pro;
      userPdfCount = profile.pdf_count || 0;

      if (prestadorDocumentoInputEl) {
        prestadorDocumentoInputEl.value = profile.documento ? formatarDocumento(profile.documento) : '';
      }

      if (prestadorDocumentoSalvarEl) {
        prestadorDocumentoSalvarEl.checked = !!profile.documento_salvo;
      }

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
    if (userInfoCardEl) {
      userInfoCardEl.classList.add('hidden');
      userInfoCardEl.classList.remove('flex');
    }
    if (prestadorDocumentoInputEl) prestadorDocumentoInputEl.value = '';
    if (prestadorDocumentoSalvarEl) prestadorDocumentoSalvarEl.checked = false;
  }
}

// --- Função de Logout ---
if (btnLogoutEl) {
  btnLogoutEl.addEventListener('click', async () => {
    pararVerificacaoStatusPro();
    await supabase.auth.signOut();
    window.location.reload();
  });
}

if (prestadorDocumentoInputEl) {
  prestadorDocumentoInputEl.addEventListener('input', (event) => {
    const valorFormatado = formatarDocumento(event.target.value);
    event.target.value = valorFormatado;

    if (prestadorDocumentoSalvarEl?.checked) {
      sincronizarDocumentoPerfil(valorFormatado, true);
    }
  });
}

if (prestadorDocumentoSalvarEl) {
  prestadorDocumentoSalvarEl.addEventListener('change', async () => {
    const checked = prestadorDocumentoSalvarEl.checked;
    const documento = prestadorDocumentoInputEl?.value || '';

    if (checked) {
      await sincronizarDocumentoPerfil(documento, true);
      return;
    }

    await sincronizarDocumentoPerfil(documento, false);
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
      modalProEl.classList.add('flex');
    } else {
      alert("Você atingiu o limite de 3 PDFs gratuitos. Faça o upgrade para o plano PRO!");
    }
    return;
  }

  const prestadorNome = escaparHTML(document.getElementById('prestador-nome').value.trim());
  const prestadorFone = escaparHTML(document.getElementById('prestador-fone').value.trim());
  const prestadorDocumento = escaparHTML(limparDocumento(document.getElementById('prestador-documento')?.value || ''));
  const clienteNome = escaparHTML(document.getElementById('cliente-nome').value.trim());
  const clienteFone = escaparHTML(document.getElementById('cliente-fone').value.trim());
  const observacoes = escaparHTML(observacoesEl?.value.trim() || '');
  const clienteNomeOriginal = document.getElementById('cliente-nome').value.trim();

  if (!prestadorNome || !clienteNome) {
    alert("Por favor, preencha o seu nome e o nome do cliente.");
    return;
  }

  btnGerarPdfEl.disabled = true;
  btnGerarPdfEl.textContent = "Gerando Pré-visualização...";

  const container = document.createElement('div');
  container.className = "p-6 bg-white font-sans text-slate-800 max-w-2xl mx-auto rounded-xl shadow-sm text-left";
  const subtotal = itens.reduce((acc, item) => acc + (item.qtd * item.preco), 0);

  container.innerHTML = `
  <!-- =====================================================
       ORÇAFÁCILAPP — TEMPLATE PROFISSIONAL (PDF OPTIMIZED)
       ===================================================== -->

  <!-- HEADER -->
  <div style="position: relative; margin-bottom: 20px; background-color: #ffffff; border-radius: 12px; overflow: hidden;">

    <!-- Barra de identidade lateral -->
    <div style="position: absolute; left: 0; top: 0; height: 100%; width: 6px; background-color: #820AD1;"></div>

    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; padding-left: 16px;">

      <!-- Identidade / Título -->
      <div>
        <div style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
          <span style="background-color: #820AD1; color: #ffffff; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; padding: 3px 8px; border-radius: 9999px; display: inline-block; line-height: 1.2;">
            Proposta Comercial
          </span>

          <span style="font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; display: inline-block; line-height: 1.2;">
            Orçamento
          </span>
        </div>

        <h1 style="font-size: 24px; font-weight: 900; color: #0f172a; margin: 0; line-height: 1.2; letter-spacing: -0.5px;">
          ORÇAMENTO
        </h1>

        <p style="margin-top: 6px; font-size: 11px; font-weight: 500; color: #64748b; margin-bottom: 0;">
          Data de emissão:
          <span style="font-weight: 700; color: #334155;">
            ${new Date().toLocaleDateString('pt-BR')}
          </span>
        </p>
      </div>

      <!-- Marca / Selo de Auto Promoção (Garantido no PDF) -->
      <div style="text-align: right;">
        <div style="background-color: #1e1b4b; padding: 8px 14px; border-radius: 10px; display: inline-block; border: 1px solid #312e81; min-width: 140px; text-align: center;">
          <span style="font-size: 11px; font-weight: 900; color: #ffffff; display: block; line-height: 1;">
            Use <span style="color: #10b981;">OrçaFácil</span>.app
          </span>
        </div>

        <p style="margin-top: 6px; font-size: 9px; font-weight: 600; color: #64748b; margin-bottom: 0;">
          Gestão simples de orçamentos
        </p>
      </div>

    </div>
  </div>


  <!-- =====================================================
       PRESTADOR + CLIENTE
       ===================================================== -->

  <div style="display: grid; grid-template-columns: 1.3fr 1fr; gap: 12px; margin-bottom: 20px;">

    <!-- PRESTADOR -->
    <div style="position: relative; overflow: hidden; border-radius: 12px; border: 1px solid #e9d5ff; background-color: #faf5ff; padding: 14px;">

      <div style="position: absolute; left: 0; top: 0; height: 100%; width: 4px; background-color: #820AD1;"></div>

      <div style="padding-left: 6px;">

        <div style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
          <span style="display: inline-flex; justify-content: center; align-items: center; width: 20px; height: 20px; border-radius: 6px; background-color: #820AD1; color: #ffffff; font-size: 10px; font-weight: 900; line-height: 1;">
            P
          </span>

          <p style="font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #820AD1; margin: 0; line-height: 1.3;">
            Prestador de Serviço
          </p>
        </div>

        <p style="font-size: 14px; font-weight: 900; color: #0f172a; margin: 0; line-height: 1.3;">
          ${prestadorNome}
        </p>

        ${prestadorFone
      ? `
              <div style="margin-top: 6px; display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 10px; font-weight: 700; color: #94a3b8;">
                  TEL.
                </span>

                <span style="font-size: 11px; font-weight: 600; color: #334155;">
                  ${prestadorFone}
                </span>
              </div>
            `
      : ''
    }

        ${prestadorDocumento
      ? `
              <div style="margin-top: 4px; display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 10px; font-weight: 700; color: #94a3b8;">
                  DOC.
                </span>

                <span style="font-size: 11px; font-weight: 600; color: #334155;">
                  ${formatarDocumento(prestadorDocumento)}
                </span>
              </div>
            `
      : ''
    }

      </div>
    </div>


    <!-- CLIENTE -->
    <div style="border-radius: 12px; border: 1px solid #e2e8f0; background-color: #f8fafc; padding: 14px;">

      <div style="margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
        <span style="display: inline-flex; justify-content: center; align-items: center; width: 20px; height: 20px; border-radius: 6px; background-color: #1e1b4b; color: #ffffff; font-size: 10px; font-weight: 900; line-height: 1;">
          C
        </span>

        <p style="font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #475569; margin: 0; line-height: 1.3;">
          Cliente
        </p>
      </div>

      <p style="font-size: 13px; font-weight: 900; color: #0f172a; margin: 0; line-height: 1.3;">
        ${clienteNome}
      </p>

      ${clienteFone
      ? `
            <div style="margin-top: 6px; display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 10px; font-weight: 700; color: #94a3b8;">
                TEL.
              </span>

              <span style="font-size: 11px; font-weight: 600; color: #334155;">
                ${clienteFone}
              </span>
            </div>
          `
      : ''
    }

    </div>

  </div>


  <!-- =====================================================
       ITENS DO ORÇAMENTO
       ===================================================== -->

  <div style="margin-bottom: 20px; border-radius: 12px; border: 1px solid #e2e8f0; background-color: #ffffff; overflow: hidden;">

    <!-- Título da seção -->
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding: 12px 16px;">

      <div>
        <p style="font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #820AD1; margin: 0; line-height: 1.2;">
          Detalhamento
        </p>

        <p style="margin-top: 2px; font-size: 12px; font-weight: 800; color: #0f172a; margin-bottom: 0;">
          Itens do orçamento
        </p>
      </div>

      <span style="background-color: #f1f5f9; padding: 4px 10px; border-radius: 9999px; font-size: 9px; font-weight: 700; text-transform: uppercase; color: #475569; display: inline-block;">
        ${itens.length} ${itens.length === 1 ? 'item' : 'itens'}
      </span>

    </div>


    <!-- Tabela -->
    <div style="width: 100%; overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 11px;">

        <thead>
          <tr style="background-color: #1e1b4b; color: #ffffff;">

            <th style="padding: 10px 16px; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
              Descrição
            </th>

            <th style="width: 50px; padding: 10px 4px; text-align: center; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
              Qtd.
            </th>

            <th style="width: 80px; padding: 10px 8px; text-align: right; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
              Preço Un.
            </th>

            <th style="width: 90px; padding: 10px 16px; text-align: right; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
              Subtotal
            </th>

          </tr>
        </thead>


        <tbody style="background-color: #ffffff; font-size: 11px; color: #1e293b;">

          ${itens.map((item, index) => `
            <tr style="border-bottom: 1px solid #f1f5f9; ${index % 2 === 1 ? 'background-color: #f8fafc;' : ''}">

              <td style="padding: 10px 16px; font-weight: 600; color: #1e293b;">
                ${escaparHTML(item.descricao || 'Item sem descrição')}
              </td>

              <td style="padding: 10px 4px; text-align: center; font-weight: 500; color: #64748b;">
                ${item.qtd}
              </td>

              <td style="padding: 10px 8px; text-align: right; font-weight: 500; color: #64748b;">
                ${formatarMoeda(item.preco)}
              </td>

              <td style="padding: 10px 16px; text-align: right; font-weight: 800; color: #0f172a;">
                ${formatarMoeda(item.qtd * item.preco)}
              </td>

            </tr>
          `).join('')}

        </tbody>

      </table>
    </div>
  </div>


  <!-- =====================================================
       OBSERVAÇÕES
       ===================================================== -->

  ${observacoes
      ? `
        <div style="margin-bottom: 20px; border-radius: 12px; border: 1px solid #e2e8f0; background-color: #f8fafc; padding: 14px;">

          <div style="margin-bottom: 6px; display: flex; align-items: center; gap: 8px;">

            <span style="display: inline-flex; justify-content: center; align-items: center; width: 18px; height: 18px; border-radius: 4px; background-color: #1e1b4b; color: #ffffff; font-size: 10px; font-weight: 900; line-height: 1;">
              i
            </span>

            <p style="font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #475569; margin: 0; line-height: 1.3;">
              Observações & Condições
            </p>

          </div>

          <p style="white-space: pre-line; padding-left: 26px; font-size: 11px; line-height: 1.5; color: #334155; margin: 0;">
            ${observacoes}
          </p>

        </div>
      `
      : ''
    }


  <!-- =====================================================
       TOTAL — BLOCO ASSIMÉTRICO
       ===================================================== -->

  <div style="margin-bottom: 20px; display: flex; justify-content: flex-end;">

    <div style="position: relative; width: 65%; overflow: hidden; border-radius: 12px; background-color: #1e1b4b; padding: 16px 20px; text-align: right; border: 1px solid #312e81;">

      <div style="position: relative;">

        <span style="display: block; margin-bottom: 4px; font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 1.5px; color: #a5b4fc;">
          Valor Total
        </span>

        <span style="display: block; font-size: 26px; font-weight: 900; line-height: 1; color: #10b981;">
          ${formatarMoeda(subtotal)}
        </span>

      </div>

    </div>

  </div>


  <!-- =====================================================
       RODAPÉ
       ===================================================== -->

  <div style="border-top: 1px solid #e2e8f0; padding-top: 12px;">

    <div style="display: flex; justify-content: space-between; align-items: center;">

      <div>
        <p style="font-size: 9px; font-weight: 700; color: #94a3b8; margin: 0;">
          Orçamento válido por 15 dias.
        </p>

        <p style="margin-top: 2px; font-size: 9px; color: #94a3b8; margin-bottom: 0;">
          Documento gerado digitalmente.
        </p>
      </div>

      <div style="text-align: right;">

        <p style="font-size: 9px; font-weight: 500; color: #94a3b8; margin: 0;">
          Gerado por
        </p>

        <p style="margin-top: 2px; font-size: 10px; font-weight: 900; letter-spacing: -0.2px; color: #1e1b4b; margin-bottom: 0;">
          Use OrçaFácilApp
        </p>

      </div>

    </div>

  </div>
`;

  nomeArquivoAtual = `orcamento-${clienteNomeOriginal.toLowerCase().replace(/\s+/g, '-')}.pdf`;

  const opt = {
    margin: 8,
    filename: nomeArquivoAtual,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  pdfWorkerAtual = html2pdf().set(opt).from(container);

  if (containerPdfPreviewEl) {
    containerPdfPreviewEl.innerHTML = '';
    containerPdfPreviewEl.appendChild(container);
  }

  if (modalPreviewEl) {
    modalPreviewEl.classList.remove('hidden');
    modalPreviewEl.classList.add('flex');
  }
  btnGerarPdfEl.textContent = "📄 1. Pré-Visualizar PDF";
  btnGerarPdfEl.disabled = false;
}

function fecharPreview() {
  if (modalPreviewEl) {
    modalPreviewEl.classList.add('hidden');
    modalPreviewEl.classList.remove('flex');
  }
  if (containerPdfPreviewEl) {
    containerPdfPreviewEl.innerHTML = '';
  }
}

// --- Função para Abrir WhatsApp ---
function enviarWhatsApp() {
  const clienteNome = document.getElementById('cliente-nome').value.trim();
  const clienteFone = document.getElementById('cliente-fone').value.trim();

  if (!clienteFone) {
    alert("Por favor, preencha o WhatsApp do cliente para enviar.");
    return;
  }
  // 1. Remove qualquer caractere que não seja número (espaços, parênteses, hífens, +)
  let foneLimpo = clienteFone.replace(/\D/g, '');

  // 2. Trata o DDD e o código do país
  // Se o usuário digitou apenas DDD + número (10 ou 11 dígitos), adiciona o '55' do Brasil
  if (foneLimpo.length === 10 || foneLimpo.length === 11) {
    foneLimpo = `55${foneLimpo}`;
  }

  const mensagem = encodeURIComponent(`Olá ${clienteNome}, Tudo bem?

Conforme conversamos, preparei a proposta comercial detalhada para o seu projeto.

Anexei o PDF com todas as especificações e prazos para sua avaliação. Fico à disposição para qualquer dúvida!`);

  window.open(`https://wa.me/${foneLimpo}?text=${mensagem}`, '_blank');
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