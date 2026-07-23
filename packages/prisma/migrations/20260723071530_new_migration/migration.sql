-- AlterTable
ALTER TABLE "OrganisationGlobalSettings" ADD COLUMN     "brandingName" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "TeamGlobalSettings" ADD COLUMN     "brandingName" TEXT;
