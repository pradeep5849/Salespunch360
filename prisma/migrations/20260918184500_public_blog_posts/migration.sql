CREATE TABLE "public_blog_posts" (
"id" UUID NOT NULL,
"title" VARCHAR(240) NOT NULL,
"slug" VARCHAR(240) NOT NULL,
"summary" VARCHAR(600) NOT NULL,
"content" TEXT NOT NULL,
"featuredImage" VARCHAR(500),
"seoTitle" VARCHAR(240),
"seoDescription" VARCHAR(320),
"isPublished" BOOLEAN NOT NULL DEFAULT false,
"publishedAt" TIMESTAMP(3),
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
"updatedAt" TIMESTAMP(3) NOT NULL,
CONSTRAINT "public_blog_posts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "public_blog_posts_slug_key" ON "public_blog_posts"("slug");
CREATE INDEX "public_blog_posts_isPublished_publishedAt_idx" ON "public_blog_posts"("isPublished","publishedAt");
