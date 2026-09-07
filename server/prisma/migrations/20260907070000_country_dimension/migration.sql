-- Country tier above state/province, and per-country scoping of the codes that
-- previously blocked loading a second nation.
--
-- Written by hand rather than generated so the backfill runs in the same
-- transaction as the constraint changes. Existing rows are all India, and the
-- NOT NULL is applied only after they are populated — a generated migration
-- would have added a NOT NULL column to 640 districts and failed.

-- CreateTable
CREATE TABLE "countries" (
    "id" TEXT NOT NULL,
    "iso2" TEXT NOT NULL,
    "iso3" TEXT,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "countries_iso2_key" ON "countries"("iso2");
CREATE UNIQUE INDEX "countries_iso3_key" ON "countries"("iso3");

-- Seed India. Every existing state and district belongs to it.
INSERT INTO "countries" ("id", "iso2", "iso3", "name", "currency")
VALUES ('country_in_seed_0000000001', 'IN', 'IND', 'India', 'INR');

-- AlterTable: states gain a country, backfilled before being made mandatory.
ALTER TABLE "states" ADD COLUMN "country_id" TEXT;
UPDATE "states" SET "country_id" = 'country_in_seed_0000000001';
ALTER TABLE "states" ALTER COLUMN "country_id" SET NOT NULL;

-- AlterTable: districts carry the country directly. Denormalised so the
-- composite unique below is expressible and country filters need no join.
ALTER TABLE "districts" ADD COLUMN "country_id" TEXT;
UPDATE "districts" d SET "country_id" = s."country_id"
  FROM "states" s WHERE s."id" = d."state_id";
ALTER TABLE "districts" ALTER COLUMN "country_id" SET NOT NULL;

-- Replace the global unique constraints with per-country ones. These three
-- indexes were the actual obstruction to a second country: a Brazilian
-- municipality code of 1 would have collided with Indian census district 1.
DROP INDEX "states_name_key";
DROP INDEX "states_census_code_key";
DROP INDEX "districts_census_code_key";

CREATE UNIQUE INDEX "states_country_id_name_key" ON "states"("country_id", "name");
CREATE UNIQUE INDEX "states_country_id_census_code_key" ON "states"("country_id", "census_code");
CREATE UNIQUE INDEX "districts_country_id_census_code_key" ON "districts"("country_id", "census_code");
CREATE INDEX "districts_country_id_idx" ON "districts"("country_id");

-- AddForeignKey
ALTER TABLE "states" ADD CONSTRAINT "states_country_id_fkey"
  FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "districts" ADD CONSTRAINT "districts_country_id_fkey"
  FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
