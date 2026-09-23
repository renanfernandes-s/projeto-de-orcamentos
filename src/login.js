import './style.css';
import { solicitarRecuperacaoSenha, supabase } from './supabase.js';

const MIN_PASSWORD_LENGTH = 10;

const form = document.getElementById('auth-form');
const emailInput = document.getElementById('auth-email');
const passwordInput = document.getElementById('auth-password');
const btnLogin = document.getElementById('btn-login');
const btnSignup = document.getElementById('btn-signup');
const btnRecovery = document.getElementById('btn-recovery');

// Redireciona caso já esteja logado
async function verificarSessao() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        window.location.href = '/';
    }
}

// Função para obter o token do Turnstile
function obterTurnstileToken() {
    const tokenInput = document.querySelector('[name="cf-turnstile-response"]');
    return tokenInput ? tokenInput.value : '';
}

function resetarTurnstile() {
    if (window.turnstile) {
        window.turnstile.reset();
    }
}

// Ação de Login
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const turnstileToken = obterTurnstileToken();
    if (!turnstileToken) {
        alert("Por favor, confirme que não é um robô resolvendo o desafio de segurança.");
        return;
    }

    btnLogin.disabled = true;
    btnLogin.textContent = "Entrando...";

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    try {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
            options: { captchaToken: turnstileToken },
        });

        if (error) {
            alert("Não foi possível entrar. Verifique o e-mail e a senha ou tente novamente mais tarde.");
            return;
        }

        window.location.href = '/';
    } catch {
        alert("Não foi possível concluir o login. Tente novamente mais tarde.");
    } finally {
        resetarTurnstile();
        btnLogin.disabled = false;
        btnLogin.textContent = "Entrar";
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

    if (password.length < MIN_PASSWORD_LENGTH) {
        alert(`A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
        passwordInput.focus();
        return;
    }

    const turnstileToken = obterTurnstileToken();
    if (!turnstileToken) {
        alert("Por favor, confirme que não é um robô resolvendo o desafio de segurança.");
        return;
    }

    btnSignup.disabled = true;
    btnSignup.textContent = "Criando conta...";

    try {
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: { captchaToken: turnstileToken },
        });

        if (error) {
            alert("Não foi possível criar a conta. Verifique os dados e tente novamente.");
        } else {
            alert("Conta criada com sucesso! Verifique seu e-mail para confirmar o cadastro.");
        }
    } catch {
        alert("Não foi possível criar a conta. Tente novamente mais tarde.");
    } finally {
        resetarTurnstile();
        btnSignup.disabled = false;
        btnSignup.textContent = "Criar Nova Conta";
    }
});

// Ação de recuperação de senha
btnRecovery.addEventListener('click', async () => {
    const email = emailInput.value.trim();

    if (!email) {
        alert("Digite seu e-mail para receber o link de recuperação.");
        emailInput.focus();
        return;
    }

    const turnstileToken = obterTurnstileToken();
    if (!turnstileToken) {
        alert("Por favor, confirme que não é um robô resolvendo o desafio de segurança.");
        return;
    }

    btnRecovery.disabled = true;
    btnRecovery.textContent = "Enviando...";

    try {
        const { error } = await solicitarRecuperacaoSenha(email, turnstileToken);
        if (error) {
            alert("Não foi possível solicitar a recuperação. Verifique o e-mail e tente novamente mais tarde.");
            return;
        }

        alert("Se existir uma conta para este e-mail, enviaremos um link de recuperação.");
    } catch {
        alert("Não foi possível solicitar a recuperação. Tente novamente mais tarde.");
    } finally {
        resetarTurnstile();
        btnRecovery.disabled = false;
        btnRecovery.textContent = "Esqueci minha senha";
    }
});

verificarSessao();