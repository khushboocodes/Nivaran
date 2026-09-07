/**
 * Telegram intake — the messaging-app channel.
 * Mounted at `/api/telegram`.
 *
 *   POST /api/telegram/webhook   receives Telegram updates
 *
 * WHY TELEGRAM
 * ------------
 * Problem statement 01 names "messaging apps" as an intake channel alongside
 * voice and text. WhatsApp's Business API needs Meta review and a verified
 * number, which is a procurement exercise rather than an engineering one.
 * Telegram is a real messaging app with an open bot API, so it demonstrates the
 * channel now. Both sit behind the same `createComplaintFromIntake` adapter, so
 * adding WhatsApp later is an adapter, not a rewrite.
 *
 * WHY IT ACCEPTS VOICE NOTES
 * --------------------------
 * The single most common way a low-literacy citizen sends a message is a voice
 * note. Telegram delivers those as OGG/Opus, which Gemini accepts directly, so
 * the existing voice pipeline — transcribe, detect language, translate, classify
 * in one call — works on them with no conversion. A citizen can speak Marathi
 * into a chat they already use and a classified, district-mapped complaint comes
 * out the other end.
 *
 * AUTHENTICATION
 * --------------
 * Telegram signs nothing. The documented mechanism is a `secret_token` supplied
 * at setWebhook time and echoed back in a header on every update, which is what
 * this verifies. Without `TELEGRAM_WEBHOOK_SECRET` set the route refuses to
 * process anything, because an unauthenticated public endpoint that creates
 * database rows on demand is worse than a missing feature.
 */

import { Hono } from 'hono';
import { timingSafeEqual } from 'node:crypto';
import { prisma } from '../db';
import { createComplaintFromIntake } from '../services/intake';
import { aiService } from '../services/ai';
import { transcribeComplaintAudio, MAX_AUDIO_BYTES } from '../services/ai/voice';

const telegram = new Hono();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET ?? '';

/** Telegram caps messages at 4096 characters; complaints are far shorter. */
const MAX_TEXT = 2_000;
/** Voice notes longer than this are rejected before reaching the model. */
const MAX_VOICE_SECONDS = 120;

/* ------------------------------------------------------------------ *
 * Telegram update shapes — only the fields we use
 * ------------------------------------------------------------------ */

interface TgChat {
  id: number;
}
interface TgFrom {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}
interface TgVoice {
  file_id: string;
  duration: number;
  mime_type?: string;
}
interface TgMessage {
  message_id: number;
  chat: TgChat;
  from?: TgFrom;
  text?: string;
  caption?: string;
  voice?: TgVoice;
  location?: { latitude: number; longitude: number };
}
interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  edited_message?: TgMessage;
}

/* ------------------------------------------------------------------ *
 * Telegram Bot API helpers
 * ------------------------------------------------------------------ */

async function tg<T>(method: string, body: unknown): Promise<T | null> {
  if (!BOT_TOKEN) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { ok: boolean; result?: T };
    return json.ok ? (json.result ?? null) : null;
  } catch {
    return null;
  }
}

/** Replies are best-effort: a delivery failure must not fail the intake. */
async function reply(chatId: number, text: string): Promise<void> {
  await tg('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML' });
}

/** Fetch a voice note's bytes via getFile + the file download endpoint. */
async function downloadVoice(fileId: string): Promise<Buffer | null> {
  const meta = await tg<{ file_path?: string }>('getFile', { file_id: fileId });
  if (!meta?.file_path || !BOT_TOKEN) return null;
  try {
    const res = await fetch(
      `https://api.telegram.org/file/bot${BOT_TOKEN}/${meta.file_path}`,
      { signal: AbortSignal.timeout(30_000) },
    );
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Citizen provisioning
 * ------------------------------------------------------------------ */

/**
 * Map a Telegram sender to a Nivaran citizen, creating one on first contact.
 *
 * A messaging-app citizen has no password and never signs in through the web,
 * so the account carries an unusable credential rather than a guessable one.
 * The address uses the reserved `.invalid` TLD (RFC 2606) so it can never
 * collide with, or accidentally send mail to, a real inbox.
 */
async function resolveCitizen(from: TgFrom, chatId: number) {
  const chatKey = String(chatId);
  const existing = await prisma.user.findUnique({ where: { telegramChatId: chatKey } });
  if (existing) return existing;

  const name =
    [from.first_name, from.last_name].filter(Boolean).join(' ').trim() ||
    from.username ||
    `Telegram ${chatId}`;

  return prisma.user.create({
    data: {
      email: `telegram-${chatId}@telegram.nivaran.invalid`,
      name,
      role: 'citizen',
      // Not a hash of anything. There is no password to verify, and
      // `verifyPassword` will reject this string, so the account cannot be
      // signed into through the web at all.
      passwordHash: 'telegram-no-password',
      language: (from.language_code ?? 'en').slice(0, 5),
      telegramChatId: chatKey,
    },
  });
}

/* ------------------------------------------------------------------ *
 * Webhook
 * ------------------------------------------------------------------ */

const HELP = [
  '<b>Nivaran</b> — civic complaint intake',
  '',
  'Send a message describing the problem, and include the area name so it can be',
  'mapped to your district. For example:',
  '',
  '<i>No water supply in our lane for three days. Kondhwa, Pune.</i>',
  '',
  'You can also send a <b>voice note</b> in any Indian language.',
].join('\n');

telegram.post('/webhook', async (c) => {
  // Refuse to run at all when unconfigured, rather than accepting anonymous
  // writes. Returning 200 keeps Telegram from retrying forever.
  if (!WEBHOOK_SECRET) {
    // eslint-disable-next-line no-console
    console.warn('[telegram] webhook hit but TELEGRAM_WEBHOOK_SECRET is not set — ignoring');
    return c.json({ ok: true, ignored: 'not_configured' });
  }

  const provided = c.req.header('X-Telegram-Bot-Api-Secret-Token') ?? '';
  const a = Buffer.from(provided);
  const b = Buffer.from(WEBHOOK_SECRET);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return c.json({ code: 'forbidden' }, 403);
  }

  const update = (await c.req.json().catch(() => null)) as TgUpdate | null;
  const msg = update?.message ?? update?.edited_message;
  if (!msg?.from) {
    // Not something we handle (channel post, join event). Acknowledge so
    // Telegram does not redeliver it.
    return c.json({ ok: true, ignored: 'unsupported_update' });
  }

  const chatId = msg.chat.id;
  const text = (msg.text ?? msg.caption ?? '').trim();

  if (text === '/start' || text === '/help') {
    await reply(chatId, HELP);
    return c.json({ ok: true });
  }

  const citizen = await resolveCitizen(msg.from, chatId);

  try {
    if (msg.voice) {
      if (msg.voice.duration > MAX_VOICE_SECONDS) {
        await reply(chatId, `That voice note is too long. Please keep it under ${MAX_VOICE_SECONDS} seconds.`);
        return c.json({ ok: true });
      }
      const bytes = await downloadVoice(msg.voice.file_id);
      if (!bytes) {
        await reply(chatId, 'Could not download that voice note. Please try again, or type the complaint.');
        return c.json({ ok: true });
      }

      if (bytes.byteLength > MAX_AUDIO_BYTES) {
        await reply(chatId, 'That voice note is too large. Please send a shorter clip.');
        return c.json({ ok: true });
      }

      // OGG/Opus goes straight to Gemini — it is one of the documented audio
      // formats, so no transcoding step is needed here. This is the same
      // pipeline the web recorder uses, reached from a different front door.
      const outcome = await transcribeComplaintAudio({
        base64: bytes.toString('base64'),
        mimeType: msg.voice.mime_type ?? 'audio/ogg',
      });

      const voice = outcome.result;
      if (outcome.failed || !voice) {
        await reply(chatId, 'Could not process that voice note just now. Please try again, or type the complaint.');
        return c.json({ ok: true });
      }
      if (!voice.speechDetected) {
        await reply(chatId, 'No clear speech was found in that recording. Please try again somewhere quieter, or type the complaint.');
        return c.json({ ok: true });
      }

      const created = await createComplaintFromIntake({
        citizenId: citizen.id,
        channel: 'telegram',
        title: voice.title,
        description: voice.description,
        category: voice.category,
        language: voice.detectedLanguage || citizen.language,
        priority: voice.priority,
        sentiment: voice.sentiment,
        aiConfidence: voice.confidence,
        sourceTranscript: voice.transcript,
        sourceLanguage: voice.detectedLanguage,
      });

      await reply(
        chatId,
        [
          '✅ Complaint registered from your voice note.',
          '',
          `<b>${created.title}</b>`,
          `Category: ${created.category}`,
          `Priority: ${created.priority}`,
          `Reference: <code>${created.id}</code>`,
          '',
          voice.detectedLanguage && voice.detectedLanguage !== 'en'
            ? `Heard in: ${voice.detectedLanguage}. Your original words are kept on the record.`
            : '',
        ]
          .filter(Boolean)
          .join('\n'),
      );
      return c.json({ ok: true });
    }

    if (!text) {
      await reply(chatId, HELP);
      return c.json({ ok: true });
    }
    if (text.length > MAX_TEXT) {
      await reply(chatId, 'That message is too long. Please describe the problem in a few sentences.');
      return c.json({ ok: true });
    }

    // Same classifier the web form uses, so a Telegram complaint is routed and
    // prioritised on identical terms.
    const ai = await aiService.classify({ title: text.slice(0, 90), description: text });

    const created = await createComplaintFromIntake({
      citizenId: citizen.id,
      channel: 'telegram',
      title: text.slice(0, 90),
      description: text,
      category: ai.category,
      language: citizen.language,
      // Telegram messages carry no address field, so the district is inferred
      // from whatever place name the citizen wrote. `resolveDistrict` returns
      // null rather than guessing, which is why the help text asks for an area.
      location: text,
      ...(msg.location ? { lat: msg.location.latitude, lng: msg.location.longitude } : {}),
      priority: ai.priority,
      sentiment: ai.sentiment,
      aiConfidence: ai.confidence,
      aiSummary: ai.summary,
    });

    await reply(
      chatId,
      [
        '✅ Complaint registered.',
        '',
        `<b>${created.title}</b>`,
        `Category: ${created.category}`,
        `Priority: ${created.priority}`,
        `Reference: <code>${created.id}</code>`,
      ].join('\n'),
    );
    return c.json({ ok: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[telegram] intake failed:', err instanceof Error ? err.message : err);
    await reply(chatId, 'Something went wrong registering that complaint. Please try again shortly.');
    // 200 on purpose: Telegram retries non-2xx, and a retry would hit the same
    // failure while duplicating any partial work.
    return c.json({ ok: false }, 200);
  }
});

export default telegram;
