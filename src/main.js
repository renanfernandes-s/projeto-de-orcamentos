import './style.css';

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

// Define a data atual na visualização
previewDate.textContent = new Date().toLocaleDateString('pt-BR');

// --- ATUALIZAÇÃO EM TEMPO REAL (INPUTS SIMPLES) ---
providerNameInput.addEventListener('input', (e) => {
  previewProviderName.textContent = e.target.value || 'Seu Nome / Empresa';
});

providerPhoneInput.addEventListener('input', (e) => {
  previewProviderPhone.textContent = e.target.value ? `Contato: ${e.target.value}` : 'Contato: (00) 00000-0000';
});

clientNameInput.addEventListener('input', (e) => {
  previewClientName.textContent = e.target.value || 'Nome do Cliente';
});

clientPhoneInput.addEventListener('input', (e) => {
  previewClientPhone.textContent = e.target.value || '(00) 00000-0000';
});

notesInput.addEventListener('input', (e) => {
  previewNotes.textContent = e.target.value || 'Sem observações adicionais.';
});

// --- LÓGICA DA TABELA DE ITENS E CÁLCULO DE TOTAL ---
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

    // Adiciona linha na pré-visualização
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

// Escuta mudanças nos inputs de itens existentes
itemsContainer.addEventListener('input', calculateAndRenderItems);

// Adicionar novo item
btnAddItem.addEventListener('click', () => {
  const newRow = document.createElement('div');
  newRow.className = 'item-row grid grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-200';
  newRow.innerHTML = `
    <input type="text" placeholder="Descrição do serviço" class="col-span-6 p-2 border border-slate-300 rounded text-sm item-desc">
    <input type="number" placeholder="Qtd" value="1" min="1" class="col-span-2 p-2 border border-slate-300 rounded text-sm text-center item-qty">
    <input type="number" placeholder="Valor (R$)" step="0.01" class="col-span-3 p-2 border border-slate-300 rounded text-sm item-price">
    <button type="button" class="col-span-1 text-red-500 font-bold hover:text-red-700 text-center btn-remove-item">✕</button>
  `;

  // Botão de remover a linha
  newRow.querySelector('.btn-remove-item').addEventListener('click', () => {
    newRow.remove();
    calculateAndRenderItems();
  });

  itemsContainer.appendChild(newRow);
  calculateAndRenderItems();
});

// Configura remoção na primeira linha padrão
document.querySelectorAll('.btn-remove-item').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.target.closest('.item-row').remove();
    calculateAndRenderItems();
  });
});