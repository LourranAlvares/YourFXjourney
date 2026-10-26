// Run: NODE_PATH=<directory containing playwright> node tests/dashboard.cjs
// Optional: PLAYWRIGHT_BROWSERS_PATH=<installed browsers directory>
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE_PATH||undefined});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let count=0;const check=(name,fn)=>{fn();count++;console.log('PASS',name)};
 await page.clock.setFixedTime(new Date('2026-10-26T12:00:00Z'));
 await page.goto('file://'+path.resolve(__dirname,'../YourFXjourney.html'));
 check('empty dashboard renders without fabricated performance',()=>{});
 assert.equal(await page.locator('.primary-metrics .k').count(),7);
 assert.match(await page.locator('.primary-metrics').innerText(),/Aguardando operações/);
 assert.equal(await page.locator('.cal .cd:not(.e)').count(),31);
 await page.evaluate(()=>{
  S={trades:[
   mk({id:'a',symbol:'EURUSD',side:'long',open:'2026-10-01T09:00',close:'2026-10-01T10:00',pnl:100,risk:50,notes:'Plano executado <seguro>',lesson:'Esperar confirmação',img:['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=']}),
   mk({id:'b',symbol:'EURUSD',side:'short',close:'2026-10-01T11:00',pnl:-40,risk:20}),
   mk({id:'c',symbol:'GBPUSD',side:'long',close:'2026-10-02T11:00',pnl:0}),
   mk({id:'d',symbol:'EURUSD',side:'long',close:'2026-10-03T11:00',pnl:60,risk:30}),
   mk({id:'e',symbol:'GBPUSD',side:'long',close:'2026-09-30T11:00',pnl:-20,risk:20})
  ],reviews:{},strats:[],balance:10000};cm=new Date(2026,9,1);save();R();
 });
 const stats=await page.evaluate(()=>st(ft()));
 const rr=page.locator('.primary-metrics .k').filter({has:page.locator('small',{hasText:/^Risco\/retorno médio$/})});
 const risk=page.locator('.primary-metrics .k').filter({has:page.locator('small',{hasText:/^Risco médio \/ trade$/})});
 assert.match(await rr.innerText(),/2\.67/);assert.equal(await risk.count(),0);
 const withoutRisk=await page.evaluate(()=>{const doc=new DOMParser().parseFromString(vDash([mk({close:'2026-10-01T10:00',pnl:70}),mk({close:'2026-10-01T11:00',pnl:-20})]),'text/html');return [...doc.querySelectorAll('.primary-metrics .k')].find(el=>el.textContent.includes('Risco/retorno médio')).textContent});assert.match(withoutRisk,/3\.50/);
 check('existing net, win rate, profit factor and drawdown calculations',()=>{assert.equal(stats.net,100);assert.equal(stats.n,5);assert.equal(stats.wr,40);assert.equal(stats.pf,160/60);assert.equal(stats.dd,40);assert.equal(stats.totR,1);assert.equal(stats.avgR,.25)});
 check('daily series matches actual close dates',()=>{});
 assert.deepEqual(await page.evaluate(()=>chartData(ft(),'daily').map(d=>[d.date,d.value])),[['2026-09-30',-20],['2026-10-01',60],['2026-10-02',0],['2026-10-03',60]]);
 await page.getByLabel('Data inicial',{exact:true}).fill('2026-10-01');
 await page.getByLabel('Data final',{exact:true}).fill('2026-10-02');
 check('custom dates filter metrics, chart and calendar consistently',()=>{});
 assert.equal(await page.evaluate(()=>st(ft()).net),60);
 assert.match(await rr.innerText(),/2\.50/);
 assert.equal(await page.locator('.chart-point').count(),2);
 assert.match(await page.locator('.calendar-summary').innerText(),/3 trades/);
 await page.locator('.cal button').filter({has:page.locator('b',{hasText:/^1$/})}).click();
 assert.equal(await page.locator('#daydlg .day-trade').count(),2);
 assert.match(await page.locator('#daydlg').innerText(),/Plano executado <seguro>/);
 assert.equal(await page.locator('#daydlg img').count(),1);
 check('day drilldown shows records, journal, screenshots and actual totals',()=>{});
 await page.getByRole('button',{name:'Abrir trade',exact:true}).first().click();
 assert.equal(await page.locator('#f_symbol').inputValue(),'EURUSD');
 assert.equal(await page.locator('#f_notes').inputValue(),'Plano executado <seguro>');
 await page.getByRole('button',{name:'Cancelar',exact:true}).click();
 await page.getByRole('button',{name:'Próximo mês',exact:true}).click();
 assert.match(await page.locator('.month-title').innerText(),/novembro/);
 await page.getByRole('button',{name:'Mês anterior',exact:true}).click();
 assert.match(await page.locator('.month-title').innerText(),/outubro/);
 check('calendar month navigation',()=>{});
 await page.getByRole('button',{name:'Limpar',exact:true}).click();
 for(const mode of ['pnl','daily','r','dd']){
  await page.getByLabel('Visualização do gráfico',{exact:true}).selectOption(mode);
  await page.locator('.chart-point').first().focus();
  assert.match(await page.locator('#chart-readout').innerText(),/2026-09-30/);
 }
 check('chart modes and keyboard tooltips',()=>{});
 assert.equal(await page.locator('option[value="balance"]').evaluate(e=>e.disabled),true);
 await page.locator('.account-settings summary').click();
 await page.locator('#account-baseline').fill('1000');
 await page.locator('#account-currency').selectOption('GBP');
 await page.getByRole('button',{name:'Salvar configuração'}).click();
 assert.match(await page.locator('.secondary-metrics .k').first().innerText(),/1[\s,.]?100[,.]00/);
 await page.getByLabel('Visualização do gráfico',{exact:true}).selectOption('balance');
 assert.deepEqual(await page.evaluate(()=>chartData(ft(),'balance').map(d=>d.value)),[980,1040,1040,1100]);
 await page.evaluate(()=>{F.from='2026-10-01';R()});
 assert.equal(await page.evaluate(()=>chartData(ft(),'balance')[0].value),1040);
 check('confirmed account balance includes preceding history when filtered',()=>{});
 await page.locator('.filters').getByLabel('Ativo',{exact:true}).selectOption('EURUSD');
 assert.equal(await page.locator('option[value="balance"]').evaluate(e=>e.disabled),true);
 assert.equal(await page.getByLabel('Visualização do gráfico',{exact:true}).inputValue(),'pnl');
 check('asset filter prevents mislabeling a partial result as account balance',()=>{});
 await page.getByRole('button',{name:'Limpar',exact:true}).click();
 const ranges={week:['2026-10-26','2026-10-26'],month:['2026-10-01','2026-10-26'],lastmonth:['2026-09-01','2026-09-30'],'30':['2026-09-27','2026-10-26'],'90':['2026-07-29','2026-10-26'],year:['2026-01-01','2026-10-26'],all:['','']};
 for(const preset of Object.keys(ranges)){
  await page.getByLabel('Período',{exact:true}).selectOption(preset);
  assert.equal(await page.evaluate(()=>rangePreset),preset);
  assert.deepEqual(await page.evaluate(()=>[F.from,F.to]),ranges[preset]);
 }
 check('all date presets execute and update controls',()=>{});
 await page.getByRole('button',{name:'+ Novo trade',exact:true}).click();
 await page.locator('#f_symbol').fill('USDJPY');await page.locator('#f_close').fill('2026-10-04T14:30');await page.locator('#f_pnl').fill('25');
 await page.getByRole('button',{name:'Salvar',exact:true}).click();
 assert.equal(await page.evaluate(()=>S.trades.length),6);
 await page.reload();assert.equal(await page.evaluate(()=>S.trades.length),6);
 check('manual entry and persisted store remain functional',()=>{});
 await page.evaluate(()=>{window.importResult=imp('Trade #,Type,Date/Time,Price,Net P&L\n1,Entry long,2026-10-06 09:00,1.1,\n1,Exit long,2026-10-06 10:00,1.2,50','EURUSD');R()});
 assert.equal(await page.evaluate(()=>window.importResult.ok),1);
 await page.evaluate(()=>{window.importResult=imp('Trade #,Type,Date/Time,Price,Net P&L\n1,Entry long,2026-10-06 09:00,1.1,\n1,Exit long,2026-10-06 10:00,1.2,50','EURUSD')});
 assert.equal(await page.evaluate(()=>window.importResult.dup),1);
 check('existing CSV importer and duplicate detection',()=>{});
 for(const route of ['cal','trades','ana','pat','risk','rev','str','dash']){
  await page.evaluate(t=>{tab=t;R()},route);assert.ok((await page.locator('main').innerText()).length>100);
 }
 check('all eight existing pages still render',()=>{});
 const downloadPromise=page.waitForEvent('download');await page.evaluate(()=>bk());const download=await downloadPromise;assert.equal(download.suggestedFilename(),'yourfxjourney-backup.json');
 check('JSON backup export',()=>{});
 for(const width of [1440,1024,768,390,320]){
  await page.setViewportSize({width,height:1000});await page.waitForTimeout(180);
  const dims=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,calendar:document.querySelector('.cal').getBoundingClientRect().width}));
  assert.ok(dims.scroll<=dims.width,`horizontal overflow at ${width}: ${dims.scroll}`);assert.ok(dims.calendar>200);
  if(width===1440||width===390)await page.screenshot({path:'/tmp/yfx-dashboard-'+width+'.png',fullPage:true});
 }
 check('responsive dashboard has no page overflow at 320–1440px',()=>{});
 assert.deepEqual(errors,[]);
 check('no browser JavaScript errors',()=>{});
 console.log(`${count} checks passed`);await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
