import './style.css';
import { supabase } from './supabase.js';

const form = document.getElementById('auth-form');
const emailInput = document.getElementById('auth-email');
const passwordInput = document.getElementById('auth-password');
const btnLogin = document.getElementById('btn-login');
const btnSignup = document.getElementById('btn-signup');

// Redireciona caso já esteja logado
async function verificarSessao() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        window.location.href = '/';
    }
}

// Ação de Login
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btnLogin.disabled = true;
    btnLogin.textContent = "Entrando...";

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        alert("Erro ao fazer login: " + error.message);
        btnLogin.disabled = false;
        btnLogin.textContent = "Entrar";
    } else {
        window.location.href = '/';
    }
});

// Ação de Criar Conta
btnSignup.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        alert("Preencha o e-mail e a senha para criar uma conta.");
        return;
    }

    btnSignup.disabled = true;
    btnSignup.textContent = "Criando conta...";

    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
        alert("Erro ao criar conta: " + error.message);
    } else {
        alert("Conta criada com sucesso! Faça login para continuar.");
    }

    btnSignup.disabled = false;
    btnSignup.textContent = "Criar Nova Conta";
});

verificarSessao();