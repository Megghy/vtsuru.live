declare module 'vue3-aplayer' {
  const content: any
  export = content
}
declare module 'file-saver' {
  export function saveAs(blob: Blob | null | undefined, fileName: string): void
}

declare module '*.js' {
  const content: any
  export = content
}

// Vite worker 与样式类型声明
declare module '*?worker' {
  const workerConstructor: { new (): Worker }
  export default workerConstructor
}
declare module '*.css' {
  const content: string
  export default content
}
