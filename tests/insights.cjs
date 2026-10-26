const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.clock.setFixedTime(new Date('2026-10-26T12:00:00Z'));
 await page.goto('file://'+path.resolve(__dirname,'../YourFXjourney.html'));
 let passed=0;const test=async(name,fn)=>{await fn();passed++;console.log('PASS',name)};
 await page.getByRole('button',{name:'Trading Insights',exact:false}).click();
 await test('empty state does not fabricate process or returns',async()=>{
  assert.equal(await page.getByRole('tab').count(),3);
  assert.match(await page.locator('.insight-process-line').innerText(),/Dados insuficientes/);
  assert.match(await page.locator('.insight-metrics').innerText(),/R indisponível/);
 });
 await test('legacy trades have financial metrics but no inferred behavior',async()=>{
  const r=await page.evaluate(()=>{S={trades:[mk({close:'2026-10-26T10:00',pnl:100}),mk({close:'2026-10-26T11:00',pnl:-50,risk:25})],reviews:{},strats:[],balance:1000};const w=insWindows(),m=insAnalysis(S.trades,[],w);return {net:m.s.net,totR:m.s.totR,score:m.process.score,plan:m.process.plan.value,insights:m.selected.length,pct:insPercent(w.from,S.trades)}});
  assert.deepEqual(r,{net:50,totR:-2,score:null,plan:null,insights:0,pct:null});
 });
 await test('discipline is unchanged by profit, loss or win rate',async()=>{
  const r=await page.evaluate(()=>{const behavior={entry:true,risk:true,exit:true,limits:true,plan:true};S.trades=[mk({close:'2026-10-26T10:00',pnl:-100,behavior})];const loss=insProcess(S.trades).score;S.trades[0].pnl=1000;return [loss,insProcess(S.trades).score]});assert.deepEqual(r,[100,100]);
 });
 await test('incomplete criteria and minimum coverage prevent misleading score',async()=>{
  const r=await page.evaluate(()=>{const yes={entry:true,risk:true,exit:true,limits:true,plan:true};S.trades=Array.from({length:5},(_,i)=>mk({close:'2026-10-26T1'+i+':00',pnl:0,behavior:i<3?yes:{entry:true}}));const a=insProcess(S.trades);delete S.trades[2].behavior;return [a.score,a.complete,insProcess(S.trades).score]});assert.deepEqual(r,[100,3,null]);
 });
 await test('rules are configurable and apply equal weights to process only',async()=>{
  const r=await page.evaluate(()=>{S.insightRules={enabled:['entry','plan']};S.trades=[mk({close:'2026-10-26T10:00',pnl:999,behavior:{entry:true,plan:false}})];return insProcess(S.trades).score});assert.equal(r,50);
 });
 await test('daily limits include hidden assets; absent risk does not imply compliance',async()=>{
  const r=await page.evaluate(()=>{S.insightRules={dailyMax:2,riskMax:50};S.trades=[mk({symbol:'GBPUSD',close:'2026-10-26T09:00',pnl:0}),mk({symbol:'GBPUSD',close:'2026-10-26T10:00',pnl:0}),mk({symbol:'EURUSD',close:'2026-10-26T11:00',pnl:0,risk:60})];F.sym='EURUSD';const p=insProcess(insFiltered());return [p.checked[0].c.limits,p.checked[0].c.risk,p.score,insProcess(S.trades).checked[0].c.risk]});assert.deepEqual(r,[false,false,null,null]);
 });
 await test('missing R is distinct from zero R and no fixed risk is assumed',async()=>{
  const r=await page.evaluate(()=>{delete S.insightRules;return [insStats([mk({close:'2026-10-26T10:00',pnl:0})]).totR,insStats([mk({close:'2026-10-26T10:00',pnl:0,risk:10})]).totR,insStats([mk({close:'2026-10-26T10:00',pnl:40,risk:20}),mk({close:'2026-10-26T11:00',pnl:-10,risk:5})]).avgR]});assert.deepEqual(r,[null,0,0]);
 });
 await test('calendar windows handle equivalent elapsed periods, leap years and global date intersections',async()=>{
  const r=await page.evaluate(()=>{F={from:'',to:'',sym:'',strat:''};const month=insWindows('month','2026-10-26'),week=insWindows('week','2026-10-26'),leap=insBounds('month','2024-02-12');F.from='2026-10-05';F.to='2026-10-15';const slice=insWindows('month','2026-10-26');F.from='2026-11-01';const empty=insWindows('month','2026-10-26').empty;return {month:[month.from,month.to,month.previous.from,month.previous.to],week:[week.from,week.to,week.previous.from,week.previous.to],leap,slice:[slice.from,slice.to,slice.previous.from,slice.previous.to],empty}});
  assert.deepEqual(r,{month:['2026-10-01','2026-10-26','2026-09-01','2026-09-26'],week:['2026-10-26','2026-10-26','2026-10-19','2026-10-19'],leap:{from:'2024-02-01',to:'2024-02-29'},slice:['2026-10-05','2026-10-15','2026-09-05','2026-09-15'],empty:true});
 });
 await test('small financial samples do not produce strategy efficiency claims or emotional errors',async()=>{
  const r=await page.evaluate(()=>{F={from:'',to:'',sym:'',strat:''};S.trades=Array.from({length:3},(_,i)=>mk({symbol:'EURUSD',setup:'A',close:'2026-10-26T1'+i+':00',pnl:-100}));return insAnalysis(S.trades,[],insWindows()).selected});assert.deepEqual(r,[]);
 });
 await test('daily output is capped at three observations and one next action',async()=>{
  const r=await page.evaluate(()=>{IV.mode='day';S.trades=Array.from({length:5},(_,i)=>mk({symbol:'EURUSD',close:'2026-10-26T1'+i+':00',pnl:-10,emotion:'Ansioso',behavior:{entry:false,risk:false,exit:true,limits:false,plan:false,errors:['early','offplan','risk']}}));const m=insAnalysis(S.trades,[],insWindows());return [m.selected.length,m.actions.length,m.selected.map(x=>x.category)]});assert.ok(r[0]<=3);assert.equal(r[1],1);assert.equal(new Set(r[2]).size,r[2].length);
 });
 await test('comparisons identify registered improvement without treating lower P&L as poor execution',async()=>{
  const r=await page.evaluate(()=>{const make=(pnl,plan,date)=>Array.from({length:5},(_,i)=>mk({close:date+'T1'+i+':00',pnl,behavior:{entry:true,risk:true,exit:true,limits:true,plan}}));IV.mode='week';const now=make(-10,true,'2026-10-26'),prev=make(100,false,'2026-10-19');S.trades=[...now,...prev];const m=insAnalysis(now,prev,insWindows());return {text:m.evolution.map(e=>e.text).join(' '),strong:m.selected.some(x=>x.id==='discipline-up'),actions:m.actions.length}});assert.match(r.text,/80% → 100%/);assert.equal(r.strong,true);assert.ok(r.actions<=2);
 });
 await test('recurring error comparison uses explicit observations and denominators',async()=>{
  const r=await page.evaluate(()=>{const make=(n,date)=>Array.from({length:5},(_,i)=>mk({close:date+'T1'+i+':00',pnl:10,behavior:{errors:i<n?['early']:[]}}));const now=make(1,'2026-10-26'),before=make(4,'2026-10-19');S.trades=[...now,...before];return insAnalysis(now,before,insWindows()).evolution.map(e=>e.text).join(' ')});assert.match(r,/4\/5 \(80%\) → 1\/5 \(20%\)/);
 });
 await test('group insights require the configured sample and preserve deterministic expectancy',async()=>{
  const r=await page.evaluate(()=>{delete S.insightRules;IV.mode='month';const ts=Array.from({length:10},(_,i)=>mk({symbol:'EURUSD',setup:'Pullback',open:'2026-10-20T09:00',close:'2026-10-20T10:'+String(i).padStart(2,'0'),pnl:20}));S.trades=ts;const m=insAnalysis(ts,[],insWindows());return {groups:insGroupRows(ts,t=>t.setup).map(g=>[g.name,g.n,g.ex]),strong:m.selected.find(x=>x.category==='strong')?.text}});assert.deepEqual(r.groups,[['Pullback',10,20]]);assert.match(r.strong,/exploratória/);
 });
 await test('post-loss impulse alerts require explicitly registered impulse and repeated observations',async()=>{
  const r=await page.evaluate(()=>{IV.mode='day';const ts=[mk({id:'loss1',close:'2026-10-26T09:00',pnl:-10}),mk({id:'i1',open:'2026-10-26T09:10',close:'2026-10-26T09:20',pnl:10,emotion:'Impulsivo'}),mk({id:'loss2',close:'2026-10-26T10:00',pnl:-10}),mk({id:'i2',open:'2026-10-26T10:10',close:'2026-10-26T10:20',pnl:10,behavior:{errors:['impulse']}})];S.trades=ts;const a=insAnalysis(ts,[],insWindows());delete ts[1].emotion;delete ts[3].behavior;const b=insAnalysis(ts,[],insWindows());return [a.selected.some(x=>x.id==='after-loss'),b.selected.some(x=>x.id==='after-loss')]});assert.deepEqual(r,[true,false]);
 });
 await test('optional breakeven band does not modify existing financial formulas',async()=>{
  const r=await page.evaluate(()=>{S.insightRules={breakeven:2};const ts=[mk({close:'2026-10-26T10:00',pnl:1}),mk({close:'2026-10-26T11:00',pnl:-1})];const a=insStats(ts),b=st(ts);return [a.operationalBE,b.net,b.w,b.l,b.pf]});assert.deepEqual(r,[2,0,1,1,1]);
 });
 await test('return percent uses confirmed account opening balance and no double-counting costs',async()=>{
  const r=await page.evaluate(()=>{S.balance=1000;S.balanceConfirmed=true;S.trades=[mk({close:'2026-10-25T10:00',pnl:100}),mk({close:'2026-10-26T10:00',pnl:110})];return insPercent('2026-10-26',[S.trades[1]])});assert.equal(r,10);
 });
 await page.evaluate(()=>{S={trades:[mk({id:'legacy',symbol:'EURUSD',side:'long',close:'2026-10-26T10:00',pnl:-10,risk:5,notes:'Nota histórica',lesson:'Lição',img:[]})],reviews:{week:'preservado'},strats:[{name:'Teste'}],balance:1000};F={from:'',to:'',sym:'',strat:''};IV={mode:'day',anchor:'2026-10-26'};tab='ins';save();R()});
 await test('trade editing uses quick optional selections and persists them with legacy data',async()=>{
  await page.evaluate(()=>edit('legacy'));
  await page.locator('.behavior-panel summary').click();
  for(const key of ['entry','risk','exit','limits','plan'])await page.locator(`input[name="ib-${key}"][value="yes"]`).check();
  await page.locator('input[name="ib-grade"][value="A"]').check();
  await page.getByRole('button',{name:'Nenhum erro',exact:true}).click();
  await page.locator('#f_emotion').selectOption('Confiante');
  await page.getByRole('button',{name:'Salvar',exact:true}).click();
  const data=await page.evaluate(()=>S.trades[0]);assert.equal(data.behavior.plan,true);assert.deepEqual(data.behavior.errors,[]);assert.equal(data.behavior.grade,'A');assert.equal(data.notes,'Nota histórica');assert.equal(data.pnl,-10);assert.equal(data.risk,5);
  await page.reload();assert.equal(await page.evaluate(()=>S.trades[0].behavior.plan),true);
  await page.getByRole('button',{name:'Trading Insights',exact:false}).click();
  assert.match(await page.locator('.insight-process-line').innerText(),/100\/100/);
 });
 await test('unassessed errors remain distinct from explicitly no errors',async()=>{
  await page.evaluate(()=>edit('legacy'));
  await page.getByRole('button',{name:'Não avaliado',exact:true}).click();
  await page.getByRole('button',{name:'Salvar',exact:true}).click();
  assert.equal(await page.evaluate(()=>S.trades[0].behavior.errors===undefined),true);
 });
 await test('tabs navigate without reload, have keyboard navigation and preserve global asset filters',async()=>{
  await page.getByRole('tab',{name:'Semanal',exact:true}).click();assert.equal(await page.evaluate(()=>IV.mode),'week');
  await page.getByRole('tab',{name:'Semanal',exact:true}).press('ArrowRight');assert.equal(await page.evaluate(()=>IV.mode),'month');
  assert.equal(await page.locator('.insight-metric').count(),8);
  await page.getByRole('tab',{name:'Diário',exact:true}).click();assert.equal(await page.locator('.insight-metric').count(),4);
  await page.getByRole('button',{name:'Período anterior',exact:true}).click();assert.equal(await page.evaluate(()=>IV.anchor),'2026-10-25');
  await page.getByRole('button',{name:'Último trade',exact:true}).click();assert.equal(await page.evaluate(()=>IV.anchor),'2026-10-26');
 });
 await test('custom rules save, reload and recalculate without changing historical trades',async()=>{
  const before=await page.evaluate(()=>JSON.stringify(S.trades));
  await page.getByText('Minhas regras operacionais',{exact:false}).click();
  await page.locator('#ir-daily').fill('1');await page.locator('#ir-riskmax').fill('20');await page.locator('#ir-text-entry').fill('Aguardar fechamento do candle');
  await page.getByRole('button',{name:'Salvar regras',exact:true}).click();assert.match(await page.locator('#ins-rule-status').innerText(),/Regras salvas/);
  assert.equal(await page.evaluate(()=>JSON.stringify(S.trades)),before);
  await page.reload();assert.equal(await page.evaluate(()=>S.insightRules.texts.entry),'Aguardar fechamento do candle');
  await page.getByRole('button',{name:'Trading Insights',exact:false}).click();
 });
 await test('responsive reports and behavioral editor have no page overflow',async()=>{
  for(const mode of ['day','week','month']){
   await page.evaluate(mode=>{IV.mode=mode;R()},mode);
   for(const width of [1440,1024,768,390,320]){
    await page.setViewportSize({width,height:1000});await page.waitForTimeout(150);
    const size=await page.evaluate(()=>[document.documentElement.scrollWidth,innerWidth]);assert.ok(size[0]<=size[1],`${mode} at ${width}: ${size}`);
    if(mode==='month'&&[1440,390].includes(width))await page.screenshot({path:`/tmp/yfx-insights-${width}.png`,fullPage:true});
   }
  }
 });
 await test('backup restore keeps behavioral data and rules, CSV reimport does not duplicate',async()=>{
  const backup=await page.evaluate(()=>JSON.stringify(S));
  await page.evaluate(()=>{tab='trades';S.trades=[];delete S.insightRules;save();R()});
  page.once('dialog',d=>d.accept());
  await page.locator('input[accept=".json"]').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(backup)});
  await page.waitForFunction(()=>S.insightRules?.texts.entry==='Aguardar fechamento do candle');
  assert.equal(await page.evaluate(()=>S.trades[0].behavior.grade),'A');
  const out=await page.evaluate(()=>{const csv='Trade #,Type,Date/Time,Price,Net P&L\n1,Entry long,2026-10-26 09:00,1.1,\n1,Exit long,2026-10-26 10:00,1.2,50';const a=imp(csv,'EURUSD'),b=imp(csv,'EURUSD');return [a.ok,b.ok,b.dup,S.trades.at(-1).behavior]});assert.deepEqual(out,[1,0,1,undefined]);
 });
 assert.deepEqual(errors,[]);console.log(`${passed} checks passed; no JavaScript errors`);await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
