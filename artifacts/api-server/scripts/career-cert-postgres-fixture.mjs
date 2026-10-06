import {randomUUID} from "node:crypto";
import {createRequire} from "node:module";
import {drizzle as nativeDrizzle} from "drizzle-orm/node-postgres";
const require=createRequire(import.meta.url);
const {Pool,Client}=require(createRequire(require.resolve("drizzle-orm/node-postgres")).resolve("pg"));
const host=process.env.CAREER_CERT_PG_SOCKET;
if(!host?.startsWith("/tmp/tkdl-certification/"))throw new Error("Test-only PostgreSQL requires private certification Unix socket");
const config={host,port:5442,user:"runner",connectionTimeoutMillis:30000,
  ...(process.env.CAREER_CERT_PG_DEBUG?{options:"-c statement_timeout=30000 -c lock_timeout=15000"}:{})};
export class PGlite {
  constructor(){
    this.name=`career_cert_${randomUUID().replaceAll("-","")}`;
    const trace=message=>{if(process.env.CAREER_CERT_PG_DEBUG)console.error(`Native PG fixture: ${message}`);};
    trace("constructed");
    this.pool=new Pool({...config,database:this.name,max:4});
    this.ready=null;
    const start=()=>this.ready??=(async()=>{
      trace("connecting");
      const admin=new Client({...config,database:"postgres"});
      await admin.connect();
      trace("connected");
      try{await admin.query(`CREATE DATABASE "${this.name}"`);}finally{await admin.end();}
      trace("database ready");
    })();
    const query=this.pool.query.bind(this.pool),connect=this.pool.connect.bind(this.pool);
    this.pool.query=async(...args)=>{await start();return query(...args);};
    this.pool.connect=async(...args)=>{await start();return connect(...args);};
  }
  async query(text,params=[]){
    const r=await this.pool.query(text,params);
    return {...r,affectedRows:r.rowCount};
  }
  async exec(text){
    const r=await this.pool.query(text);
    return Array.isArray(r)?r:[r];
  }
  async close(){
    if(!this.ready){await this.pool.end();return;}
    await this.ready;await this.pool.end();
    const admin=new Client({...config,database:"postgres"});await admin.connect();
    try{await admin.query(`DROP DATABASE IF EXISTS "${this.name}" WITH(FORCE)`);}finally{await admin.end();}
  }
}
export function drizzle(fixture,options){return nativeDrizzle(fixture.pool,options);}
