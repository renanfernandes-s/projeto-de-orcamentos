import './style.css';
import { solicitarRecuperacaoSenha, supabase } from './supabase.js';

const MIN_PASSWORD_LENGTH = 10;

const form = document.getElementById('auth-form');
const emailInput = document.getElementById('auth-email');
const passwordInput = document.getElementById('auth-password');
const passwordConfirmationInput = document.getElementById('auth-password-confirmation');
const passwordConfirmationGroup = document.getElementById('password-confirmation-group');
const passwordLabel = document.getElementById('password-label');
const btnLogin = document.getElementById('btn-login');
const btnRecovery = document.getElementById('btn-recovery');
const tabLogin = document.getElementById('tab-login');
const tabSignup = document.getElementById('tab-signup');

let authMode = 'login';

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

function alternarModo(modo) {
    authMode = modo;
    const cadastroAtivo = modo === 'signup';

    tabLogin.setAttribute('aria-selected', String(!cadastroAtivo));
    tabSignup.setAttribute('aria-selected', String(cadastroAtivo));
    tabLogin.className = cadastroAtivo
        ? 'rounded-md px-3 py-2 text-xs font-bold text-slate-500 transition'
        : 'rounded-md bg-white px-3 py-2 text-xs font-bold text-indigo-950 shadow-sm transition';
    tabSignup.className = cadastroAtivo
        ? 'rounded-md bg-white px-3 py-2 text-xs font-bold text-indigo-950 shadow-sm transition'
        : 'rounded-md px-3 py-2 text-xs font-bold text-slate-500 transition';
    passwordLabel.textContent = cadastroAtivo ? 'Nova senha' : 'Senha';
    passwordInput.placeholder = cadastroAtivo ? 'Mínimo de 10 caracteres' : '••••••••';
    passwordConfirmationGroup.classList.toggle('hidden', !cadastroAtivo);
    passwordConfirmationInput.required = cadastroAtivo;
    btnLogin.textContent = cadastroAtivo ? 'Criar conta' : 'Entrar';
    btnRecovery.classList.toggle('hidden', cadastroAtivo);
}

tabLogin.addEventListener('click', () => alternarModo('login'));
tabSignup.addEventListener('click', () => alternarModo('signup'));

// Ações de login e cadastro
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const turnstileToken = obterTurnstileToken();
    if (!turnstileToken) {
        alert("Por favor, confirme que não é um robô resolvendo o desafio de segurança.");
        return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const cadastroAtivo = authMode === 'signup';

    if (cadastroAtivo && password.length < MIN_PASSWORD_LENGTH) {
        alert(`A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
        passwordInput.focus();
        return;
    }

    if (cadastroAtivo && password !== passwordConfirmationInput.value) {
        alert('As senhas não conferem.');
        passwordConfirmationInput.focus();
        return;
    }

    btnLogin.disabled = true;
    btnLogin.textContent = cadastroAtivo ? "Criando conta..." : "Entrando...";

    try {
        const response = cadastroAtivo
            ? await supabase.auth.signUp({ email, password, options: { captchaToken: turnstileToken } })
            : await supabase.auth.signInWithPassword({ email, password, options: { captchaToken: turnstileToken } });
        const { data, error } = response;

        if (error) {
            alert(cadastroAtivo
                ? "Não foi possível criar a conta. Verifique os dados e tente novamente."
                : "Não foi possível entrar. Verifique o e-mail e a senha ou tente novamente mais tarde.");
            return;
        }

        if (cadastroAtivo && data.user && data.user.identities?.length === 0) {
            alert("Este e-mail já está cadastrado. Entre na sua conta ou use \"Esqueci minha senha\".");
            alternarModo('login');
            return;
        }

        if (cadastroAtivo) {
            alert("Conta criada com sucesso! Verifique seu e-mail para confirmar o cadastro.");
            alternarModo('login');
            passwordInput.value = '';
            passwordConfirmationInput.value = '';
            return;
        }

        window.location.href = '/';
    } catch {
        alert("Não foi possível concluir o login. Tente novamente mais tarde.");
    } finally {
        resetarTurnstile();
        btnLogin.disabled = false;
        btnLogin.textContent = authMode === 'signup' ? "Criar conta" : "Entrar";
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