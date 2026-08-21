-- AlterTable
ALTER TABLE "complaints" ADD COLUMN     "district_id" TEXT,
ADD COLUMN     "is_synthetic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "source_language" TEXT,
ADD COLUMN     "source_transcript" TEXT;

-- CreateTable
CREATE TABLE "states" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "census_code" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "districts" (
    "id" TEXT NOT NULL,
    "census_code" INTEGER NOT NULL,
    "lgd_code" TEXT,
    "name" TEXT NOT NULL,
    "state_id" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "population" INTEGER,
    "households" INTEGER,
    "literate" INTEGER,
    "sc_population" INTEGER,
    "st_population" INTEGER,
    "rural_households" INTEGER,
    "urban_households" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "district_indicators" (
    "id" TEXT NOT NULL,
    "district_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pct',
    "as_of" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "district_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "investments" (
    "id" TEXT NOT NULL,
    "district_id" TEXT NOT NULL,
    "scheme" TEXT NOT NULL,
    "sanction_year" INTEGER,
    "cost_lakh" DOUBLE PRECISION NOT NULL,
    "expenditure_lakh" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "investments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendations" (
    "id" TEXT NOT NULL,
    "district_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "demand_score" DOUBLE PRECISION NOT NULL,
    "gap_score" DOUBLE PRECISION NOT NULL,
    "investment_deficit_score" DOUBLE PRECISION NOT NULL,
    "equity_score" DOUBLE PRECISION NOT NULL,
    "priority_score" DOUBLE PRECISION NOT NULL,
    "rationale" TEXT NOT NULL DEFAULT '',
    "interventions" JSONB,
    "risks" JSONB,
    "expected_beneficiaries" INTEGER,
    "model_name" TEXT NOT NULL,
    "input_digest" TEXT NOT NULL,
    "degraded" BOOLEAN NOT NULL DEFAULT false,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "states_name_key" ON "states"("name");

-- CreateIndex
CREATE UNIQUE INDEX "states_census_code_key" ON "states"("census_code");

-- CreateIndex
CREATE UNIQUE INDEX "districts_census_code_key" ON "districts"("census_code");

-- CreateIndex
CREATE UNIQUE INDEX "districts_lgd_code_key" ON "districts"("lgd_code");

-- CreateIndex
CREATE INDEX "districts_state_id_idx" ON "districts"("state_id");

-- CreateIndex
CREATE INDEX "districts_name_idx" ON "districts"("name");

-- CreateIndex
CREATE INDEX "district_indicators_metric_idx" ON "district_indicators"("metric");

-- CreateIndex
CREATE UNIQUE INDEX "district_indicators_district_id_source_metric_as_of_key" ON "district_indicators"("district_id", "source", "metric", "as_of");

-- CreateIndex
CREATE INDEX "investments_district_id_scheme_idx" ON "investments"("district_id", "scheme");

-- CreateIndex
CREATE INDEX "recommendations_district_id_idx" ON "recommendations"("district_id");

-- CreateIndex
CREATE INDEX "recommendations_category_rank_idx" ON "recommendations"("category", "rank");

-- CreateIndex
CREATE INDEX "complaints_district_id_category_idx" ON "complaints"("district_id", "category");

-- CreateIndex
CREATE INDEX "complaints_is_synthetic_idx" ON "complaints"("is_synthetic");

-- AddForeignKey
ALTER TABLE "complaints" ADD CONSTRAINT "complaints_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "districts" ADD CONSTRAINT "districts_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "district_indicators" ADD CONSTRAINT "district_indicators_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "investments" ADD CONSTRAINT "investments_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
