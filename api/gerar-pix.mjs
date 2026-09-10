import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Configuração do servidor incompleta: chaves do Supabase ausentes.');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const ASAAS_BASE_URL = process.env.ASAAS_URL || 'https://sandbox.asaas.com/api/v3';
const PLANO_PRO_VALOR = 14.90;
const PLANO_PRO_DESCRICAO = 'Assinatura OrçaFácilApp PRO';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).end('Method Not Allowed');
    }

    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token de autenticação não fornecido.' });
        }

        const token = authHeader.split(' ')[1];
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Usuário não autenticado ou sessão inválida.' });
        }

        const userId = user.id;
        const userEmail = user.email;
        const { cpfCnpj, name } = req.body;

        if (!cpfCnpj || !name) {
            return res.status(400).json({ error: 'CPF/CNPJ e Nome são obrigatórios.' });
        }

        let customerId;
        const searchCustomerRes = await fetch(`${ASAAS_BASE_URL}/customers?cpfCnpj=${cpfCnpj}`, {
            method: 'GET',
            headers: { 'access_token': process.env.ASAAS_API_KEY }
        });
        const searchCustomerData = await searchCustomerRes.json();

        if (searchCustomerData.data && searchCustomerData.data.length > 0) {
            customerId = searchCustomerData.data[0].id;
        } else {
            const createCustomerRes = await fetch(`${ASAAS_BASE_URL}/customers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'access_token': process.env.ASAAS_API_KEY
                },
                body: JSON.stringify({
                    name,
                    cpfCnpj,
                    email: userEmail,
                    externalReference: userId
                })
            });
            const newCustomer = await createCustomerRes.json();

            if (!createCustomerRes.ok) {
                return res.status(400).json({ error: newCustomer.errors?.[0]?.description || 'Erro ao criar cliente no Asaas.' });
            }
            customerId = newCustomer.id;
        }

        const paymentRes = await fetch(`${ASAAS_BASE_URL}/payments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'access_token': process.env.ASAAS_API_KEY
            },
            body: JSON.stringify({
                customer: customerId,
                billingType: 'PIX',
                value: PLANO_PRO_VALOR,
                dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                description: PLANO_PRO_DESCRICAO,
                externalReference: userId
            })
        });

        const paymentData = await paymentRes.json();

        if (!paymentRes.ok) {
            return res.status(400).json({ error: paymentData.errors?.[0]?.description || 'Erro ao criar cobrança no Asaas.' });
        }

        const qrCodeRes = await fetch(`${ASAAS_BASE_URL}/payments/${paymentData.id}/pixQrCode`, {
            method: 'GET',
            headers: { 'access_token': process.env.ASAAS_API_KEY }
        });

        const qrCodeData = await qrCodeRes.json();

        return res.status(200).json({
            paymentId: paymentData.id,
            encodedImage: qrCodeData.encodedImage,
            payload: qrCodeData.payload,
            expirationDate: qrCodeData.expirationDate
        });
    } catch (err) {
        console.error('Erro na rota /api/gerar-pix:', err.message);
        return res.status(500).json({ error: 'Erro interno ao processar Pix.' });
    }
}