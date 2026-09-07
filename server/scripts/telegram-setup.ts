/**
 * Register (or inspect) the Telegram webhook.
 *
 *   npm --prefix server run telegram:setup            # show current webhook
 *   npm --prefix server run telegram:setup -- --set   # point it at PUBLIC_API_URL
 *   npm --prefix server run telegram:setup -- --delete
 *
 * Telegram pushes updates to a URL you nominate, so the bot only works once
 * that URL is registered. The `secret_token` given here is echoed back in the
 * `X-Telegram-Bot-Api-Secret-Token` header on every update, and the webhook
 * route rejects anything whose token does not match — that header is the only
 * authentication the Bot API offers, so registration and verification have to
 * agree.
 */

const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET ?? '';
const API_BASE = process.env.PUBLIC_API_URL ?? '';

async function call(method: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function main() {
  if (!TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN is not set. Create a bot with @BotFather, then put the token in server/.env');
    process.exit(1);
  }

  const args = process.argv.slice(2);

  if (args.includes('--delete')) {
    console.log(JSON.stringify(await call('deleteWebhook', { drop_pending_updates: false }), null, 2));
    return;
  }

  if (args.includes('--set')) {
    if (!SECRET) {
      console.error('TELEGRAM_WEBHOOK_SECRET is not set. Choose any long random string and put it in server/.env — the webhook rejects updates without it.');
      process.exit(1);
    }
    if (!API_BASE) {
      console.error('PUBLIC_API_URL is not set. Telegram needs a public HTTPS URL, so this must be your deployed API origin, e.g. https://nivaran-cly5.onrender.com');
      process.exit(1);
    }
    const url = `${API_BASE.replace(/\/$/, '')}/api/telegram/webhook`;
    console.log(`registering webhook → ${url}`);
    console.log(
      JSON.stringify(
        await call('setWebhook', {
          url,
          secret_token: SECRET,
          // We only handle messages; asking for less means fewer pointless
          // deliveries to authenticate and discard.
          allowed_updates: ['message', 'edited_message'],
        }),
        null,
        2,
      ),
    );
    return;
  }

  const me = await call('getMe');
  const info = await call('getWebhookInfo');
  console.log('getMe:', JSON.stringify(me, null, 2));
  console.log('getWebhookInfo:', JSON.stringify(info, null, 2));
  console.log('\nRun with --set to register, --delete to remove.');
}

main().catch((err) => {
  console.error('[telegram:setup] failed:', err);
  process.exit(1);
});
