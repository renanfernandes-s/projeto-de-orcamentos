import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const ASAAS_BASE_URL = process.env.ASAAS_URL;
if (!ASAAS_BASE_URL) throw new Error('ASAAS_URL não configurada.');
export const PLANO_PRO_VALOR = 14.90;
export const PLANO_PRO_DESCRICAO = 'Assinatura OrçaFácilApp PRO';
export const PLANO_PRO_DIAS = 30;

export async function isUserPro(user) {
    const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('plan_status, plan_expires_at')
        .eq('id', user.id)
        .single();

    if (error) throw error;

    const expiresAt = profile?.plan_expires_at ? new Date(profile.plan_expires_at) : null;
    return profile?.plan_status === 'active' && expiresAt instanceof Date && !Number.isNaN(expiresAt.valueOf()) && expiresAt > new Date();
}

export async function autenticarUsuario(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Token de autenticação não fornecido.' });
        return null;
    }

    const token = authHeader.slice('Bearer '.length).trim();
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
        res.status(401).json({ error: 'Usuário não autenticado ou sessão inválida.' });
        return null;
    }

    return user;
}

export function obterChaveIdempotencia(req) {
    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || key.length < 16 || key.length > 128) return null;
    return key;
}

export async function reservarTentativa({ userId, method, cpfCnpj, idempotencyKey }) {
    const { data, error } = await supabaseAdmin
        .from('payment_attempts')
        .insert({ user_id: userId, method, cpf_cnpj: cpfCnpj, idempotency_key: idempotencyKey, status: 'PROCESSING' })
        .select('id, payment_id, invoice_url, status')
        .single();

    if (!error) return { attempt: data, existing: false };

    const { data: existing, error: lookupError } = await supabaseAdmin
        .from('payment_attempts')
        .select('id, payment_id, invoice_url, status')
        .eq('user_id', userId)
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

    if (lookupError || !existing) throw error;
    if (existing.status === 'FAILED' && !existing.payment_id) {
        const { data: retried, error: retryError } = await supabaseAdmin
            .from('payment_attempts')
            .update({ status: 'PROCESSING', updated_at: new Date().toISOString() })
            .eq('id', existing.id)
            .select('id, payment_id, invoice_url, status')
            .single();
        if (retryError) throw retryError;
        return { attempt: retried, existing: false };
    }
    return { attempt: existing, existing: true };
}

export async function atualizarTentativa(id, values) {
    const { error } = await supabaseAdmin.from('payment_attempts').update({ ...values, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
}

export async function buscarClienteAsaas({ cpfCnpj, userId, userEmail, name }) {
    const searchRes = await fetch(`${ASAAS_BASE_URL}/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}`, {
        headers: { 'access_token': process.env.ASAAS_API_KEY }
    });
    const searchData = await searchRes.json();
    if (!searchRes.ok) throw new Error(searchData.errors?.[0]?.description || 'Erro ao consultar cliente no Asaas.');

    const ownedCustomer = searchData.data?.find(customer => customer.externalReference === userId);
    if (ownedCustomer) return ownedCustomer.id;

    const createRes = await fetch(`${ASAAS_BASE_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'access_token': process.env.ASAAS_API_KEY },
        body: JSON.stringify({ name: name.trim(), cpfCnpj, email: userEmail, externalReference: userId })
    });
    const createdCustomer = await createRes.json();
    if (!createRes.ok) {
        const retrySearchRes = await fetch(`${ASAAS_BASE_URL}/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}`, {
            headers: { 'access_token': process.env.ASAAS_API_KEY }
        });
        const retrySearchData = await retrySearchRes.json();
        const retryCustomer = retrySearchData.data?.find(customer => customer.externalReference === userId);
        if (retrySearchRes.ok && retryCustomer) return retryCustomer.id;
        throw new Error(createdCustomer.errors?.[0]?.description || 'Erro ao criar cliente no Asaas.');
    }
    return createdCustomer.id;
}