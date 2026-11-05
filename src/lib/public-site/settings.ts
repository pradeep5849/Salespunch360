import { cache } from 'react';
import { db } from '@/lib/db';

// Dedupe within a render only: admin updates still take effect on the next request.
export const publicSiteSettings = cache(() => db.publicSiteSettings.findUnique({where:{id:'default'}}));
