import { createClient } from '@supabase/supabase-js';

// Inicializa o cliente Supabase com a chave de serviço (service_role) para poder atualizar o banco com privilégios de admin
const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    // O Asaas envia requisições via método POST
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).end('Method Not Allowed');
    }

    const event = req.body;

    // Verificação opcional de token de segurança do Asaas (Headers: asaas-access-token)
    const tokenHeader = req.headers['asaas-access-token'];
    if (process.env.ASAAS_WEBHOOK_TOKEN && tokenHeader !== process.env.ASAAS_WEBHOOK_TOKEN) {
        return res.status(401).json({ error: 'Token de webhook inválido' });
    }

    try {
        // Verificamos se o evento é de pagamento confirmado/recebido
        if (event && (event.event === 'PAYMENT_RECEIVED' || event.event === 'PAYMENT_CONFIRMED')) {
            const payment = event.payment;

            // O identificador do cliente ou email que veio na cobrança do Asaas
            // Dica: Você pode passar o ID do usuário do Supabase no campo 'externalReference' ou buscar pelo e-mail do cliente
            const userId = payment.externalReference;
            const customerEmail = payment.customerEmail; // Dependendo de como você criar a cobrança

            if (userId) {
                // Atualiza diretamente o usuário para PRO no Supabase
                const { error } = await supabaseAdmin
                    .from('profiles')
                    .update({ is_pro: true })
                    .eq('id', userId);

                if (error) {
                    console.error('Erro ao atualizar usuário no Supabase:', error);
                    return res.status(500).json({ error: 'Erro ao atualizar banco de dados' });
                }
            }
        }

        // Sempre retorne 200 para o Asaas saber que você recebeu o webhook com sucesso
        return res.status(200).json({ received: true });
    } catch (err) {
        console.error('Erro no processamento do webhook:', err);
        return res.status(500).json({ error: 'Erro interno no servidor' });
    }
}