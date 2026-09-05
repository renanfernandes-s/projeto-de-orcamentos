import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).end('Method Not Allowed');
    }

    const event = req.body;

    // Verifica se o pagamento foi confirmado pelo Asaas
    if (event.event === 'PAYMENT_RECEIVED' || event.event === 'PAYMENT_CONFIRMED') {
        const payment = event.payment;
        const userId = payment.externalReference; // Recupera o ID do usuário que guardamos na cobrança!

        if (userId) {
            // Atualiza o usuário para PRO no banco de dados
            const { error } = await supabaseAdmin
                .from('profiles')
                .update({ is_pro: true })
                .eq('id', userId);

            if (error) {
                console.error('Erro ao atualizar status pro no Supabase:', error);
                return res.status(500).json({ error: 'Erro ao atualizar banco de dados' });
            }
        }
    }

    return res.status(200).json({ received: true });
}