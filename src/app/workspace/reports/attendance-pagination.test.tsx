import {expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {Pagination} from './report-ui';
it('keeps the selected employee, dates, branch and status on history navigation',()=>{
 const html=renderToStaticMarkup(<Pagination page={2} totalPages={5} query={{employeeId:'employee',start:'2026-11-01',end:'2026-11-14',status:'COMPLETED',branchId:'branch'}}/>);
 expect(html.match(/employeeId=employee/g)).toHaveLength(2);expect(html.match(/branchId=branch/g)).toHaveLength(2);expect(html.match(/status=COMPLETED/g)).toHaveLength(2);expect(html.match(/start=2026-11-01/g)).toHaveLength(2);expect(html).toContain('page=1');expect(html).toContain('page=3');
});
