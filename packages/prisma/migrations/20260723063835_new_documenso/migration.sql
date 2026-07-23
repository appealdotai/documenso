-- AlterTable
ALTER TABLE "OrganisationGlobalSettings" ADD COLUMN     "brandingEmail" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "TeamGlobalSettings" ADD COLUMN     "brandingEmail" TEXT;
