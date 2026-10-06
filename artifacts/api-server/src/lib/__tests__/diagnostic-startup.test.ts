import {test} from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {createServer} from "node:net";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";
import express from "express";
import session,{type SessionData} from "express-session";
import connectPg from "connect-pg-simple";
import {PGlite} from "@electric-sql/pglite";
import {diagnosticStartupEnabled,diagnosticApiGate,createReadOnlyDiagnosticStore} from "../diagnostic-startup.ts";

test("diagnostic mode is explicit, normal by default and fail-closed on invalid values",()=>{
  const previous=process.env.TKDL_DIAGNOSTIC_ONLY;
  try{delete process.env.TKDL_DIAGNOSTIC_ONLY;assert.equal(diagnosticStartupEnabled(),false);}
  finally{if(previous===undefined)delete process.env.TKDL_DIAGNOSTIC_ONLY;else process.env.TKDL_DIAGNOSTIC_ONLY=previous;}
  assert.equal(diagnosticStartupEnabled("0"),false);
  assert.equal(diagnosticStartupEnabled("1"),true);
  for(const invalid of ["","true","yes","read-only","2"])assert.throws(()=>diagnosticStartupEnabled(invalid));
});

test("diagnostic API allowlist blocks every other route and mutation method",async()=>{
  const app=express();app.use("/api",diagnosticApiGate);app.use((_req,res)=>{res.json({allowed:true});});
  const server=app.listen(0);await new Promise<void>(r=>server.listening?r():server.once("listening",r));
  const base="http://127.0.0.1:"+(server.address() as {port:number}).port;
  try{
    for(const path of ["/startup","/healthz","/admin/career/schema-diagnostic"])
      assert.equal((await fetch(base+"/api"+path)).status,200);
    for(const path of ["/auth/login","/admin/verify-pin","/career/saves","/broadcast","/healthz/tables",
      "/admin/career/schema-diagnostic/extra"]){
      for(const method of ["GET","POST"])assert.equal((await fetch(base+"/api"+path,{method})).status,503);
    }
    assert.equal((await fetch(base+"/api/admin/career/schema-diagnostic",{method:"POST"})).status,503);
  }finally{await new Promise<void>(r=>server.close(()=>r()));}
});

test("real PG session store cannot save, touch, destroy, prune or delete malformed sessions in diagnostic mode",async()=>{
  const queries:string[]=[];
  const pool={query:async(text:string)=>{
    queries.push(text);return {rows:[{sess:"invalid-stored-session-json"}]};
  }} as unknown as NonNullable<connectPg.PGStoreOptions["pool"]>;
  const Store=createReadOnlyDiagnosticStore(connectPg(session));
  const store=new Store({pool,createTableIfMissing:true,pruneSessionInterval:1,disableTouch:false});
  const data={} as SessionData;
  const capture=(work:(callback:(error?:unknown)=>void)=>void)=>new Promise<unknown>(r=>work(r));
  assert.ok(await capture(cb=>store.set("sid",data,cb)) instanceof Error);
  assert.ok(await capture(cb=>store.destroy("sid",cb)) instanceof Error);
  assert.ok(await capture(cb=>store.pruneSessions(cb)) instanceof Error);
  await new Promise<void>(r=>store.touch("sid",data,r));
  assert.equal(queries.length,0);
  assert.ok(await capture(cb=>store.get("sid",cb)) instanceof Error);
  assert.equal(queries.length,1);assert.match(queries[0],/^SELECT sess /);
  await store.close();
});

test("built application starts without a DB connection and full admin diagnostics preserve sessions/schema",
  {skip:!process.env.CAREER_CERT_PG_SOCKET},async()=>{
    const fixture=new PGlite();
    const name=(fixture as unknown as {name:string}).name;
    const socket=process.env.CAREER_CERT_PG_SOCKET!;
    assert.match(name,/^career_cert_[a-f0-9]{32}$/);
    assert.ok(socket.startsWith("/tmp/tkdl-certification/"));
    const secret="isolated-test-session-secret",cookie={originalMaxAge:86400000,
      expires:new Date(Date.now()+86400000).toISOString(),secure:true,httpOnly:true,path:"/",sameSite:"strict"};
    await fixture.exec("CREATE TABLE sessions(sid varchar PRIMARY KEY,sess json NOT NULL,expire timestamp NOT NULL)");
    for(const [sid,data] of [
      ["admin",{cookie,userId:1,playerId:1,isAdmin:true}],
      ["nonadmin",{cookie,userId:2,playerId:2,isAdmin:false}],
      ["legacy",{cookie,userId:1,isAdmin:true}],
      ["malformed","invalid-stored-session-json"],
    ])await fixture.query("INSERT INTO sessions VALUES($1,$2::jsonb,NOW()+INTERVAL '1 day')",[sid,JSON.stringify(data)]);
    const snapshot=async()=>(await fixture.query(`SELECT sid,sess::text,expire::text FROM sessions ORDER BY sid`)).rows;
    const before=await snapshot();
    const reserve=createServer();await new Promise<void>(r=>reserve.listen(0,"127.0.0.1",r));
    const port=(reserve.address() as {port:number}).port;await new Promise<void>(r=>reserve.close(()=>r()));
    const url=new URL("postgres://runner@localhost/"+name);
    url.searchParams.set("host",socket);url.searchParams.set("port","5442");
    // Defense in depth in this test: any overlooked startup/session write fails.
    url.searchParams.set("options","-c default_transaction_read_only=on");
    const bundle=fileURLToPath(new URL("../../../dist/index.mjs",import.meta.url));
    const child=spawn(process.execPath,[bundle],{env:{...process.env,NODE_ENV:"production",PORT:String(port),
      DATABASE_URL:url.toString(),SESSION_SECRET:secret,TKDL_DIAGNOSTIC_ONLY:"1"},stdio:["ignore","pipe","pipe"]});
    let logs="";child.stdout.on("data",b=>{logs+=b.toString();});child.stderr.on("data",b=>{logs+=b.toString();});
    const base="http://127.0.0.1:"+port;
    const cookieFor=(sid:string)=>"tkdl.sid="+encodeURIComponent("s:"+sid+"."+
      createHmac("sha256",secret).update(sid).digest("base64").replace(/=+$/,""));
    try{
      let ready=false;
      for(let attempt=0;attempt<120;attempt++){
        try{
          const response=await fetch(base+"/api/startup");
          const status=await response.json() as {ready:boolean;diagnosticOnly:boolean};
          if(status.ready){assert.equal(status.diagnosticOnly,true);ready=true;break;}
        }catch{}
        await new Promise(r=>setTimeout(r,50));
      }
      assert.ok(ready,"Diagnostic startup must become ready without schema/bootstrap initialization");
      // No child connection exists before the first authenticated request:
      // even read/bootstrap preflight queries would have opened one.
      const connections=await fixture.query<{count:number}>(`SELECT count(*)::int AS count FROM pg_stat_activity
        WHERE datname=$1 AND pid<>pg_backend_pid()`,[name]);
      assert.equal(connections.rows[0].count,0);
      assert.equal((await fetch(base+"/api/healthz")).status,200);
      const path="/api/admin/career/schema-diagnostic";
      assert.equal((await fetch(base+path)).status,403);
      assert.equal((await fetch(base+path,{headers:{cookie:cookieFor("nonadmin")}})).status,403);
      for(const sid of ["admin","legacy"]){
        const response=await fetch(base+path,{headers:{cookie:cookieFor(sid)}});
        assert.equal(response.status,200);
        const report=await response.json() as {transaction:{read_only:string};signals:{missingTables:string[]}};
        assert.equal(report.transaction.read_only,"on");assert.equal(report.signals.missingTables.length,43);
      }
      assert.equal((await fetch(base+path,{headers:{cookie:cookieFor("malformed")}})).status,500);
      for(const path of ["/api/career/saves","/api/admin/verify-pin","/api/auth/login","/api/broadcast"])
        assert.equal((await fetch(base+path,{method:"POST",headers:{cookie:cookieFor("admin")}})).status,503);
      assert.deepEqual(await snapshot(),before);
      const tables=await fixture.query<{tablename:string}>("SELECT tablename FROM pg_tables WHERE schemaname='public'");
      assert.deepEqual(tables.rows.map(r=>r.tablename),["sessions"]);
      assert.ok(!logs.includes("TKDL initialization failed"));
      assert.ok(!logs.includes("Scheduled broadcast edition check failed"));
      assert.ok(!logs.includes("Startup step"));
      assert.ok(!logs.includes("Deferred runtime startup"));
    }finally{
      child.kill("SIGTERM");
      await new Promise<void>(r=>{
        if(child.exitCode!==null||child.signalCode!==null){r();return;}
        const timeout=setTimeout(()=>{child.kill("SIGKILL");},3000);
        child.once("exit",()=>{clearTimeout(timeout);r();});
      });
      await fixture.close();
    }
  });
