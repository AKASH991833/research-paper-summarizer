import puppeteer from 'puppeteer-core';
import fs from 'fs';
const out='/tmp/shots61';fs.mkdirSync(out,{recursive:true});
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--disable-dev-shm-usage','--hide-scrollbars']});
let fails=[];
const check=(name,ok,extra='')=>{console.log((ok?'PASS':'FAIL')+' '+name+(extra?' — '+extra:''));if(!ok)fails.push(name);};
for(const v of [{name:'desktop',w:1440,h:900},{name:'mobile',w:390,h:844}]){
 for(const theme of ['light','dark']){
  const page=await browser.newPage();
  await page.setViewport({width:v.w,height:v.h,deviceScaleFactor:1});
  const errs=[];page.on('pageerror',e=>errs.push(String(e)));page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
  await page.evaluateOnNewDocument(t=>localStorage.setItem('theme',t),theme);
  await page.goto('http://localhost:8061',{waitUntil:'networkidle2'});
  await page.click('#btnSample');
  await page.waitForSelector('#briefing:not(.hidden)');
  await new Promise(s=>setTimeout(s,300));
  const st=await page.evaluate(()=>window._test.analyze());
  check(`${v.name}/${theme} title extracted`,st.title.includes('Attention Is All You Need'),st.title);
  check(`${v.name}/${theme} sections parsed`,st.secs.includes('Abstract')&&st.secs.includes('Introduction')&&st.secs.includes('Method')&&st.secs.includes('Results')&&st.secs.includes('Conclusion'),st.secs.join(','));
  check(`${v.name}/${theme} sentence count sane`,st.sents>=18&&st.sents<=40,st.sents+' sentences');
  check(`${v.name}/${theme} tldr has 5 sentences`,st.tldr===5);
  check(`${v.name}/${theme} contributions found`,st.contrib>=2,st.contrib+' contributions');
  check(`${v.name}/${theme} results found`,st.results>=2,st.results+' results');
  check(`${v.name}/${theme} limitations found`,st.lims>=1,st.lims+' limitations');
  check(`${v.name}/${theme} keywords include transformer`,st.keywords.includes('transformer'),st.keywords.slice(0,6).join(','));
  // TL;DR contains the architecture sentence (top-scored abstract sentence)
  const tldrTxt=await page.$eval('#tldr',e=>e.textContent);
  check(`${v.name}/${theme} tldr mentions Transformer`,/Transformer/i.test(tldrTxt));
  // length control
  await page.select('#sumLen','3');
  await page.evaluate(()=>document.getElementById('btnGo').click());
  await new Promise(s=>setTimeout(s,300));
  const tldr3=await page.$$eval('#tldr .card',els=>els.length);
  check(`${v.name}/${theme} length control`,tldr3===3,tldr3+' sentences');
  await page.select('#sumLen','5');
  // too-short input is rejected
  await page.evaluate(()=>{document.getElementById('paperText').value='Too short.';document.getElementById('btnGo').click();});
  await new Promise(s=>setTimeout(s,200));
  const toast=await page.$eval('.toast-zone',e=>e.textContent).catch(()=> '');
  check(`${v.name}/${theme} short input rejected`,/paragraph/i.test(toast));
  // restore sample for screenshots
  await page.evaluate(()=>{document.getElementById('paperText').value=window._test.sample();document.getElementById('btnGo').click();});
  await new Promise(s=>setTimeout(s,400));
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:`${out}/top-${v.name}-${theme}.png`});
  await page.evaluate(()=>document.getElementById('briefing').scrollIntoView({block:'start'}));
  await new Promise(s=>setTimeout(s,250));
  await page.screenshot({path:`${out}/briefing-${v.name}-${theme}.png`});
  await page.evaluate(()=>document.querySelector('#contrib').scrollIntoView({block:'center'}));
  await new Promise(s=>setTimeout(s,250));
  await page.screenshot({path:`${out}/detail-${v.name}-${theme}.png`});
  check(`${v.name}/${theme} no console errors`,errs.length===0,errs.slice(0,3).join('|'));
  await page.close();
 }
}
await browser.close();
if(fails.length){console.log('\nFAILURES: '+fails.join(', '));process.exit(1);}
console.log('\nALL PASS');
