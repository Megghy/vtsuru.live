/* eslint-disable */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '*.md' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export const frontmatter: Record<string, any>
  export default component
}

declare module '*?raw' {
  const content: string
  export default content
}

declare module '*?doc-meta' {
  const meta: Record<string, any>
  export default meta
}

declare module 'virtual:custom-html-sandbox-libs' {
  const content: string
  export default content
}
