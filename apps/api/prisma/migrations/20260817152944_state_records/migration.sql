-- CreateTable
CREATE TABLE "state_records" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "collection" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "state_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "state_records_projectId_collection_idx" ON "state_records"("projectId", "collection");

-- AddForeignKey
ALTER TABLE "state_records" ADD CONSTRAINT "state_records_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
