import { supabaseAdmin, autenticarUsuario } from './_payment-utils.mjs';

const DESTINO_FEEDBACK = 'useorcafacilapp@gmail.com';
const ORIGEM_FEEDBACK = 'first_free_pdf';

function normalizarComentario(value) {
    if (typeof value !== 'string') return null;
    const comentario = value.trim();
    return comentario ? comentario.slice(0, 2000) : null;
}

async function notificarPorEmail({ user, rating, comment }) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;

    if (!apiKey || !from) return 'pending_configuration';

    const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from,
            to: [DESTINO_FEEDBACK],
            reply_to: user.email,
            subject: `Novo feedback do OrçaFácilApp: ${rating}/5`,
            text: [
                `Nota: ${rating}/5`,
                `Usuário: ${user.email}`,
                '',
                'Comentário:',
                comment || '(sem comentário)',
            ].join('\n'),
        }),
    });

    if (!response.ok) {
        const details = await response.text();
        throw new Error(`Resend respondeu ${response.status}: ${details}`);
    }

    return 'sent';
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).end('Method Not Allowed');
    }

    const user = await autenticarUsuario(req, res);
    if (!user) return;

    const rating = Number(req.body?.rating);
    const comment = normalizarComentario(req.body?.comment);
    const googleRedirected = Boolean(req.body?.googleRedirected);

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'A avaliação deve estar entre 1 e 5.' });
    }

    if (rating <= 3 && (!comment || comment.length < 3)) {
        return res.status(400).json({ error: 'Conte um pouco mais para podermos analisar seu feedback.' });
    }

    const { data: existente, error: buscaError } = await supabaseAdmin
        .from('feedbacks')
        .select('id, email_status, google_redirected')
        .eq('user_id', user.id)
        .eq('source', ORIGEM_FEEDBACK)
        .maybeSingle();

    if (buscaError) {
        console.error('Erro ao consultar feedback existente:', buscaError);
        return res.status(500).json({ error: 'Não foi possível registrar sua avaliação.' });
    }

    if (existente) return res.status(200).json({ alreadySubmitted: true });

    const { data: feedback, error: insertError } = await supabaseAdmin.from('feedbacks').insert({
        user_id: user.id,
        rating,
        comment,
        source: ORIGEM_FEEDBACK,
        google_redirected: googleRedirected && rating >= 4,
        email_status: rating <= 3 ? 'pending_configuration' : 'not_requested',
    }).select('id').single();

    if (insertError) {
        if (insertError.code === '23505') return res.status(200).json({ alreadySubmitted: true });
        console.error('Erro ao salvar feedback:', insertError);
        return res.status(500).json({ error: 'Não foi possível registrar sua avaliação.' });
    }

    let emailStatus = 'not_requested';
    if (rating <= 3) {
        try {
            emailStatus = await notificarPorEmail({ user, rating, comment });
        } catch (error) {
            emailStatus = 'failed';
            console.error('Erro ao notificar feedback:', error.message);
        }

        const { error: updateError } = await supabaseAdmin
            .from('feedbacks')
            .update({ email_status: emailStatus, updated_at: new Date().toISOString() })
            .eq('id', feedback.id);
        if (updateError) console.error('Erro ao atualizar status do feedback:', updateError);
    }

    return res.status(201).json({
        emailSent: emailStatus === 'sent',
        emailConfigured: emailStatus !== 'pending_configuration',
    });
}