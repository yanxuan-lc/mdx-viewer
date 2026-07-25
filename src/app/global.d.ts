/** 由 Vite define 注入（见 src/cli/vite-config.mjs）。 */
declare const __MDXV_VERSION__: string;
declare const __MDXV_LICENSE__: string;

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
