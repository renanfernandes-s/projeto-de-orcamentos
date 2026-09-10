import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ASAAS_BASE_URL = process.env.ASAAS_URL || 'https://api.asaas.com/v3';

// REGRAS DE NEGÓCIO RIGOROSAS PARA LIBERAÇÃO DO PLANO
const PLANO_PRO_VALOR_ESPERADO = 14.90;
const PLANO_PRO_DESCRICAO_ESPERADA = 'Assinatura OrçaFácilApp PRO';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).end('Method Not Allowed');
    }

    try {
        // 1. AUTENTICAÇÃO DO WEBHOOK
        const tokenRecebido = req.headers['asaas-access-token'];
        const tokenEsperado = process.env.ASAAS_WEBHOOK_TOKEN;

        if (!tokenRecebido || tokenRecebido !== tokenEsperado) {
            console.warn('⚠️ Tentativa de webhook não autorizada detectada.');
            return res.status(401).json({ error: 'Unauthorized webhook' });
        }

        const event = req.body;

        if (event.event === 'PAYMENT_RECEIVED' || event.event === 'PAYMENT_CONFIRMED') {
            const payment = event.payment;
            const paymentId = payment?.id;

            if (!paymentId) {
                console.error('❌ ID do pagamento não encontrado no evento.');
                return res.status(400).json({ error: 'Invalid payment data' });
            }

            // 2. DUPLA CHECAGEM DIRECT SERVER-TO-SERVER NA API OFICIAL DO ASAAS
            const asaasResponse = await fetch(`${ASAAS_BASE_URL}/payments/${paymentId}`, {
                method: 'GET',
                headers: {
                    'access_token': process.env.ASAAS_API_KEY
                }
            });

            if (!asaasResponse.ok) {
                throw new Error(`Falha ao consultar o pagamento diretamente na API do Asaas. Status: ${asaasResponse.status}`);
            }

            const verifiedPayment = await asaasResponse.json();

            // 3. RIGOROSA VALIDAÇÃO DE CONTRATO (STATUS, VALOR, MÉTODO, CLIENTE E DESCRIÇÃO)
            const isStatusValido = verifiedPayment.status === 'RECEIVED' || verifiedPayment.status === 'CONFIRMED';
            const isValorCorreto = Number(verifiedPayment.value) === PLANO_PRO_VALOR_ESPERADO;
            const isBillingTypePix = verifiedPayment.billingType === 'PIX';
            const isDescricaoCorreta = verifiedPayment.description === PLANO_PRO_DESCRICAO_ESPERADA;
            const targetUserId = verifiedPayment.externalReference;
            const customerId = verifiedPayment.customer;

            if (!isStatusValido) {
                console.warn(`ℹ️ Pagamento ${paymentId} ignorado. Status: ${verifiedPayment.status}`);
                return res.status(200).json({ received: true });
            }

            if (!targetUserId || !customerId) {
                console.error('❌ Referência de usuário ou cliente ausente na cobrança validada.');
                return res.status(200).json({ received: true, ignored: true });
            }

            if (!isValorCorreto || !isBillingTypePix || !isDescricaoCorreta) {
                console.error(`🚨 ALERTA DE SEGURANÇA: Divergência nos dados da cobrança ${paymentId}!`, {
                    valorEsperado: PLANO_PRO_VALOR_ESPERADO,
                    valorRecebido: verifiedPayment.value,
                    billingType: verifiedPayment.billingType,
                    description: verifiedPayment.description
                });
                // Divergência de contrato não será corrigida por um retry do Asaas.
                return res.status(200).json({ received: true, ignored: true });
            }

            // 4. ATUALIZAÇÃO SEGURA DO STATUS PRO NO BANCO DE DADOS
            const { error } = await supabaseAdmin
                .from('profiles')
                .upsert({ id: targetUserId, is_pro: true }, { onConflict: 'id' });

            if (error) {
                console.error('❌ Erro ao atualizar status PRO no Supabase:', error);
                return res.status(500).json({ error: 'Erro ao atualizar banco de dados' });
            }

            console.log(`✅ Status PRO liberado com sucesso para o usuário ID: ${targetUserId} (Cobrança: ${paymentId})`);
        }

        return res.status(200).json({ received: true });
    } catch (err) {
        console.error('❌ Erro no processamento do webhook:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
}