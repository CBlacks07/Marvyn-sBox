-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "parentSlug" TEXT;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentSlug_fkey" FOREIGN KEY ("parentSlug") REFERENCES "Category"("slug") ON DELETE SET NULL ON UPDATE CASCADE;
