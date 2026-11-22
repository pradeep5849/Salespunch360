import {it,expect} from 'vitest';
import {Prisma} from '@prisma/client';
import {leadCurrencyValues} from './lead-currency-values';
it('retains separate Decimal pipeline and won totals for each currency',()=>{expect(leadCurrencyValues([{stage:'NEW',currencyCode:'INR',estimatedValue:new Prisma.Decimal('10.10')},{stage:'QUALIFIED',currencyCode:'INR',estimatedValue:new Prisma.Decimal('0.20')},{stage:'WON',currencyCode:'USD',estimatedValue:new Prisma.Decimal('20.25')},{stage:'LOST',currencyCode:'USD',estimatedValue:new Prisma.Decimal('999')}])).toEqual({pipelineValue:'INR 10.30 · USD 0.00',wonValue:'INR 0.00 · USD 20.25'})});
it('does not invent INR for missing currency or empty reports',()=>{expect(leadCurrencyValues([{stage:'NEW',currencyCode:'',estimatedValue:new Prisma.Decimal(1)}]).pipelineValue).toBe('UNSPECIFIED 1.00');expect(leadCurrencyValues([])).toEqual({pipelineValue:'—',wonValue:'—'})});
