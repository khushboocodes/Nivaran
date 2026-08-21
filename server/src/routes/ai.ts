import { Hono } from 'hono';
import { z } from 'zod';
import { getUser } from '../auth/middleware';
import { aiService, chatStream } from '../services/ai';
import { transcribeComplaintAudio, MAX_AUDIO_BYTES } from '../services/ai/voice';

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

/**
 * Voice complaint intake.
 *
 *   POST /api/ai/voice  { audioBase64, mimeType }
 *
 * One Gemini call transcribes the audio in the language spoken, identifies that
 * language, translates to English, and classifies the complaint. The
 * original-language transcript comes back alongside the translation so the
 * citizen's own words stay in the record and an officer can check the
 * translation rather than trust it.
 *
 * Base64 in a JSON body rather than multipart: the payload is small, it needs no
 * extra parsing dependency, and the browser already holds the recording as a
 * Blob.
 */
const VoiceBody = z.object({
  // Roughly 4/3 of the raw byte cap, since base64 inflates by a third.
  audioBase64: z.string().min(32).max(Math.ceil((MAX_AUDIO_BYTES * 4) / 3) + 1024),
  mimeType: z.string().min(3).max(100),
});

ai.post('/voice', async (c) => {
  const user = getUser(c);
  if (!user) return c.json({ code: 'unauthenticated' }, 401);

  const body = await c.req.json().catch(() => null);
  const parsed = VoiceBody.safeParse(body);
  if (!parsed.success) {
    return c.json({ code: 'invalid_input', details: parsed.error.flatten() }, 400);
  }

  // Reject oversized audio explicitly rather than letting Gemini return an
  // opaque error about total request size.
  const approxBytes = Math.floor((parsed.data.audioBase64.length * 3) / 4);
  if (approxBytes > MAX_AUDIO_BYTES) {
    return c.json(
      {
        code: 'payload_too_large',
        message: `Recording is about ${(approxBytes / 1024 / 1024).toFixed(1)} MB; the limit is ${MAX_AUDIO_BYTES / 1024 / 1024} MB. Please record a shorter clip.`,
      },
      413,
    );
  }

  const outcome = await transcribeComplaintAudio({
    base64: parsed.data.audioBase64,
    mimeType: parsed.data.mimeType,
  });

  if (outcome.failed || !outcome.result) {
    // 502: the request was fine, the upstream model could not complete it. The
    // client falls back to manual entry rather than losing the submission.
    return c.json(
      {
        code: 'transcription_failed',
        message: 'Could not transcribe the recording. Please type the complaint instead.',
        detail: outcome.error,
        formatWarning: outcome.formatWarning,
      },
      502,
    );
  }

  return c.json({ ...outcome.result, modelName: outcome.modelName, formatWarning: outcome.formatWarning });
});

export default ai;
