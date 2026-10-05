/**
 * Real Layout + actual page SSR fixtures. Static seeded data, no live account.
 * Measures viewport/dvh/orientation and CSS drawer/pan boundaries, not React
 * click/gesture handling. Explicit child-scroll probe catches over-broad locks.
 */
import {spawn} from "node:child_process";
import {readFile,writeFile,mkdtemp} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
const dir=process.argv[2]??"/tmp/tkdl-a9-browser";
const scenes=["hub","standings","practice","account","classic","home","map","calendar","palace","login"];
for(const scene of scenes)await readFile(path.join(dir,`${scene}.html`));
const profile=await mkdtemp(path.join(tmpdir(),"tkdl-a9-chrome-"));
const chrome=spawn(process.env.CHROMIUM??"/repl/tools/bin/chromium",[
  "--headless","--no-sandbox","--disable-gpu","--disable-dev-shm-usage","--remote-debugging-port=9224",
  `--user-data-dir=${profile}`,"about:blank"],{stdio:"ignore"});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let ws,seq=0;const pending=new Map(),results=[];
try {
  let tabs;for(let i=0;i<60;i++){try{tabs=await(await fetch("http://127.0.0.1:9224/json")).json();if(tabs.length)break;}catch{}await delay(100);}
  assert.ok(tabs?.[0]?.webSocketDebuggerUrl,"Chromium ready");
  ws=new WebSocket(tabs.find(t=>t.type==="page").webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage=e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await send("Runtime.evaluate",{expression,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  await send("Page.enable");await send("Runtime.enable");
  const geometry=`(()=>{const d=document.documentElement,b=document.body,r=document.querySelector('#root'),s=document.querySelector('.tkdl-app-shell'),
    m=document.querySelector('main'),a=document.querySelector('aside');return {width:innerWidth,height:innerHeight,
      documentWidth:d.scrollWidth,documentHeight:d.scrollHeight,bodyWidth:b.scrollWidth,rootWidth:r.scrollWidth,
      bodyOverflow:getComputedStyle(b).overflow,bodyScrollTop:b.scrollTop,documentScrollTop:d.scrollTop,
      shell:s?{width:s.getBoundingClientRect().width,height:s.getBoundingClientRect().height,scrollWidth:s.scrollWidth}:null,
      main:m?{height:m.clientHeight,scrollHeight:m.scrollHeight,scrollTop:m.scrollTop,overflow:getComputedStyle(m).overflowY}:null,
      drawer:a?{left:a.getBoundingClientRect().left,width:a.getBoundingClientRect().width,
        collapseDisplay:getComputedStyle(a.querySelector('.sidebar-collapse-btn')).display}:null,
      wide:[...document.querySelectorAll('main *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1&&e.getBoundingClientRect().width>20)
        .slice(0,5).map(e=>({tag:e.tagName,className:e.getAttribute('class'),right:e.getBoundingClientRect().right}))};})()`;
  for(const [width,height] of [[320,720],[360,800],[375,812],[390,844],[768,1024],[1024,768],[1440,1000],[844,390]]) {
    await send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:false});
    for(const scene of scenes) {
      await send("Page.navigate",{url:`file://${path.resolve(dir,`${scene}.html`)}`});
      for(let i=0;i<80;i++){if(await evaluate(`document.title===${JSON.stringify(`A9 fixture: ${scene}`)}&&!!document.querySelector('#root')`))break;await delay(100);}
      await delay(100);const before=await evaluate(geometry);
      assert.ok(before.documentWidth<=width,`${scene}@${width}: document pan ${JSON.stringify(before)}`);
      assert.ok(before.rootWidth<=width,`${scene}@${width}: root width`);
      assert.ok(before.documentHeight<=height,`${scene}@${width}: document vertical ownership`);
      assert.equal(before.bodyOverflow,"hidden");
      if(scene!=="login"){
        assert.ok(before.shell,"actual shared Layout");assert.equal(before.shell.height,height);assert.equal(before.shell.width,width);
        assert.equal(before.main.overflow,"auto");assert.ok(before.main.height>100,"usable main");
        if(width<1024){assert.ok(before.drawer.left<=-before.drawer.width,"closed drawer stays off screen");assert.equal(before.drawer.collapseDisplay,"none");}
        else assert.equal(before.drawer.collapseDisplay,"flex");
        await evaluate(`document.querySelector('main').scrollTop=123;window.scrollTo(100,100);document.body.scrollTop=100`);
        const scrolled=await evaluate(geometry);
        assert.equal(scrolled.bodyScrollTop,0);assert.equal(scrolled.documentScrollTop,0);
        if(before.main.scrollHeight>before.main.height)assert.ok(scrolled.main.scrollTop>0,"main owns vertical scroll");
        if(scene==="account"&&height<=844)assert.ok(before.main.scrollHeight>before.main.height,"long Account scrolls internally");
        const drawer=await evaluate(`(()=>{const a=document.querySelector('aside');a.style.transition='none';a.classList.remove('-translate-x-full');a.classList.add('translate-x-0');return true})()`);
        assert.ok(drawer);await delay(20);const opened=await evaluate(geometry);
        assert.equal(opened.documentWidth,before.documentWidth);assert.deepEqual(opened.shell,before.shell);
        if(width<1024)assert.equal(opened.drawer.left,0,"open CSS drawer state");
        await evaluate(`(()=>{const a=document.querySelector('aside');a.classList.remove('translate-x-0');a.classList.add('-translate-x-full')})()`);
        await delay(20);const closed=await evaluate(geometry);assert.deepEqual(closed.shell,before.shell);
        if(width<1024)assert.ok(closed.drawer.left<=-closed.drawer.width,"closed CSS drawer state");
        // Deliberate independent child scrolling remains possible with the new contract.
        const child=await evaluate(`(()=>{const x=document.createElement('div');x.style.cssText='width:100%;overflow-x:auto';
          x.innerHTML='<div style="width:2000px;height:20px">Intentional component scroll probe</div>';
          document.querySelector('.tkdl-content-frame').append(x);x.scrollLeft=100;const p=x.scrollLeft;x.remove();return p})()`);
        assert.ok(child>0,"child horizontal scroll remains usable");
        if(scene==="account"&&width<1024){
          const tabs=await evaluate(`(()=>{const x=[...document.querySelectorAll('main div')].find(e=>getComputedStyle(e).overflowX==='auto'&&e.scrollWidth>e.clientWidth);
            if(!x)return null;x.scrollLeft=37;return {left:x.scrollLeft,documentWidth:document.documentElement.scrollWidth}})()`);
          assert.ok(tabs?.left>0,"actual Account tab scroller works");assert.equal(tabs.documentWidth,width);
        }
        if(scene==="map"){assert.ok(await evaluate(`!!document.querySelector('.career-map-canvas svg')`),"actual map SVG present");
          const widthAfter=await evaluate(`(()=>{document.querySelector('.career-map-canvas svg').setAttribute('viewBox','100 100 400 250');return document.documentElement.scrollWidth})()`);
          assert.equal(widthAfter,width,"SVG pan stays inside app");}
      }
      results.push({scene,width,height,...before});
      if(width===390&&scene!=="login"){const shot=await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});
        await writeFile(path.join(dir,`${scene}-${width}.png`),Buffer.from(shot.data,"base64"));}
    }
  }
  // Same page across orientation/chrome-height changes, no reload.
  await send("Page.navigate",{url:`file://${path.resolve(dir,"home.html")}`});await delay(100);
  for(const [width,height] of [[390,844],[844,390],[390,700],[390,844]]){
    await send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:false});await delay(80);
    const g=await evaluate(geometry);assert.equal(g.shell.height,height);assert.equal(g.documentWidth,width);assert.equal(g.documentHeight,height);
  }
  const safe=await evaluate(`(()=>{const r=document.documentElement;for(const [k,v] of Object.entries({top:20,left:16,right:16,bottom:24}))r.style.setProperty('--tkdl-safe-'+k,v+'px');
    const s=document.querySelector('.tkdl-app-shell');return {width:s.getBoundingClientRect().width,height:s.getBoundingClientRect().height,
      top:getComputedStyle(s).paddingTop,left:getComputedStyle(s).paddingLeft,right:getComputedStyle(s).paddingRight,documentWidth:r.scrollWidth}})()`);
  assert.equal(safe.top,"20px");assert.equal(safe.left,"16px");assert.equal(safe.right,"16px");assert.equal(safe.width,390);assert.equal(safe.documentWidth,390);
  await writeFile(path.join(dir,"browser-results.json"),JSON.stringify({scope:"Static real Layout/page fixtures; seeded auth/data. CSS state geometry, not live React gestures or physical-device safe areas",
    checks:results,orientationTransitions:4,simulatedSafeInsets:safe},null,2));
  console.log(`PASS ${results.length} viewport/page checks + 4 orientation/dvh transitions + simulated safe-inset geometry; ${dir}`);
}finally{ws?.close();chrome.kill();}
