import { createServer } from "vite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildConfig } from "../src/cli/vite-config.mjs";

const [, , state, locale, portValue] = process.argv;
const port = Number(portValue);

if (!(["directory", "select"].includes(state) && ["zh-CN", "en-US"].includes(locale) && Number.isInteger(port))) {
  throw new Error("Usage: node e2e/empty-state-server.mjs <directory|select> <zh-CN|en-US> <port>");
}

// "directory"（目录里一篇都没有）必须指向真的空目录：/__mdxv/tree 在 dev 下现扫磁盘，
// 拿 e2e/fixtures 配 files: [] 已经骗不过去了。"select" 仍用 fixtures，靠下面的插件覆写树。
const config = buildConfig({
  mode: "dir",
  root: `${process.cwd()}/e2e/${state === "directory" ? "empty-fixtures" : "fixtures"}`,
  files: [],
  initialLocale: locale,
  localeSource: "argument",
  version: "1.0.0",
  license: "MIT",
});

if (state === "select") {
  const fixture = `${process.cwd()}/e2e/fixtures/index.mdx`;
  config.plugins.unshift({
    name: "e2e-no-default-document",
    resolveId(id) {
      if (id === "virtual:mdxv-config") return "\0virtual:mdxv-config";
      return null;
    },
    load(id) {
      if (id === "\0virtual:mdxv-config") {
        return `export default ${JSON.stringify({ mode: "dir", firstDoc: undefined, initialLocale: locale, localeSource: "argument" })}`;
      }
      return null;
    },
    configureServer(server) {
      server.middlewares.use("/__mdxv/tree", (_request, response) => {
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify([{ abs: fixture, rel: "index.mdx", dir: "" }]));
      });
    },
  });
}

const server = await createServer({
  ...config,
  cacheDir: join(tmpdir(), `mdxv-e2e-vite-${port}`),
  server: { ...config.server, host: "localhost", port },
});
await server.listen();
