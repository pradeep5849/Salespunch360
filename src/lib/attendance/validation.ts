import { z } from "zod";
import { LOCATION_CONFIG } from "@/lib/location/config";

export const coordinateSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracyMeters: z.number().finite().min(0).max(LOCATION_CONFIG.maximumAccuracyMeters).optional(),
}).strict();

export const attendanceMeasurementSchema = z.object({ location: coordinateSchema.optional() }).strict();

export const locationPointSchema = coordinateSchema.extend({
  capturedAt: z.string().datetime({ offset: true }).transform((value) => new Date(value)),
}).strict();

export const companyOperationsSchema = z.object({
  attendanceEnabled: z.boolean(),
  gpsTrackingEnabled: z.boolean(),
}).strict();
