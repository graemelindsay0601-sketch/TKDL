/**
 * Optional test-only loader: run unchanged PGlite tests on isolated native PG16.
 * Never imported by the application or production build. Requires a private
 * /tmp/tkdl-certification/... Unix socket; no network/production URL is accepted.
 */
import {registerHooks} from "node:module";
const url=new URL("./career-cert-postgres-fixture.mjs",import.meta.url).href;
registerHooks({resolve(specifier,context,nextResolve){
  if(specifier==="@electric-sql/pglite"||specifier==="drizzle-orm/pglite")return {url,shortCircuit:true};
  // Legacy Classic seed uses an extensionless TS import; application bundling
  // already resolves it. This test-only bridge makes the same import runnable.
  if(specifier==="./logger"&&context.parentURL?.endsWith("/lib/tourSeed.ts"))return nextResolve("./logger.ts",context);
  return nextResolve(specifier,context);
}});
