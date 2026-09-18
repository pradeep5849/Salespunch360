CREATE TABLE "public_testimonials" (
  "id" UUID NOT NULL,
  "customerName" VARCHAR(160) NOT NULL,
  "customerRole" VARCHAR(200),
  "companyName" VARCHAR(200),
  "quote" TEXT NOT NULL,
  "rating" INTEGER NOT NULL DEFAULT 5,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "public_testimonials_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "public_testimonials_isPublished_displayOrder_idx" ON "public_testimonials"("isPublished", "displayOrder");
