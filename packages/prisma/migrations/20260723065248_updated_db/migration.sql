-- AlterTable
ALTER TABLE "OrganisationGlobalSettings" ADD COLUMN     "brandingHideWatermark" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TeamGlobalSettings" ADD COLUMN     "brandingHideWatermark" BOOLEAN;
