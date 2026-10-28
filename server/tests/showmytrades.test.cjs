const {test}=require('node:test'),assert=require('node:assert/strict');
const {createProviders}=require('../providers.cjs');
const event={time:'2026-10-28T13:45:00Z',ts:1,currency:'CAD',impact:'high',title:'BoC Interest Rate Decision',forecast:'2.5%',previous:'2.25%',actual:'2.5%',status:'scheduled'};
const fixture=(events=[event])=>({from:'2026-10-28T08:58:12Z',to:'2026-10-29T14:58:12Z',generated_at:'2026-10-28T14:58:12Z',count:events.length,events});
const q=(currency='')=>new URLSearchParams({from:'2026-10-27',to:'2026-10-30',timezone:'Asia/Tokyo',currencies:currency});
test('ShowMyTrades preserves real values, uses ISO time, labels coverage and shares cache across filters',async()=>{
let calls=0;const p=createProviders({env:{TRADE_ECONOMIC_PROVIDER:'showmytrades'},fetchFn:async url=>{assert.equal(url,'https://showmytrades.com/api/public/calendar/v1');calls++;return Response.json(fixture())}});
const a=await p.economic(q('CAD'));assert.equal(a.events.length,1);assert.equal(a.events[0].time,'2026-10-28T13:45:00.000Z');assert.equal(a.events[0].actual,'2.5%');assert.equal(a.events[0].impact,'high');assert.equal(a.complete,false);assert.equal(a.coverageTo,'2026-10-29');assert.match(a.source,/ShowMyTrades/);assert.equal((await p.economic(q('USD'))).events.length,0);assert.equal(calls,1);
});
test('empty values remain missing, duplicates removed, cancellations omitted and empty covered result supported',async()=>{
const e={...event,actual:'',forecast:''};const p=createProviders({env:{TRADE_ECONOMIC_PROVIDER:'showmytrades'},fetchFn:async()=>Response.json(fixture([e,e,{...event,title:'Canceled',status:'cancelled'}]))});const a=await p.economic(q());assert.equal(a.events.length,1);assert.equal(a.events[0].actual,null);assert.equal(a.events[0].forecast,null);
const empty=createProviders({env:{TRADE_ECONOMIC_PROVIDER:'showmytrades'},fetchFn:async()=>Response.json(fixture([]))});assert.equal((await empty.economic(q())).complete,false);
});
test('invalid coverage, count, timezone-less events and out of range events rejected',async()=>{
for(const body of [{events:[]},{...fixture(),count:2},fixture([{...event,time:'2026-10-28T13:45:00'}]),fixture([{...event,time:'2025-01-01T00:00:00Z'}])]){const p=createProviders({env:{TRADE_ECONOMIC_PROVIDER:'showmytrades'},fetchFn:async()=>Response.json(body)});await assert.rejects(p.economic(q()),e=>e.code==='invalid_provider_response')}
});
test('ShowMyTrades 429 suppresses retries until Retry-After and never falls back to a different feed',async()=>{
let calls=0,time=Date.parse('2026-10-28T14:00:00Z');const p=createProviders({env:{TRADE_ECONOMIC_PROVIDER:'showmytrades'},now:()=>new Date(time),fetchFn:async()=>{calls++;return calls===1?new Response('',{status:429,headers:{'Retry-After':'300'}}):Response.json(fixture())}});await assert.rejects(p.economic(q()),/429/);await assert.rejects(p.economic(q('CAD')),/429/);assert.equal(calls,1);time+=300001;assert.equal((await p.economic(q())).events.length,1);assert.equal(calls,2);
});
