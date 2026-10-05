/**
 * Chromium rendering checks of TEST-ONLY SSR fixtures. Not an authenticated live
 * career/scorer test. Generate fixtures with A83_BROWSER_DIR and career-ui.test.ts.
 * Node 24 WebSocket; no Playwright install or production credentials required.
 */
import {spawn} from "node:child_process";
import {readFile,writeFile,mkdtemp} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
const dir=process.argv[2]??"/tmp/tkdl-a83-browser";
const scenes=["home","map","world","palace","identity"];
for(const scene of scenes)await readFile(path.join(dir,`${scene}.html`));
const profile=await mkdtemp(path.join(tmpdir(),"tkdl-a83-chrome-"));
const chrome=spawn(process.env.CHROMIUM??"/repl/tools/bin/chromium",[
  "--headless","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
  "--remote-debugging-port=9223",
  `--user-data-dir=${profile}`,"about:blank"],{stdio:"ignore"});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let ws,seq=0;const pending=new Map(),results=[];
try {
  let tabs;
  for(let i=0;i<60;i++){try{tabs=await(await fetch("http://127.0.0.1:9223/json")).json();if(tabs.length)break;}catch{}await delay(100);}
  assert.ok(tabs?.[0]?.webSocketDebuggerUrl,"Chromium CDP ready");
  const tab=tabs.find(t=>t.type==="page");assert.ok(tab,"Chromium page target");
  ws=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage=e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  await send("Page.enable");await send("Runtime.enable");await delay(300);
  for(const [width,height] of [[1440,1000],[820,1180],[390,844],[360,800],[844,390]]) {
    await send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:false});
    for(const scene of scenes) {
      const navigation=await send("Page.navigate",{url:`file://${path.resolve(dir,`${scene}.html`)}`});
      assert.ok(!navigation.errorText,`${scene}: ${JSON.stringify(navigation)}`);
      for(let i=0;i<80;i++){const ready=await send("Runtime.evaluate",{expression:`document.title===${JSON.stringify(`A8.3 test fixture: ${scene}`)}&&!!document.querySelector('.career-root')`,returnByValue:true});if(ready.result.value)break;await delay(100);}
      await delay(100);
      const r=await send("Runtime.evaluate",{returnByValue:true,expression:`JSON.stringify({
        title:document.title,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
        overflow:[...document.querySelectorAll('body *')].filter(e=>e.namespaceURI==='http://www.w3.org/1999/xhtml'&&e.getBoundingClientRect().right>innerWidth+1).slice(0,6).map(e=>({tag:e.tagName,className:e.className,right:e.getBoundingClientRect().right})),
        text:document.body.innerText,svgs:document.querySelectorAll('svg').length,
        mapPins:document.querySelectorAll('svg [role="button"]').length,
        navPosition:getComputedStyle(document.querySelector('.career-primary-nav')||document.body).position,
        navLinks:[...document.querySelectorAll('.career-primary-nav a')].map(a=>({label:a.innerText,height:a.getBoundingClientRect().height})),
        mapColumns:document.querySelector('.career-map-layout')?getComputedStyle(document.querySelector('.career-map-layout')).gridTemplateColumns:null
      })`});
      const data=JSON.parse(r.result.value);
      assert.equal(data.width,width);assert.ok(data.scrollWidth<=width+1,`${scene} @${width}: horizontal overflow ${data.scrollWidth}; ${JSON.stringify(data.overflow)}`);
      if(scene!=="world")assert.ok(data.svgs>0,`${scene}: SVG identity/geography rendered (${data.title}; ${data.text.slice(0,120)})`);
      if(["home","map","world"].includes(scene)){assert.equal(data.navLinks.length,5);for(const a of data.navLinks)assert.ok(a.height>=44,`${scene}: ${a.label} touch target`);}
      if(scene==="map"){assert.ok(data.mapPins>0);assert.match(data.text,/Not Qualified/);assert.match(data.text,/£175/);}
      results.push({scene,width,height,scrollWidth:data.scrollWidth,svgCount:data.svgs,mapPins:data.mapPins,navPosition:data.navPosition,mapColumns:data.mapColumns});
      if(width===1440||width===390) {
        const shot=await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});
        await writeFile(path.join(dir,`${scene}-${width}.png`),Buffer.from(shot.data,"base64"));
      }
    }
  }
  await writeFile(path.join(dir,"browser-results.json"),JSON.stringify({scope:"Static seeded real-component fixtures; no live authentication or interactive gameplay",checks:results},null,2));
  console.log(`PASS ${results.length} browser render/viewport checks; screenshots and evidence: ${dir}`);
}finally{ws?.close();chrome.kill();}
