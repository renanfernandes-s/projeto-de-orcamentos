import {
    ASAAS_BASE_URL,
    PLANO_PRO_VALOR,
    PLANO_PRO_DESCRICAO,
    autenticarUsuario,
    atualizarTentativa,
    buscarClienteAsaas,
    obterChaveIdempotencia,
    reservarTentativa
} from './_payment-utils.mjs';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).end('Method Not Allowed');
    }

    const user = await autenticarUsuario(req, res);
    if (!user) return;

    const idempotencyKey = obterChaveIdempotencia(req);
    if (!idempotencyKey) return res.status(400).json({ error: 'Chave de idempotência inválida ou ausente.' });

    let attemptId = null;
    try {
        const { cpfCnpj: rawCpfCnpj, name } = req.body;
        if (!rawCpfCnpj || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'CPF/CNPJ e Nome são obrigatórios.' });
        }

        const cpfCnpj = String(rawCpfCnpj).replace(/\D/g, '');
        if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
            return res.status(400).json({ error: 'CPF deve conter 11 dígitos ou CNPJ 14 dígitos.' });
        }

        const { attempt, existing } = await reservarTentativa({
            userId: user.id,
            method: 'CREDIT_CARD',
            cpfCnpj,
            idempotencyKey
        });
        attemptId = attempt.id;

        if (existing) {
            if (!attempt.payment_id || !attempt.invoice_url) return res.status(409).json({ error: 'Esta cobrança ainda está sendo processada.' });
            return res.status(200).json({ paymentId: attempt.payment_id, invoiceUrl: attempt.invoice_url });
        }

        const customerId = await buscarClienteAsaas({ cpfCnpj, userId: user.id, userEmail: user.email, name });
        const paymentRes = await fetch(`${ASAAS_BASE_URL}/payments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'access_token': process.env.ASAAS_API_KEY },
            body: JSON.stringify({
                customer: customerId,
                billingType: 'CREDIT_CARD',
                value: PLANO_PRO_VALOR,
                dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                description: PLANO_PRO_DESCRICAO,
                externalReference: user.id
            })
        });
        const paymentData = await paymentRes.json();
        if (!paymentRes.ok || !paymentData.invoiceUrl) throw new Error(paymentData.errors?.[0]?.description || 'Erro ao gerar checkout no Asaas.');

        await atualizarTentativa(attempt.id, { payment_id: paymentData.id, invoice_url: paymentData.invoiceUrl, status: 'PENDING' });
        return res.status(200).json({ paymentId: paymentData.id, invoiceUrl: paymentData.invoiceUrl });
    } catch (err) {
        if (attemptId) {
            try { await atualizarTentativa(attemptId, { status: 'FAILED' }); } catch (updateError) { console.error('Erro ao marcar tentativa de cartão como falha:', updateError.message); }
        }
        console.error('Erro na rota /api/gerar-checkout:', err.message);
        return res.status(500).json({ error: 'Erro interno ao processar checkout.' });
    }
}