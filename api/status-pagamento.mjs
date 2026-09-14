import { supabaseAdmin, autenticarUsuario } from './_payment-utils.mjs';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).end('Method Not Allowed');
    }

    const user = await autenticarUsuario(req, res);
    if (!user) return;

    const paymentId = String(req.query?.paymentId || '').trim();
    if (!paymentId) return res.status(400).json({ error: 'paymentId é obrigatório.' });

    const { data, error } = await supabaseAdmin.from('payment_attempts').select('payment_id, method, status').eq('user_id', user.id).eq('payment_id', paymentId).maybeSingle();
    if (error) return res.status(500).json({ error: 'Não foi possível consultar o pagamento.' });
    if (!data) return res.status(404).json({ error: 'Pagamento não encontrado.' });
    return res.status(200).json(data);
}