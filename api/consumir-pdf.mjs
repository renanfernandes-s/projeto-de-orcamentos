import { supabaseAdmin, autenticarUsuario, isUserPro } from './_payment-utils.mjs';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).end('Method Not Allowed');
    }

    const user = await autenticarUsuario(req, res);
    if (!user) return;

    try {
        if (await isUserPro(user)) return res.status(200).json({ allowed: true, isPro: true });
    } catch (error) {
        console.error('Erro ao validar assinatura PRO:', error.message);
        return res.status(500).json({ error: 'Não foi possível validar o limite.' });
    }

    const { data, error } = await supabaseAdmin.rpc('consumir_pdf_gratuito', { p_user_id: user.id });
    if (error) return res.status(500).json({ error: 'Não foi possível registrar o PDF.' });
    if (!data?.length) return res.status(403).json({ error: 'Você atingiu o limite de 3 PDFs gratuitos.' });
    return res.status(200).json({ allowed: true, pdfCount: data[0].pdf_count });
}