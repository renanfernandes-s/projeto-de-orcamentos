const ASAAS_URL = import.meta.env.VITE_ASAAS_URL;
const API_KEY = import.meta.env.VITE_ASAAS_API_KEY;


// Adicione este log temporário para debugar no navegador:
console.log('Chave carregada pelo Vite:', API_KEY);


// Cabeçalhos padrão para autenticação na API do Asaas
const getHeaders = () => ({
    'Content-Type': 'application/json',
    'access_token': API_KEY
});

// 1. Busca um cliente de teste ou cria um novo no Asaas
async function getOrCreateCustomer() {
    try {
        const response = await fetch(`${ASAAS_URL}/customers?email=teste.orcafacil@email.com`, {
            headers: getHeaders()
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Asaas Error ${response.status}]:`, errorText);
            throw new Error(`Erro de autenticação no Asaas (${response.status}). Verifique se a chave VITE_ASAAS_API_KEY no arquivo .env está correta.`);
        }

        const data = await response.json();

        // Retorna o ID se o cliente já existir
        if (data.data && data.data.length > 0) {
            return data.data[0].id;
        }

        // Se não existir, cria o cliente com CPF de teste válido
        const createRes = await fetch(`${ASAAS_URL}/customers`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
                name: 'Cliente Teste OrçaFácil',
                email: 'teste.orcafacil@email.com',
                cpfCnpj: '12345678909' // CPF válido de teste para o Sandbox
            })
        });

        if (!createRes.ok) {
            const errorText = await createRes.text();
            console.error('[Asaas Error ao criar cliente]:', errorText);
            throw new Error('Não foi possível cadastrar o cliente de teste no Asaas.');
        }

        const newCustomer = await createRes.json();
        return newCustomer.id;
    } catch (err) {
        console.error('Erro em getOrCreateCustomer:', err);
        throw err;
    }
}

// 2. Gera a cobrança Pix de R$ 14,90 e obtém o QR Code + Copia e Cola
export async function generatePixPayment() {
    try {
        const customerId = await getOrCreateCustomer();

        // Vencimento para o dia seguinte
        const dueDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];

        // Criar a cobrança no Asaas
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

        if (!paymentRes.ok) {
            const errorText = await paymentRes.text();
            console.error('[Asaas Error ao criar cobrança]:', errorText);
            return null;
        }

        const paymentData = await paymentRes.json();

        // Buscar a imagem do QR Code e o código Pix Copia e Cola (payload)
        const qrRes = await fetch(`${ASAAS_URL}/payments/${paymentData.id}/pixQrCode`, {
            headers: getHeaders()
        });

        if (!qrRes.ok) {
            const errorText = await qrRes.text();
            console.error('[Asaas Error ao gerar QR Code Pix]:', errorText);
            return null;
        }

        const qrData = await qrRes.json();

        return {
            qrCodeImage: `data:image/png;base64,${qrData.encodedImage}`,
            payload: qrData.payload
        };
    } catch (err) {
        console.error('Erro geral na API do Asaas:', err);
        return null;
    }
}