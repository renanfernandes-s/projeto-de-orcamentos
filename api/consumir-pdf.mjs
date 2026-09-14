import { supabaseAdmin, autenticarUsuario } from './_payment-utils.mjs';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).end('Method Not Allowed');
    }

    const user = await autenticarUsuario(req, res);
    if (!user) return;

    const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('is_pro').eq('id', user.id).single();
    if (profileError) return res.status(500).json({ error: 'Não foi possível validar o limite.' });
    if (profile?.is_pro) return res.status(200).json({ allowed: true, isPro: true });

    const { data, error } = await supabaseAdmin.rpc('consumir_pdf_gratuito', { p_user_id: user.id });
    if (error) return res.status(500).json({ error: 'Não foi possível registrar o PDF.' });
    if (!data?.length) return res.status(403).json({ error: 'Você atingiu o limite de 3 PDFs gratuitos.' });
    return res.status(200).json({ allowed: true, pdfCount: data[0].pdf_count });
}