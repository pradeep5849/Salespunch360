import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeNetwork } from './inspect-lighthouse-network.mjs';

test('distinguishes a document response from a missing favicon and limits printed headers',()=>{
  const summary=summarizeNetwork([
    {method:'Network.requestWillBeSent',params:{requestId:'1',type:'Document',request:{url:'https://www.salespunch360.com/',method:'GET',headers:{'User-Agent':'test-browser',Cookie:'private-cookie'}}}},
    {method:'Network.responseReceived',params:{requestId:'1',type:'Document',response:{url:'https://www.salespunch360.com/',status:403,fromServiceWorker:false,headers:{Server:'edge','X-Hcdn-Request-Id':'diagnostic-id','Set-Cookie':'private-cookie'}}}},
    {method:'Network.responseReceived',params:{requestId:'2',type:'Other',response:{url:'https://www.salespunch360.com/favicon.ico',status:404}}},
  ]);
  assert.equal(summary.documents.length,1);assert.equal(summary.documents[0].status,403);
  assert.equal(summary.httpErrors.length,2);assert.equal(summary.documents[0].headers['X-Hcdn-Request-Id'],'diagnostic-id');
  assert(!JSON.stringify(summary).includes('private-cookie'));
});
test('records service-worker responses and client-side loading failures separately',()=>{
  const summary=summarizeNetwork([
    {method:'Network.responseReceived',params:{type:'Document',response:{url:'https://www.salespunch360.com/',status:200,fromServiceWorker:true}}},
    {method:'Network.loadingFailed',params:{type:'Document',errorText:'net::ERR_BLOCKED_BY_CLIENT',blockedReason:'inspector'}},
  ]);
  assert.equal(summary.documents[0].fromServiceWorker,true);assert.equal(summary.httpErrors.length,0);
  assert.equal(summary.loadingFailures[0].error,'net::ERR_BLOCKED_BY_CLIENT');
});
