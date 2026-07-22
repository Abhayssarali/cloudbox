-- AlterTable: Add ownerId and inviteCode to groups
ALTER TABLE "groups" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "groups" ADD COLUMN "inviteCode" TEXT;

-- Generate a unique inviteCode for all existing groups (update before NOT NULL constraint)
UPDATE "groups" SET "inviteCode" = gen_random_uuid()::text WHERE "inviteCode" IS NULL;
UPDATE "groups" SET "ownerId" = (SELECT id FROM "users" WHERE role = 'SUPER_ADMIN' OR role = 'ADMIN' LIMIT 1) WHERE "ownerId" IS NULL;

-- Now apply constraints
ALTER TABLE "groups" ALTER COLUMN "ownerId" SET NOT NULL;
ALTER TABLE "groups" ALTER COLUMN "inviteCode" SET NOT NULL;
ALTER TABLE "groups" ADD CONSTRAINT "groups_inviteCode_key" UNIQUE ("inviteCode");

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
