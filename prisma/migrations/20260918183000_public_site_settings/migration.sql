CREATE TABLE "public_site_settings" (
  "id" VARCHAR(32) NOT NULL DEFAULT 'default',
  "facebookUrl" VARCHAR(500),
  "instagramUrl" VARCHAR(500),
  "linkedinUrl" VARCHAR(500),
  "youtubeUrl" VARCHAR(500),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "public_site_settings_pkey" PRIMARY KEY ("id")
);
