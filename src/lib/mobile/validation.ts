import {z} from 'zod';
import {credentialPasswordSchema} from '@/lib/auth/validation';
import {attendanceLocationSchema,coordinateSchema} from '@/lib/attendance/validation';
export const mobileLoginSchema=z.object({identifier:z.string().trim().min(3).max(254),password:credentialPasswordSchema,rememberMe:z.boolean().prefault(false),deviceId:z.string().guid(),deviceName:z.string().trim().min(1).max(160).optional()}).strict();
export const mobilePasswordSchema=z.object({currentPassword:z.string().min(1).max(200),newPassword:z.string().min(12).max(200).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/),confirmPassword:z.string().min(1).max(200)}).strict().refine(v=>v.newPassword===v.confirmPassword,{path:['confirmPassword'],message:'Passwords do not match'});
export const mobileAttendanceSchema=z.object({action:z.enum(['START','END']),location:attendanceLocationSchema.optional(),branchId:z.string().guid().optional()}).strict();
export const mobilePointSchema=coordinateSchema.extend({clientPointId:z.string().guid(),capturedAt:z.string().datetime({offset:true}).transform(v=>new Date(v))}).strict();