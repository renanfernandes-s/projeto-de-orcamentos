import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


// --- Função: Enviar e-mail de recuperação ---
export async function solicitarRecuperacaoSenha(email) {
    if (!email) {
        alert("Por favor, digite seu e-mail.");
        return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/#reset-password`,
    });

    if (error) {
        alert(`Erro ao enviar e-mail: ${error.message}`);
    } else {
        alert("E-mail de redefinição enviado! Verifique sua caixa de entrada.");
    }
}

// --- Função: Atualizar para a nova senha ---
export async function atualizarSenha(novaSenha) {
    const { error } = await supabase.auth.updateUser({
        password: novaSenha
    });

    if (error) {
        alert(`Erro ao atualizar senha: ${error.message}`);
    } else {
        alert("Senha atualizada com sucesso! Você já pode navegar normalmente.");
    }
}