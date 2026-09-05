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

    const { userId, userEmail } = req.body;

    if (!userId) {
        return res.status(400).json({ error: 'Usuário não identificado' });
    }

    try {
        const asaasUrl = process.env.ASAAS_URL || 'https://api.asaas.com/v3';
        const asaasApiKey = process.env.ASAAS_API_KEY;

        // Cria a cobrança no Asaas vinculando o ID do usuário no externalReference
        const response = await fetch(`${asaasUrl}/payments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'access_token': asaasApiKey
            },
            body: JSON.stringify({
                billingType: 'PIX',
                value: 29.90,
                dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                description: 'Assinatura Mensal - OrçaFácil PRO',
                externalReference: userId,
                customer: 'cus_000006272978' // Ajuste para o ID de um cliente padrão no Asaas se necessário
            })
        });

        const paymentData = await response.json();

        if (!response.ok) {
            console.error('Erro Asaas:', paymentData);
            return res.status(400).json({ error: 'Erro ao gerar cobrança no Asaas', details: paymentData });
        }

        // Busca os dados do QR Code da cobrança criada
        const qrResponse = await fetch(`${asaasUrl}/payments/${paymentData.id}/pixQrCode`, {
            method: 'GET',
            headers: {
                'access_token': asaasApiKey
            }
        });

        const qrData = await qrResponse.json();

        if (!qrResponse.ok) {
            return res.status(400).json({ error: 'Erro ao gerar QR Code Pix' });
        }

        return res.status(200).json({
            paymentId: paymentData.id,
            encodedImage: qrData.encodedImage,
            payload: qrData.payload
        });

    } catch (err) {
        console.error('Erro interno:', err);
        return res.status(500).json({ error: 'Erro interno ao processar pagamento' });
    }
}