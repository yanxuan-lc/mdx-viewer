/** 由 Vite define 注入（见 src/cli/vite-config.mjs）。 */
declare const __MDXV_VERSION__: string;
declare const __MDXV_LICENSE__: string;

/** dev 下 Vite 注入的 HMR 客户端；这里只声明用得到的自定义事件订阅（build 时为 undefined）。 */
interface ImportMeta {
  readonly hot?: { on(event: string, callback: (payload: unknown) => void): void };
}

declare module "virtual:mdxv-config" {
  const config: {
    mode: "file" | "dir";
    firstDoc?: string;
    initialLocale: "zh-CN" | "en-US";
    localeSource: "argument" | "environment" | "system" | "fallback";
  };
  export default config;
}
declare module "virtual:mdx-target" {
  const Content: (props: any) => any;
  export default Content;
  export const frontmatter: Record<string, any>;
}
