/* ============================================================
   mdx-viewer · MDXProvider 组件映射表（OCP 扩展位）
   —— 标准 markdown 元素已由 .mv-md 的 CSS 上妆，通常无需覆写；
      这里登记自定义标签 → 组件。新增组件在此加一行即可。
   ============================================================ */
import * as B from "./components/blocks";
import { Math, Footer, Colophon } from "./components/client";

export const mdxComponents = {
  Hero: B.Hero,
  Section: B.Section,
  Callout: B.Callout,
  Card: B.Card,
  Columns: B.Columns,
  Toggle: B.Toggle,
  Steps: B.Steps,
  Step: B.Step,
  Stats: B.Stats,
  Stat: B.Stat,
  Fields: B.Fields,
  Field: B.Field,
  Scenario: B.Scenario,
  When: B.When,
  And: B.And,
  Then: B.Then,
  Grid: B.Grid,
  Item: B.Item,
  Figure: B.Figure,
  Badge: B.Badge,
  Code: B.Code,
  Math,
  Footer,
  Colophon,
};
