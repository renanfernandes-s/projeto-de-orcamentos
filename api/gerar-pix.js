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

        // 1. Busca ou cria o cliente no Asaas pelo e-mail
        const customerResponse = await fetch(`${asaasUrl}/customers?email=${encodeURIComponent(userEmail || 'cliente@orcafacil.com')}`, {
            method: 'GET',
            headers: {
                'access_token': asaasApiKey
            }
        });

        const customerData = await customerResponse.json();
        let customerId;

        if (customerData.data && customerData.data.length > 0) {
            customerId = customerData.data[0].id;
        } else {
            // Se o cliente não existe, cria um novo
            const newCustomerResponse = await fetch(`${asaasUrl}/customers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'access_token': asaasApiKey
                },
                body: JSON.stringify({
                    name: userEmail ? userEmail.split('@')[0] : 'Cliente OrçaFácil',
                    email: useremail || 'cliente@orcafacil.com',
                    externalReference: userId
                })
            });

            const newCustomer = await newCustomerResponse.json();
            if (!newCustomerResponse.ok) {
                console.error('Erro ao criar cliente Asaas:', newCustomer);
                return res.status(400).json({ error: 'Erro ao cadastrar cliente no gateway de pagamento', details: newCustomer });
            }
            customerId = newCustomer.id;
        }

        // 2. Cria a cobrança no Asaas vinculando o cliente correto
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
                customer: customerId
            })
        });

        const paymentData = await response.json();

        if (!response.ok) {
            console.error('Erro Asaas:', paymentData);
            return res.status(400).json({ error: 'Erro ao gerar cobrança no Asaas', details: paymentData });
        }

        // 3. Busca os dados do QR Code da cobrança criada
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