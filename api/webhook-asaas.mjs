import { createClient } from '@supabase/supabase-js';
const PLANO_PRO_VALOR = 14.90;
const PLANO_PRO_DESCRICAO = 'Assinatura OrçaFácilApp PRO';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Configuração do servidor incompleta: chaves do Supabase ausentes.');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const ASAAS_BASE_URL = process.env.ASAAS_URL;
if (!ASAAS_BASE_URL) throw new Error('ASAAS_URL não configurada.');

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

        // Filtra apenas confirmações de pagamento
        if (event !== 'PAYMENT_RECEIVED' && event !== 'PAYMENT_CONFIRMED') {
            return res.status(200).json({ received: true, message: 'Evento ignorado (não é confirmação de pagamento).' });
        }

        if (!payment || !payment.id) {
            return res.status(400).json({ error: 'Dados da cobrança ausentes no payload.' });
        }

        const paymentId = payment.id;

        // 2. CHECAGEM SERVER-TO-SERVER NA API DO ASAAS
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

        // 3. VALIDAÇÃO OBRIGATÓRIA DO CLIENTE E USERID (Ponto 2 e 3 do VS Code)
        let targetUserId = verifiedPayment.externalReference;

        if (!verifiedPayment.customer) {
            console.error(`❌ Webhook rejeitado: Cobrança ${paymentId} não possui cliente vinculado.`);
            return res.status(200).json({ received: true, ignored: true, reason: 'Sem cliente vinculado' });
        }

        const customerRes = await fetch(`${ASAAS_BASE_URL}/customers/${verifiedPayment.customer}`, {
            headers: { 'access_token': process.env.ASAAS_API_KEY }
        });

        if (!customerRes.ok) {
            throw new Error(`Falha ao consultar cliente ${verifiedPayment.customer} na API do Asaas. Status: ${customerRes.status}`);
        }

        const customerData = await customerRes.json();
        const customerUserId = customerData.externalReference;

        // Se o targetUserId não estava na cobrança, assume o do cliente
        if (!targetUserId) {
            targetUserId = customerUserId;
        }

        // Validação rigorosa: A referência externa do cliente DEVE corresponder ao targetUserId
        if (!customerUserId || customerUserId !== targetUserId) {
            console.error(`🚨 ALERTA DE SEGURANÇA: Divergência de cliente na cobrança ${paymentId}!`, {
                customerUserId,
                targetUserId
            });
            return res.status(200).json({ received: true, ignored: true, reason: 'Correspondência inválida entre cliente e usuário' });
        }

        // 4. VALIDAÇÃO RIGOROSA DO CONTRATO
        const isStatusValido = verifiedPayment.status === 'RECEIVED' || verifiedPayment.status === 'CONFIRMED';
        const isValorCorreto = Number(verifiedPayment.value) === PLANO_PRO_VALOR;
        const metodosPermitidos = ['PIX', 'CREDIT_CARD'];
        const isMetodoValido = metodosPermitidos.includes(verifiedPayment.billingType);
        const isDescricaoCorreta = verifiedPayment.description === PLANO_PRO_DESCRICAO;

        if (!isStatusValido) {
            console.warn(`ℹ️ Pagamento ${paymentId} ignorado. Status retornado: ${verifiedPayment.status}`);
            return res.status(200).json({ received: true });
        }

        if (!isValorCorreto || !isMetodoValido || !isDescricaoCorreta) {
            console.error(`🚨 ALERTA DE SEGURANÇA: Divergência nas regras de negócio da cobrança ${paymentId}!`, {
                valorEsperado: PLANO_PRO_VALOR,
                valorRecebido: verifiedPayment.value,
                billingType: verifiedPayment.billingType,
                description: verifiedPayment.description
            });
            return res.status(200).json({ received: true, ignored: true, reason: 'Divergência nas regras de negócio' });
        }

        // 5. ATUALIZAÇÃO E CAPTURA DE ERRO EM payment_attempts (Ponto 1 e 4 do VS Code)
        const { data: updatedAttempt, error: attemptError } = await supabaseAdmin
            .from('payment_attempts')
            .update({
                status: verifiedPayment.status,
                updated_at: new Date().toISOString()
            })
            .eq('payment_id', paymentId)
            .select('id');

        if (attemptError) {
            console.error('❌ Erro ao atualizar payment_attempts no Supabase:', attemptError);
            return res.status(500).json({ error: 'Erro ao atualizar tentativa de pagamento no banco' });
        }

        if (!updatedAttempt?.length) {
            console.warn(`⚠️ Nenhuma tentativa de pagamento encontrada em payment_attempts para o payment_id: ${paymentId}`);
        }

        // 6. ATUALIZAÇÃO DO STATUS PRO DO USUÁRIO
        const { data: updatedProfile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({ is_pro: true })
            .eq('id', targetUserId)
            .select('id');

        if (profileError) {
            console.error('❌ Erro ao atualizar status PRO no Supabase:', profileError);
            return res.status(500).json({ error: 'Erro ao atualizar perfil no banco' });
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