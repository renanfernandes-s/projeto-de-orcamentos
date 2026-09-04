import './style.css';
import html2pdf from 'html2pdf.js';
import { supabase } from './supabase.js';
import { generatePixPayment, checkPaymentStatus } from './asaas.js';

// --- IDENTIFICADOR DO DISPOSITIVO E LIMITE ---
const deviceId = localStorage.getItem('orcafacil_device_id') || (() => {
  const newId = crypto.randomUUID();
  localStorage.setItem('orcafacil_device_id', newId);
  return newId;
})();

const MAX_FREE_LIMIT = 3;

// --- SELETORES DO DOM ---
const providerNameInput = document.getElementById('provider-name');
const providerPhoneInput = document.getElementById('provider-phone');
const clientNameInput = document.getElementById('client-name');
const clientPhoneInput = document.getElementById('client-phone');
const notesInput = document.getElementById('notes');

const previewProviderName = document.getElementById('preview-provider-name');
const previewProviderPhone = document.getElementById('preview-provider-phone');
const previewClientName = document.getElementById('preview-client-name');
const previewClientPhone = document.getElementById('preview-client-phone');
const previewNotes = document.getElementById('preview-notes');
const previewDate = document.getElementById('preview-date');
const previewTotal = document.getElementById('preview-total');
const previewItemsList = document.getElementById('preview-items-list');

const itemsContainer = document.getElementById('items-container');
const btnAddItem = document.getElementById('btn-add-item');
const btnGeneratePdf = document.getElementById('btn-generate-pdf');
const btnSendWhatsapp = document.getElementById('btn-send-whatsapp');

// Seletores do Modal Pix e Limite
const usedCountEl = document.getElementById('used-count');
const pixModal = document.getElementById('pix-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCopyPix = document.getElementById('btn-copy-pix');
const qrCodeBox = document.getElementById('qr-code-box');

let currentPixCode = "";
let pollInterval = null;
let currentUser = null;
let isSignUpMode = false;

// --- VERIFICAÇÃO E CONTAGEM DE USO ---
async function checkUsageLimit() {
  const { count, error } = await supabase
    .from('budgets')
    .select('*', { count: 'exact', head: true })
    .eq('device_id', deviceId);

  const currentCount = error ? 0 : (count || 0);
  if (usedCountEl) usedCountEl.textContent = currentCount;
  return currentCount;
}

function isProUser() {
  return localStorage.getItem('orcafacil_is_pro') === 'true';
}

function activateProPlan() {
  localStorage.setItem('orcafacil_is_pro', 'true');

  const usageBadge = document.getElementById('usage-badge');
  if (usageBadge) {
    usageBadge.textContent = 'Plano Pro Ativo (Ilimitado)';
    usageBadge.className = 'bg-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full border border-emerald-300';
  }
}

// Inicializações
if (isProUser()) {
  activateProPlan();
} else {
  checkUsageLimit();
}

if (previewDate) {
  previewDate.textContent = new Date().toLocaleDateString('pt-BR');
}

// --- AUTENTICAÇÃO SUPABASE ---
const authModal = document.getElementById('auth-modal');
const toggleBtn = document.getElementById('auth-toggle-btn');

toggleBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  isSignUpMode = !isSignUpMode;

  document.getElementById('auth-modal-title').innerText = isSignUpMode ? 'Criar Conta' : 'Acessar sua Conta';
  document.getElementById('btn-submit-auth').innerText = isSignUpMode ? 'Cadastrar' : 'Entrar';
  document.getElementById('auth-toggle-text').innerText = isSignUpMode ? 'Já tem uma conta?' : 'Não tem uma conta?';
  toggleBtn.innerText = isSignUpMode ? 'Entrar' : 'Cadastre-se';
});

document.getElementById('btn-open-login').onclick = () => authModal?.classList.remove('hidden');
document.getElementById('btn-close-auth-modal').onclick = () => authModal?.classList.add('hidden');

document.getElementById('auth-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;

  try {
    if (isSignUpMode) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      alert('Cadastro realizado com sucesso!');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
    authModal?.classList.add('hidden');
  } catch (err) {
    alert('Erro na autenticação: ' + err.message);
  }
});

document.getElementById('btn-logout').onclick = async () => {
  await supabase.auth.signOut();
};

supabase.auth.onAuthStateChange(async (event, session) => {
  if (session) {
    currentUser = session.user;
    document.getElementById('logged-out-view').style.display = 'none';
    document.getElementById('logged-in-view').style.display = 'flex';
    document.getElementById('user-email-display').innerText = currentUser.email;

    await checkProStatus(currentUser.id);
  } else {
    currentUser = null;
    document.getElementById('logged-out-view').style.display = 'block';
    document.getElementById('logged-in-view').style.display = 'none';
    localStorage.removeItem('orcafacil_is_pro');
  }
});

async function checkProStatus(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('is_pro')
    .eq('id', userId)
    .single();

  if (data && data.is_pro) {
    activateProPlan();
    document.getElementById('user-status-badge').innerText = 'Plano PRO';
    document.getElementById('user-status-badge').className = 'bg-emerald-500 text-white text-xs font-bold px-2.5 py-1 rounded-full';
  } else {
    localStorage.removeItem('orcafacil_is_pro');
    document.getElementById('user-status-badge').innerText = 'Gratuito';
    document.getElementById('user-status-badge').className = 'bg-slate-700 text-white text-xs font-bold px-2.5 py-1 rounded-full';
  }
}

// --- GERENCIAMENTO DO MODAL PIX E POLLING ---
function closePixModal() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  pixModal?.classList.add('hidden');
}

btnCloseModal?.addEventListener('click', closePixModal);

async function renderPixCheckout() {
  if (pollInterval) clearInterval(pollInterval);

  if (qrCodeBox) {
    qrCodeBox.innerHTML = `<p class="text-xs text-slate-500 animate-pulse py-4 text-center">Gerando Pix no Asaas...</p>`;
  }

  const paymentInfo = await generatePixPayment();

  if (!paymentInfo) {
    if (qrCodeBox) {
      qrCodeBox.innerHTML = `<p class="text-xs text-red-500 text-center py-4">Erro ao carregar o Pix. Verifique as configurações.</p>`;
    }
    alert('Erro ao gerar cobrança Pix.');
    return;
  }

  currentPixCode = paymentInfo.payload;
  if (qrCodeBox) {
    qrCodeBox.innerHTML = `
      <img src="${paymentInfo.qrCodeImage}" alt="QR Code Pix Asaas" class="w-44 h-44 rounded-lg shadow-sm mb-2 mx-auto" />
      <span class="text-[11px] text-slate-500 font-medium block text-center">Escaneie o QR Code no app do seu banco</span>
    `;
  }

  pollInterval = setInterval(async () => {
    const isPaid = await checkPaymentStatus(paymentInfo.paymentId);

    if (isPaid) {
      clearInterval(pollInterval);
      pollInterval = null;

      activateProPlan();

      // Atualiza no banco de dados se o usuário estiver logado
      if (currentUser) {
        await supabase
          .from('profiles')
          .update({ is_pro: true })
          .eq('id', currentUser.id);
      }

      alert('🎉 Pagamento confirmado! Seu Plano Pro foi ativado com sucesso.');
      closePixModal();
    }
  }, 4000);
}

btnCopyPix?.addEventListener('click', async () => {
  if (!currentPixCode) return;
  try {
    await navigator.clipboard.writeText(currentPixCode);

    const originalText = btnCopyPix.innerHTML;
    btnCopyPix.innerHTML = '✅ Código Copiado!';
    btnCopyPix.classList.remove('bg-slate-800', 'hover:bg-slate-900');
    btnCopyPix.classList.add('bg-emerald-600', 'hover:bg-emerald-700');

    setTimeout(() => {
      btnCopyPix.innerHTML = originalText;
      btnCopyPix.classList.remove('bg-emerald-600', 'hover:bg-emerald-700');
      btnCopyPix.classList.add('bg-slate-800', 'hover:bg-slate-900');
    }, 3000);

  } catch (err) {
    alert('Não foi possível copiar automaticamente.');
  }
});

// --- ATUALIZAÇÃO EM TEMPO REAL NO PREVIEW ---
providerNameInput?.addEventListener('input', (e) => {
  previewProviderName.textContent = e.target.value || 'Seu Nome / Empresa';
});

providerPhoneInput?.addEventListener('input', (e) => {
  previewProviderPhone.textContent = e.target.value ? `Contato: ${e.target.value}` : 'Contato: (00) 00000-0000';
});

clientNameInput?.addEventListener('input', (e) => {
  previewClientName.textContent = e.target.value || 'Nome do Cliente';
});

clientPhoneInput?.addEventListener('input', (e) => {
  previewClientPhone.textContent = e.target.value || '(00) 00000-0000';
});

notesInput?.addEventListener('input', (e) => {
  previewNotes.textContent = e.target.value || 'Sem observações adicionais.';
});

// --- CÁLCULO DOS ITENS ---
function calculateAndRenderItems() {
  const rows = itemsContainer.querySelectorAll('.item-row');
  let grandTotal = 0;

  previewItemsList.innerHTML = '';

  if (rows.length === 0) {
    previewItemsList.innerHTML = `
      <tr>
        <td class="py-2 text-slate-500 italic">Nenhum item adicionado</td>
        <td class="py-2 text-center text-slate-500">-</td>
        <td class="py-2 text-right text-slate-500">R$ 0,00</td>
      </tr>`;
    previewTotal.textContent = 'R$ 0,00';
    return;
  }

  rows.forEach(row => {
    const desc = row.querySelector('.item-desc').value || 'Item sem descrição';
    const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
    const price = parseFloat(row.querySelector('.item-price').value) || 0;

    const subtotal = qty * price;
    grandTotal += subtotal;

    const tr = document.createElement('tr');
    tr.className = 'border-b border-slate-100';
    tr.innerHTML = `
      <td class="py-2 font-medium text-slate-700">${desc}</td>
      <td class="py-2 text-center text-slate-600">${qty}</td>
      <td class="py-2 text-right font-bold text-slate-800">R$ ${subtotal.toFixed(2).replace('.', ',')}</td>
    `;
    previewItemsList.appendChild(tr);
  });

  previewTotal.textContent = `R$ ${grandTotal.toFixed(2).replace('.', ',')}`;
}

itemsContainer?.addEventListener('input', calculateAndRenderItems);

btnAddItem?.addEventListener('click', () => {
  const newRow = document.createElement('div');
  newRow.className = 'item-row grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-200';
  newRow.innerHTML = `
    <input type="text" placeholder="Descrição do serviço" class="col-span-6 p-2 border border-slate-300 rounded text-sm item-desc">
    <input type="number" placeholder="Qtd" value="1" min="1" class="col-span-2 p-2 border border-slate-300 rounded text-sm text-center item-qty">
    <input type="number" placeholder="Valor (R$)" step="0.01" class="col-span-3 p-2 border border-slate-300 rounded text-sm item-price">
    <button type="button" class="col-span-1 text-red-500 font-bold hover:text-red-700 text-center btn-remove-item">✕</button>
  `;

  newRow.querySelector('.btn-remove-item').addEventListener('click', () => {
    newRow.remove();
    calculateAndRenderItems();
  });

  itemsContainer.appendChild(newRow);
  calculateAndRenderItems();
});

// --- GERAR PDF COM VERIFICAÇÃO DE LIMITE ---
btnGeneratePdf?.addEventListener('click', async () => {
  const currentUsage = await checkUsageLimit();

  if (currentUsage >= MAX_FREE_LIMIT && !isProUser()) {
    renderPixCheckout();
    pixModal?.classList.remove('hidden');
    return;
  }

  const element = document.getElementById('pdf-template');
  const clientName = clientNameInput.value.trim() || 'Cliente';

  const options = {
    margin: 8,
    filename: `Orcamento_${clientName.replace(/\s+/g, '_')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  html2pdf().set(options).from(element).save();

  const totalText = previewTotal.textContent.replace('R$', '').replace('.', '').replace(',', '.').trim();
  const grandTotal = parseFloat(totalText) || 0;

  await supabase.from('budgets').insert([
    {
      provider_name: providerNameInput.value || 'Não informado',
      client_name: clientNameInput.value || 'Não informado',
      total_amount: grandTotal,
      device_id: deviceId
    }
  ]);

  checkUsageLimit();
});

// --- ENVIO WHATSAPP ---
btnSendWhatsapp?.addEventListener('click', () => {
  const rawPhone = clientPhoneInput.value.replace(/\D/g, '');
  const clientName = clientNameInput.value.trim() || 'Cliente';
  const providerName = providerNameInput.value.trim() || 'Sua Empresa';
  const total = previewTotal.textContent;

  if (!rawPhone) {
    alert('Por favor, informe o WhatsApp do cliente para enviar a mensagem.');
    return;
  }

  const message = `Olá, *${clientName}*! Tudo bem?\n\n` +
    `Aqui é da *${providerName}*. Seu orçamento foi gerado com sucesso no valor total de *${total}*.\n\n` +
    `Estou à disposição para tirarmos dúvidas e confirmarmos o serviço!`;

  const encodedMessage = encodeURIComponent(message);
  window.open(`https://wa.me/55${rawPhone}?text=${encodedMessage}`, '_blank');
});