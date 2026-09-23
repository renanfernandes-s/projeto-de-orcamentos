import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// --- Função: Enviar e-mail de recuperação ---
export async function solicitarRecuperacaoSenha(email, captchaToken) {
    if (!email) {
        return { error: new Error("Informe seu e-mail.") };
    }

    return supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/#reset-password`,
        captchaToken,
    });
}

// --- Função: Atualizar para a nova senha ---
export async function atualizarSenha(novaSenha) {
    return supabase.auth.updateUser({
        password: novaSenha
    });
}