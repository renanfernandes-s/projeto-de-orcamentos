const ASAAS_URL = import.meta.env.VITE_ASAAS_URL;
const API_KEY = import.meta.env.VITE_ASAAS_API_KEY;

const getHeaders = () => ({
    'Content-Type': 'application/json',
    'access_token': API_KEY
});

// Busca ou cria o cliente no Sandbox
async function getOrCreateCustomer() {
    try {
        const response = await fetch(`${ASAAS_URL}/customers?email=teste.orcafacil@email.com`, {
            headers: getHeaders()
        });

        if (!response.ok) {
            throw new Error(`Erro na API do Asaas (${response.status})`);
        }

        const data = await response.json();

        if (data.data && data.data.length > 0) {
            return data.data[0].id;
        }

        const createRes = await fetch(`${ASAAS_URL}/customers`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                name: 'Cliente Teste OrçaFácil',
                email: 'teste.orcafacil@email.com',
                cpfCnpj: '12345678909'
            })
        });

        if (!createRes.ok) throw new Error('Falha ao criar cliente de teste');

        const newCustomer = await createRes.json();
        return newCustomer.id;
    } catch (err) {
        console.error('Erro em getOrCreateCustomer:', err);
        throw err;
    }
}

// Gera a cobrança Pix e devolve a imagem, o copia-e-cola e o ID do pagamento
export async function generatePixPayment() {
    try {
        const customerId = await getOrCreateCustomer();
        const dueDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];

        const paymentRes = await fetch(`${ASAAS_URL}/payments`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                customer: customerId,
                billingType: 'PIX',
                value: 14.90,
                dueDate: dueDate,
                description: 'Assinatura Mensal - OrçaFácil Pro'
            })
        });

        if (!paymentRes.ok) return null;
        const paymentData = await paymentRes.json();

        const qrRes = await fetch(`${ASAAS_URL}/payments/${paymentData.id}/pixQrCode`, {
            headers: getHeaders()
        });

        if (!qrRes.ok) return null;
        const qrData = await qrRes.json();

        return {
            paymentId: paymentData.id, // ID necessário para verificar se foi pago
            qrCodeImage: `data:image/png;base64,${qrData.encodedImage}`,
            payload: qrData.payload
        };
    } catch (err) {
        console.error('Erro ao gerar pagamento Pix:', err);
        return null;
    }
}

// Consulta o status da cobrança no Asaas
export async function checkPaymentStatus(paymentId) {
    try {
        const response = await fetch(`${ASAAS_URL}/payments/${paymentId}`, {
            headers: getHeaders()
        });

        if (!response.ok) return false;

        const data = await response.json();
        // Retorna true se o pagamento foi recebido ou confirmado
        return data.status === 'RECEIVED' || data.status === 'CONFIRMED' || data.status === 'RECEIVED_IN_CASH';
    } catch (err) {
        console.error('Erro ao verificar status do pagamento:', err);
        return false;
    }
}