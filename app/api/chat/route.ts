import { NextRequest } from 'next/server';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { getDeepSeekClient } from '@/lib/deepseek';
import { createClient } from '@/lib/supabase/server';
import { enforceRateLimit } from '@/lib/server/rate-limit';

const systemMessage: ChatCompletionMessageParam = {
  role: 'system',
  content: 'Você é o assistente técnico do CapacitorManager. Responda em português, com concisão. Não invente medições, normas, preços ou conclusões. Oriente que projetos elétricos e laudos precisam de validação por profissional habilitado. Nunca solicite senhas, chaves ou dados pessoais desnecessários.',
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: 'Não autorizado' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('role, subscription_status').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'platform_admin' && profile?.subscription_status !== 'active') {
      return Response.json({ error: 'Recurso disponível para assinaturas ativas' }, { status: 403 });
    }
    const allowed = await enforceRateLimit({ endpoint: 'chat', request, userId: user.id, maxRequests: 30, windowSeconds: 3600 });
    if (!allowed) return Response.json({ error: 'Limite temporário atingido' }, { status: 429 });
    if (Number(request.headers.get('content-length') || 0) > 15_000) return Response.json({ error: 'Requisição muito grande' }, { status: 413 });

    const body = await request.json();
    if (!Array.isArray(body.messages)) return Response.json({ error: 'Mensagens inválidas' }, { status: 400 });
    const messages: ChatCompletionMessageParam[] = body.messages.slice(-8).flatMap((message: unknown) => {
      if (!message || typeof message !== 'object') return [];
      const candidate = message as { role?: unknown; content?: unknown };
      if ((candidate.role !== 'user' && candidate.role !== 'assistant') || typeof candidate.content !== 'string') return [];
      const content = candidate.content.trim().slice(0, 1_000);
      return content ? [{ role: candidate.role, content } as ChatCompletionMessageParam] : [];
    });
    if (!messages.length || messages[messages.length - 1].role !== 'user') return Response.json({ error: 'Mensagem inválida' }, { status: 400 });

    const stream = await getDeepSeekClient().chat.completions.create({
      model: 'deepseek-chat',
      messages: [systemMessage, ...messages],
      temperature: 0.2,
      max_tokens: 450,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) controller.enqueue(encoder.encode(content));
          }
          controller.close();
        } catch (error) {
          console.error('[Chat] Falha durante resposta:', error);
          controller.error(error);
        }
      },
    });

    return new Response(readable, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[Chat] Falha:', error);
    return Response.json({ error: 'Assistente temporariamente indisponível' }, { status: 503 });
  }
}
