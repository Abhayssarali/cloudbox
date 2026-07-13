-- AlterTable: Add allocation columns to agents
ALTER TABLE "agents" ADD COLUMN "allocatedUserId" TEXT;
ALTER TABLE "agents" ADD COLUMN "allocatedGroupId" TEXT;

-- AddForeignKey: allocated user
ALTER TABLE "agents" ADD CONSTRAINT "agents_allocatedUserId_fkey" FOREIGN KEY ("allocatedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: allocated group
ALTER TABLE "agents" ADD CONSTRAINT "agents_allocatedGroupId_fkey" FOREIGN KEY ("allocatedGroupId") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
