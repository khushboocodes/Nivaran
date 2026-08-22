-- CreateTable
CREATE TABLE "attachment_blobs" (
    "object_key" TEXT NOT NULL,
    "complaint_id" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachment_blobs_pkey" PRIMARY KEY ("object_key")
);

-- CreateIndex
CREATE INDEX "attachment_blobs_complaint_id_idx" ON "attachment_blobs"("complaint_id");

-- AddForeignKey
ALTER TABLE "attachment_blobs" ADD CONSTRAINT "attachment_blobs_complaint_id_fkey" FOREIGN KEY ("complaint_id") REFERENCES "complaints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
