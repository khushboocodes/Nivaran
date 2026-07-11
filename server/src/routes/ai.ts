import { Hono } from 'hono';
import { z } from 'zod';
import { getUser } from '../auth/middleware';
import { aiService, chatStream } from '../services/ai';

const ai = new Hono();

const ClassifyBody = z.object({
  description: z.string().min(1).max(5_000),
  language: z.string().min(2).max(10).optional(),
  // Optional title — the heuristic weights title hits 2x because they
  // are by far the strongest classification signal.
  title: z.string().max(200).optional(),
});

ai.post('/classify', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ code: 'unauthenticated' }, 401);

  const body = await c.req.json().catch(() => null);
  const parsed = ClassifyBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ code: 'invalid_input', details: parsed.error.flatten() }, 400);
  }
  const result = await aiService.classify(parsed.data);
  return c.json(result);
});

const ChatBody = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().min(1).max(10_000),
  })).min(1).max(40),
});

ai.post('/chat', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ code: 'unauthenticated' }, 401);

  const body = await c.req.json().catch(() => null);
  const parsed = ChatBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ code: 'invalid_input', details: parsed.error.flatten() }, 400);
  }

  // Stream chunks back to the browser as Server-Sent Events. The browser
  // reads with the standard ReadableStream / TextDecoder pattern (no
  // `EventSource` because we need to POST a body).
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of chatStream(parsed.data.messages)) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: chunk })}\n\n`));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (err) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  // The manually-constructed Response bypasses Hono's CORS middleware, so we
  // set the CORS headers here explicitly. Without these, the browser blocks
  // the cross-origin streamed response (Vercel frontend → Render API).
  const origin = c.req.header('Origin') ?? '';
  const allowOrigin = origin.endsWith('.vercel.app') || origin.startsWith('http://localhost')
    ? origin
    : (process.env.PUBLIC_APP_URL ?? origin);

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Credentials': 'true',
    },
  });
});

export default ai;
