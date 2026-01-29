-- CreateEnum
CREATE TYPE "ContactCadence" AS ENUM ('BIWEEKLY', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL');

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN     "cadence" "ContactCadence",
ADD COLUMN     "contact_due_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "contacts_contact_due_at_idx" ON "contacts"("contact_due_at");
