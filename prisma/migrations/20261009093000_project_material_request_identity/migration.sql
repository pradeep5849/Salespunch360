ALTER TABLE "project_material_movements" ADD COLUMN "requestHash" VARCHAR(64);
-- Legacy rows keep NULL; service compares their recorded business fields without rewriting history.
