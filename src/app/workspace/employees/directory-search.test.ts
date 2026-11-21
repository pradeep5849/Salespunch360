import {it,expect} from 'vitest';
import {filterDirectoryUsers,employeeSearchHref} from './directory-search';
const users=[{name:'Alice',email:'a@example.test',phone:'9999999999'},{name:'Bob',email:'b@example.test',phone:null}];
it.each(['alice','A@EXAMPLE','999999'])('finds authorized directory rows by %s',query=>expect(filterDirectoryUsers(users,query)).toEqual([users[0]]));
it('does not create or widen the supplied authorized collection',()=>expect(filterDirectoryUsers(users,'Other company')).toEqual([]));
it('preserves role filter and encoded search across directory links',()=>expect(employeeSearchHref('/workspace/employees?filter=inactive','Alice & Bob')).toBe('/workspace/employees?filter=inactive&q=Alice+%26+Bob'));
