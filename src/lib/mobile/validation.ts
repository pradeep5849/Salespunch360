import {z} from 'zod';
import {attendanceLocationSchema,coordinateSchema} from '@/lib/attendance/validation';
export const mobileLoginSchema=z.object({identifier:z.string().trim().min(3).max(254),password:z.string().min(8).max(128)}).strict();
export const mobilePasswordSchema=z.object({currentPassword:z.string().min(1).max(200),newPassword:z.string().min(12).max(200).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/),confirmPassword:z.string().min(1).max(200)}).strict().refine(v=>v.newPassword===v.confirmPassword,{path:['confirmPassword'],message:'Passwords do not match'});
export const mobileAttendanceSchema=z.object({action:z.enum(['START','END']),location:attendanceLocationSchema.optional(),branchId:z.string().uuid().optional()}).strict();
export const mobilePointSchema=coordinateSchema.extend({clientPointId:z.string().uuid(),capturedAt:z.string().datetime({offset:true}).transform(v=>new Date(v))}).strict();
