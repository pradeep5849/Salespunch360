import {it,expect} from 'vitest';
import {editLeadSchema} from './validation';
import {nullableLeadEditFields,suppliedLeadEditValue} from './edit-fields';
const base={leadId:'11111111-1111-4111-8111-111111111111',version:1,title:'Lead',source:'MANUAL',assignedUserId:'22222222-2222-4222-8222-222222222222'};
it('turns explicit web blanks into database null for saved optional fields',()=>{const raw={...base,customerId:'',contactName:'',phone:'',email:'',companyName:'',notes:''};expect(nullableLeadEditFields(raw,editLeadSchema.parse(raw))).toEqual({customerId:null,contactName:null,phone:null,email:null,companyName:null,notes:null})});
it('does not clear omitted optional fields',()=>{expect(nullableLeadEditFields(base,editLeadSchema.parse(base))).toEqual({customerId:undefined,contactName:undefined,phone:undefined,email:undefined,companyName:undefined,notes:undefined})});
it('preserves validated nonblank values and trims contact text',()=>{const raw={...base,phone:' 9999999999 ',notes:'Saved'};expect(nullableLeadEditFields(raw,editLeadSchema.parse(raw))).toMatchObject({phone:'9999999999',notes:'Saved'})});
it('preserves Android explicit null instead of falling back to old data',()=>{for(const key of ['phone','notes','email','estimatedValue'])expect(suppliedLeadEditValue({[key]:null},key,'old')).toBeNull()});
it('preserves old Android values only when the property is omitted',()=>expect(suppliedLeadEditValue({},'phone','old')).toBe('old'));
