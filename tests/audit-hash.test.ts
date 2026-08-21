import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, createAuditContentHash } from "../lib/audit-hash.ts";

test("hash auditável não depende da ordem das chaves", async () => {
  assert.equal(canonicalJson({ b: 2, a: 1 }), canonicalJson({ a: 1, b: 2 }));
  assert.equal(await createAuditContentHash({ b: 2, a: 1 }), await createAuditContentHash({ a: 1, b: 2 }));
});

test("hash muda quando uma entrada técnica muda", async () => {
  assert.notEqual(await createAuditContentHash({ targetFp: 0.92 }), await createAuditContentHash({ targetFp: 0.95 }));
});
