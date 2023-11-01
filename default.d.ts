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