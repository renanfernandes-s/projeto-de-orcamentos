import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Configuração do servidor incompleta: chaves do Supabase ausentes.');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const ASAAS_BASE_URL = process.env.ASAAS_URL;
if (!ASAAS_BASE_URL) throw new Error('ASAAS_URL não configurada.');

// Regras de negócio rigorosas
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

        const { event, payment } = req.body;

        // Se o evento não for de pagamento recebido/confirmado, apenas confirma a entrega do webhook
        if (event !== 'PAYMENT_RECEIVED' && event !== 'PAYMENT_CONFIRMED') {
            return res.status(200).json({ received: true, message: 'Evento ignorado (não é confirmação de pagamento).' });
        }
        const supabaseAdmin = createClient(
            supabaseUrl,
            supabaseServiceKey
        );
        if (!payment || !payment.id) {
            return res.status(400).json({ error: 'Dados da cobrança ausentes no payload.' });
        }

        const PLANO_PRO_VALOR_ESPERADO = PLANO_PRO_VALOR;
        const PLANO_PRO_DESCRICAO_ESPERADA = PLANO_PRO_DESCRICAO;
        // 2. DUPLA CHECAGEM DIRECT SERVER-TO-SERVER NA API OFICIAL DO ASAAS
        const asaasResponse = await fetch(`${ASAAS_BASE_URL}/payments/${paymentId}`, {
            method: 'GET',
            headers: {
                'access_token': process.env.ASAAS_API_KEY
            }
        });

        if (!asaasResponse.ok) {
            throw new Error(`Falha ao consultar o pagamento na API do Asaas. Status: ${asaasResponse.status}`);
        }

        const verifiedPayment = await asaasResponse.json();

        // 3. EXTRAÇÃO E FALLBACK DO USERID
        let targetUserId = verifiedPayment.externalReference;

        // Fallback: Se não estiver gravado na cobrança, busca na referência externa do cadastro do cliente
        if (!targetUserId && verifiedPayment.customer) {
            const customerRes = await fetch(`${ASAAS_BASE_URL}/customers/${verifiedPayment.customer}`, {
                headers: { 'access_token': process.env.ASAAS_API_KEY }
            });
            if (customerRes.ok) {
                const customerData = await customerRes.json();
                targetUserId = customerData.externalReference;
            }
        }

        if (!targetUserId) {
            console.error(`❌ Webhook rejeitado: Nenhum userId vinculado à cobrança ${paymentId}.`);
            return res.status(200).json({ received: true, ignored: true, reason: 'Sem userId vinculado' });
        }

        // 4. VALIDAÇÃO RIGOROSA DO CONTRATO
        const isStatusValido = verifiedPayment.status === 'RECEIVED' || verifiedPayment.status === 'CONFIRMED';
        const isValorCorreto = Number(verifiedPayment.value) === PLANO_PRO_VALOR_ESPERADO;
        const metodosPermitidos = ['PIX', 'CREDIT_CARD'];
        const isMetodoValido = metodosPermitidos.includes(verifiedPayment.billingType);
        const isDescricaoCorreta = verifiedPayment.description === PLANO_PRO_DESCRICAO_ESPERADA;

        if (!isStatusValido) {
            console.warn(`ℹ️ Pagamento ${paymentId} ignorado. Status retornado: ${verifiedPayment.status}`);
            return res.status(200).json({ received: true });
        }

        if (!isValorCorreto || !isMetodoValido || !isDescricaoCorreta) {
            console.error(`🚨 ALERTA DE SEGURANÇA: Divergência nos dados da cobrança ${paymentId}!`, {
                valorEsperado: PLANO_PRO_VALOR_ESPERADO,
                valorRecebido: verifiedPayment.value,
                billingType: verifiedPayment.billingType,
                description: verifiedPayment.description
            });
            return res.status(200).json({ received: true, ignored: true, reason: 'Divergência nas regras de negócio' });
        }

        // 5. ATUALIZAÇÃO SEGURA NO SUPABASE
        const { data: updatedProfile, error } = await supabaseAdmin
            .from('profiles')
            .update({ is_pro: true })
            .eq('id', targetUserId)
            .select('id');

        if (error) {
            console.error('❌ Erro ao atualizar status PRO no Supabase:', error);
            return res.status(500).json({ error: 'Erro ao atualizar banco de dados' });
        }
        if (!updatedProfile?.length) {
            return res.status(500).json({ error: 'Perfil do usuário não encontrado' });
        }

        console.log(`✅ Plano PRO ativado com sucesso para o usuário ID: ${targetUserId} (Cobrança: ${paymentId})`);
        return res.status(200).json({ received: true, success: true });

    } catch (err) {
        console.error('❌ Erro no processamento do webhook:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
}