-- CreateEnum
CREATE TYPE "IntakeChannel" AS ENUM ('web', 'voice', 'telegram', 'whatsapp', 'sms', 'modelled');

-- AlterTable
ALTER TABLE "complaints" ADD COLUMN     "channel" "IntakeChannel" NOT NULL DEFAULT 'web';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "telegram_chat_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_chat_id_key" ON "users"("telegram_chat_id");

-- Backfill. The modelled demand corpus did not arrive through any intake
-- channel, and leaving those rows on the `web` default would misreport ~150k
-- synthetic records as citizen web submissions in any channel breakdown.
UPDATE "complaints" SET "channel" = 'modelled' WHERE "is_synthetic" = true;
