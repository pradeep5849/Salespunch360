import {it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {SalesRoleOptions} from './sales-role-options';
it('does not offer manager roles to Sales-only companies',()=>{const html=renderToStaticMarkup(<SalesRoleOptions managersEnabled={false} currentRole="SALES_EMPLOYEE"/>);expect(html).not.toContain('SALES_MANAGER');expect(html).not.toContain('OFFICE_MANAGER');expect(html).toContain('SALES_EMPLOYEE')});
it('preserves legacy current-role context but disables its selection',()=>expect(renderToStaticMarkup(<SalesRoleOptions managersEnabled={false} currentRole="SALES_MANAGER"/>)).toContain('value="SALES_MANAGER" disabled=""'));
it('offers both manager types for manager-enabled companies',()=>{const html=renderToStaticMarkup(<SalesRoleOptions managersEnabled currentRole="SALES_EMPLOYEE"/>);expect(html).toContain('SALES_MANAGER');expect(html).toContain('OFFICE_MANAGER')});
