-- AlterTable
ALTER TABLE "OrganisationGlobalSettings" ADD COLUMN     "recipientForceLightMode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrganisationGlobalSettings" ADD COLUMN     "useEnvelopeTitleForDownload" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "TeamGlobalSettings" ADD COLUMN     "recipientForceLightMode" BOOLEAN;
ALTER TABLE "TeamGlobalSettings" ADD COLUMN     "useEnvelopeTitleForDownload" BOOLEAN;
