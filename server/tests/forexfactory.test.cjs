const {test}=require('node:test'), assert=require('node:assert/strict');
const {createProviders}=require('../providers.cjs');
const rows=[{title:'USD release',country:'USD',date:'2026-10-28T08:00:00-04:00',impact:'High',forecast:'1.2%',previous:'1%'},{title:'GBP release',country:'GBP',date:'2026-10-29T00:30:00+01:00',impact:'Low',forecast:'',previous:'0'}];
const query=(currency='')=>new URLSearchParams({from:'2026-10-27',to:'2026-10-30',timezone:'Europe/London',currencies:currency});
test('weekly no-key feed normalizes offset dates, currency and impact; never fabricates actual or full coverage',async()=>{let calls=0;const p=createProviders({env:{TRADE_ECONOMIC_PROVIDER:'forexfactory'},fetchFn:async url=>{assert.equal(String(url),'https://nfs.faireconomy.media/ff_calendar_thisweek.json');calls++;return Response.json(rows)},now:()=>new Date('2026-10-28T10:00:00Z')});const a=await p.economic(query('USD'));assert.equal(a.events.length,1);assert.equal(a.events[0].time,'2026-10-28T12:00:00.000Z');assert.equal(a.events[0].impact,'high');assert.equal(a.events[0].actual,null);assert.equal(a.complete,false);assert.equal(a.coverageFrom,'2026-10-28');assert.equal(a.coverageTo,'2026-10-28');assert.match(a.notice,/30 minutos/);const b=await p.economic(query('GBP'));assert.equal(b.events.length,1);assert.equal(b.cached,true);assert.equal(calls,1);});
test('concurrent different filters share one upstream request',async()=>{let calls=0;const p=createProviders({env:{TRADE_ECONOMIC_PROVIDER:'forexfactory'},fetchFn:async()=>{calls++;await new Promise(r=>setTimeout(r,20));return Response.json(rows)}});await Promise.all([p.economic(query('USD')),p.economic(query('GBP'))]);assert.equal(calls,1)});
test('invalid and empty feeds, missing timezone, and rate limits cannot imply no-news clearance',async()=>{for(const data of [[],{},[{...rows[0],date:'2026-10-28 08:00:00'}],[{...rows[0],country:''}]]){const p=createProviders({env:{TRADE_ECONOMIC_PROVIDER:'forexfactory'},fetchFn:async()=>Response.json(data)});await assert.rejects(p.economic(query()),e=>e.code==='invalid_provider_response')}const p=createProviders({env:{TRADE_ECONOMIC_PROVIDER:'forexfactory'},fetchFn:async()=>new Response('',{status:429})});await assert.rejects(p.economic(query()),e=>e.code==='provider_unavailable')});
test('provider diagnostics distinguish HTTP errors and never echo upstream secrets',async()=>{
for(const status of [401,403,429,500]) {
const p=createProviders({env:{TRADE_ECONOMIC_PROVIDER:'forexfactory'},fetchFn:async()=>new Response('secret-upstream-body',{status})});
await assert.rejects(p.economic(query()),e=>e.message.includes('HTTP '+status)&&!e.message.includes('secret-upstream-body'));
}
const p=createProviders({env:{TRADE_ECONOMIC_PROVIDER:'forexfactory'},fetchFn:async()=>{throw Error('https://private/?apikey=secret')}});
await assert.rejects(p.economic(query()),e=>e.code==='provider_unavailable'&&!e.message.includes('secret'));
});
test('weekly feed honors Retry-After and suppresses repeated requests across filters until pause ends',async()=>{
let time=Date.parse('2026-10-28T12:00:00Z'),calls=0;
const p=createProviders({env:{TRADE_ECONOMIC_PROVIDER:'forexfactory'},now:()=>new Date(time),fetchFn:async()=>{calls++;return calls===1?new Response('',{status:429,headers:{'Retry-After':'3600'}}):Response.json(rows)}});
await assert.rejects(p.economic(query('USD')),e=>/60 min/.test(e.message));
await assert.rejects(p.economic(query('GBP')),e=>/HTTP 429/.test(e.message));assert.equal(calls,1);
time+=3600001;assert.equal((await p.economic(query('USD'))).events.length,1);assert.equal(calls,2);
});
