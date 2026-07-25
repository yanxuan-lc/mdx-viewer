import test from "node:test";
import assert from "node:assert/strict";
import { buildLocalizedDocumentUrl, resolveLocalDocumentLink } from "../src/app/local-document-links.mjs";

test("B2: resolves POSIX relative MDX targets and preserves their query and fragment", () => {
  assert.deepEqual(
    resolveLocalDocumentLink("/docs/guide/links.mdx", "../target.mdx?view=print#overview"),
    { document: "/docs/target.mdx", search: "?view=print", hash: "#overview" },
  );
});

test("B2: resolves Windows relative MDX targets into Windows physical paths", () => {
  assert.deepEqual(
    resolveLocalDocumentLink(String.raw`C:\docs\guide\links.mdx`, "../target.mdx"),
    { document: String.raw`C:\docs\target.mdx`, search: "", hash: "" },
  );
});

test("B3: creates an internal document URL with the target query and fragment intact", () => {
  assert.equal(
    buildLocalizedDocumentUrl("http://localhost:4321/?doc=%2Fdocs%2Fold.mdx&stale=true", "/docs/target.zh-CN.mdx", "?view=print", "#overview"),
    "http://localhost:4321/?view=print&doc=%2Fdocs%2Ftarget.zh-CN.mdx#overview",
  );
});
