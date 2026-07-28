-- AlterTable
ALTER TABLE "OrganisationGlobalSettings" ADD COLUMN     "brandingEmail" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "brandingName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "brandingHideWatermark" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TeamGlobalSettings" ADD COLUMN     "brandingEmail" TEXT,
ADD COLUMN     "brandingName" TEXT,
ADD COLUMN     "brandingHideWatermark" BOOLEAN;
