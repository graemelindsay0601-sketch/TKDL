import type {RequestHandler} from "express";
import type connectPg from "connect-pg-simple";
import type {SessionData} from "express-session";

/** Explicit opt-in; a misspelled value must not accidentally run migrations. */
export function diagnosticStartupEnabled(value=process.env.TKDL_DIAGNOSTIC_ONLY):boolean {
  if(value===undefined||value==="0")return false;
  if(value==="1")return true;
  throw new Error("TKDL_DIAGNOSTIC_ONLY must be unset, 0 or 1");
}
export const diagnosticOnly=diagnosticStartupEnabled();

/** Normal routes can have writes even on GET; use an exact, small allowlist. */
export const diagnosticApiGate:RequestHandler=(req,res,next)=>{
  if(["GET","HEAD"].includes(req.method)&&
    ["/startup","/healthz","/admin/career/schema-diagnostic"].includes(req.path)) {
    next();return;
  }
  res.set("Cache-Control","no-store");
  res.status(503).json({error:"TKDL is temporarily in read-only diagnostic mode"});
};

/** Retain the real cookie/session lookup, but never create, repair or prune a session. */
export function createReadOnlyDiagnosticStore(Base:typeof connectPg.PGStore) {
  return class ReadOnlyDiagnosticStore extends Base {
    constructor(options?:connectPg.PGStoreOptions) {
      super({...options,createTableIfMissing:false,pruneSessionInterval:false,disableTouch:true});
    }
    override set(_sid:string,_session:SessionData,callback?:(err?:unknown)=>void):void {
      callback?.(new Error("Session writes disabled in diagnostic mode"));
    }
    override destroy(_sid:string,callback?:(err?:unknown)=>void):void {
      // Base.get() calls destroy() for malformed stored JSON. Fail closed,
      // preserving that row instead of letting a read request delete it.
      callback?.(new Error("Session deletion disabled in diagnostic mode"));
    }
    override touch(_sid:string,_session:SessionData,callback?:()=>void):void {callback?.();}
    override pruneSessions(callback?:(err:Error)=>void):void {
      callback?.(new Error("Session pruning disabled in diagnostic mode"));
    }
  };
}
