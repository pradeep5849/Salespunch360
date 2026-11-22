import {it,expect} from 'vitest';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {AddTeamCalculator} from '@/app/workspace/billing/billing-calculator';
it('retains supported paise in actual rendered full-period labels',()=>{const html=renderToStaticMarkup(createElement(AddTeamCalculator,{managersEnabled:false,adminLimit:0,managerLimit:0,salesLimit:1,period:'SIX_MONTH',prices:{SIX_MONTH:{admin:250,manager:200,sales:800.50},YEARLY:{admin:500,manager:400,sales:1601}}}));expect(html).toContain('800.50')});
