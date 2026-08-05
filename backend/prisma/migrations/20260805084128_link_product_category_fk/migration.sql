-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_category_fkey" FOREIGN KEY ("category") REFERENCES "Category"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;
