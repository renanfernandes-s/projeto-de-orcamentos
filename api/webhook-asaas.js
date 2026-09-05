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
        // URL do Asaas (Produção ou Sandbox/Homologação)
        const asaasUrl = process.env.VITE_ASAAS_URL || 'https://api.asaas.com/v3';
        const asaasApiKey = process.env.VITE_ASAAS_API_KEY;

        // 1. Verificar se o cliente já existe no Asaas ou criar um rápido
        // Para simplificar, criamos uma cobrança direta via Pix
        const response = await fetch(`${asaasUrl}/payments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'access_token': asaasApiKey
            },
            body: JSON.stringify({
                billingType: 'PIX',
                value: 29.90,
                dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Vencimento amanhã
                description: 'Assinatura Mensal - OrçaFácil PRO',
                externalReference: userId, // Chave vital para o webhook identificar o usuário!
                customer: 'cus_000006272978' // Opcional: ID de um cliente padrão ou crie um cliente antes
            })
        });

        const paymentData = await response.json();

        if (!response.ok) {
            console.error('Erro Asaas:', paymentData);
            return res.status(400).json({ error: 'Erro ao gerar cobrança no Asaas', details: paymentData });
        }

        // 2. Buscar os dados do QR Code Pix da cobrança gerada
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

        // Retorna o payload e a imagem do QR Code para o front-end
        return res.status(200).json({
            paymentId: paymentData.id,
            encodedImage: qrData.encodedImage, // String base64 da imagem do QR Code
            payload: qrData.payload // O código Pix Copia e Cola
        });

    } catch (err) {
        console.error('Erro interno:', err);
        return res.status(500).json({ error: 'Erro interno ao processar pagamento' });
    }
}