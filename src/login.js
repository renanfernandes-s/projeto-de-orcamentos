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
const authFeedback = document.getElementById('auth-feedback');
const authFeedbackTitle = document.getElementById('auth-feedback-title');
const authFeedbackMessage = document.getElementById('auth-feedback-message');
const authFeedbackEmail = document.getElementById('auth-feedback-email');
const btnResendEmail = document.getElementById('btn-resend-email');
const btnBackAuth = document.getElementById('btn-back-auth');

let authMode = 'login';
let feedbackMode = null;
let feedbackEmail = '';
let resendTimer = null;

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

function mascararEmail(email) {
    const [usuario, dominio] = email.split('@');
    if (!usuario || !dominio) return email;
    const prefixo = usuario.slice(0, Math.min(2, usuario.length));
    return `${prefixo}${'*'.repeat(Math.max(2, usuario.length - prefixo.length))}@${dominio}`;
}

function mostrarFeedbackEmail(modo, email) {
    feedbackMode = modo;
    feedbackEmail = email;
    authFeedbackTitle.textContent = modo === 'signup'
        ? 'Confirme seu cadastro por e-mail'
        : 'Confira seu e-mail para redefinir a senha';
    authFeedbackMessage.textContent = modo === 'signup'
        ? 'Enviamos um link de confirmação. Verifique também as pastas Spam, Lixo eletrônico e Promoções.'
        : 'Enviamos um link de recuperação. Verifique também as pastas Spam, Lixo eletrônico e Promoções.';
    authFeedbackEmail.textContent = mascararEmail(email);
    authFeedback.classList.remove('hidden');
}

function ocultarFeedbackEmail() {
    authFeedback.classList.add('hidden');
    feedbackMode = null;
    if (resendTimer) clearInterval(resendTimer);
    btnResendEmail.disabled = false;
    btnResendEmail.textContent = 'Reenviar e-mail';
}

function iniciarContagemReenvio() {
    let segundos = 60;
    btnResendEmail.disabled = true;
    btnResendEmail.textContent = `Reenviar em ${segundos}s`;
    resendTimer = setInterval(() => {
        segundos -= 1;
        if (segundos <= 0) {
            clearInterval(resendTimer);
            resendTimer = null;
            btnResendEmail.disabled = false;
            btnResendEmail.textContent = 'Reenviar e-mail';
            return;
        }
        btnResendEmail.textContent = `Reenviar em ${segundos}s`;
    }, 1000);
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
            mostrarFeedbackEmail('signup', email);
            passwordInput.value = '';
            passwordConfirmationInput.value = '';
            iniciarContagemReenvio();
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
            alert("Não foi possível solicitar a recuperação. Tente novamente mais tarde.");
            return;
        }

        mostrarFeedbackEmail('recovery', email);
        iniciarContagemReenvio();
    } catch {
        alert("Não foi possível solicitar a recuperação. Tente novamente mais tarde.");
    } finally {
        resetarTurnstile();
        btnRecovery.disabled = false;
        btnRecovery.textContent = "Esqueci minha senha";
    }
});

btnResendEmail.addEventListener('click', async () => {
    const turnstileToken = obterTurnstileToken();
    if (!turnstileToken) {
        alert('Confirme o desafio de segurança antes de reenviar o e-mail.');
        return;
    }

    btnResendEmail.disabled = true;
    btnResendEmail.textContent = 'Enviando...';

    try {
        const response = feedbackMode === 'signup'
            ? await supabase.auth.resend({
                type: 'signup',
                email: feedbackEmail,
                options: { captchaToken: turnstileToken },
            })
            : await solicitarRecuperacaoSenha(feedbackEmail, turnstileToken);

        if (response.error) {
            alert('Não foi possível reenviar agora. Aguarde um pouco e tente novamente.');
            btnResendEmail.disabled = false;
            btnResendEmail.textContent = 'Reenviar e-mail';
            return;
        }

        iniciarContagemReenvio();
    } catch {
        alert('Não foi possível reenviar agora. Tente novamente mais tarde.');
        btnResendEmail.disabled = false;
        btnResendEmail.textContent = 'Reenviar e-mail';
    } finally {
        resetarTurnstile();
    }
});

btnBackAuth.addEventListener('click', ocultarFeedbackEmail);

verificarSessao();