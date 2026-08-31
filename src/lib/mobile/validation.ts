import {z} from 'zod';
import {attendanceLocationSchema,coordinateSchema} from '@/lib/attendance/validation';
export const mobileLoginSchema=z.object({identifier:z.string().trim().min(3).max(254),password:z.string().min(8).max(128)}).strict();
export const mobileAttendanceSchema=z.object({action:z.enum(['START','END']),location:attendanceLocationSchema.optional()}).strict();
export const mobilePointSchema=coordinateSchema.extend({clientPointId:z.string().uuid(),capturedAt:z.string().datetime({offset:true}).transform(v=>new Date(v))}).strict();
