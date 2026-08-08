/*
  Warnings:

  - Added the required column `projectId` to the `request_logs` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "request_logs_createdAt_idx";

-- AlterTable
ALTER TABLE "request_logs" ADD COLUMN     "projectId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "request_logs_projectId_createdAt_idx" ON "request_logs"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "request_logs" ADD CONSTRAINT "request_logs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
