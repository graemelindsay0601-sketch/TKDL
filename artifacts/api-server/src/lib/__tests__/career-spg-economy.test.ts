import test from "node:test";
import assert from "node:assert/strict";
import {calculateProductWeek,PRODUCT_ECONOMY} from "../../career/content/product-economy.ts";

test("SP-G sales are deterministic, capped, and use penny-exact 8% royalties",()=>{
  const sale=calculateProductWeek("product-a","SIGNATURE_DARTS",2,7);
  assert.deepEqual(sale,calculateProductWeek("product-a","SIGNATURE_DARTS",2,7));
  assert.ok(sale.units>=8&&sale.units<=34&&sale.units<=PRODUCT_ECONOMY.weeklyUnitCap);
  assert.equal(sale.grossPence,sale.units*6999);
  assert.equal(sale.royaltyPence,Math.floor(sale.grossPence*0.08));
});

test("limited runs cannot sell beyond remaining edition stock",()=>{
  const sale=calculateProductWeek("limited-a","SIGNATURE_RANGE",1,1,3);
  assert.equal(sale.units,3);
  assert.equal(sale.grossPence,3*2499);
  assert.equal(calculateProductWeek("limited-a","SIGNATURE_RANGE",1,1,0).units,0);
});
