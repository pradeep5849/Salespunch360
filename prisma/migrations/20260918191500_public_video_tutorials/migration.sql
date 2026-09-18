CREATE TABLE "public_video_tutorials" (
"id" UUID NOT NULL,
"title" VARCHAR(240) NOT NULL,
"description" VARCHAR(800),
"videoUrl" VARCHAR(500) NOT NULL,
"thumbnailUrl" VARCHAR(500),
"product" VARCHAR(40) NOT NULL DEFAULT 'ALL',
"displayOrder" INTEGER NOT NULL DEFAULT 0,
"isPublished" BOOLEAN NOT NULL DEFAULT false,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(3) NOT NULL,
CONSTRAINT "public_video_tutorials_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "public_video_tutorials_isPublished_displayOrder_idx" ON "public_video_tutorials"("isPublished","displayOrder");
