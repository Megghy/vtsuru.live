import vueRuntime from 'vue/dist/vue.runtime.global.prod.js?raw'
import sandboxLibs from 'virtual:custom-html-sandbox-libs'

import { FILE_BASE_URL, getCurrentAPIUrl } from '@/shared/config'

import { createSandboxSdkSource } from '../runtime/customHtmlBridge'
import type { CustomHtmlProps } from './customHtmlContract'
import type { CompiledCustomVueOutput, CustomHtmlTheme } from './customHtmlRuntime'
import { inspectCustomCss, resolveCustomHtmlAssetMap } from './customHtmlRuntime'

function escapeStyleText(value: string) {
  return value.replaceAll('<', '\\3C ')
}

function escapeScriptText(value: string) {
  return value.replace(/<\/script/gi, '<\\/script')
}

function escapeCssString(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replace(/[\r\n\f]/g, '')
}

function createNonce() {
  return crypto.randomUUID().replaceAll('-', '')
}

function imageSources(props: CustomHtmlProps) {
  const urls = [...resolveCustomHtmlAssetMap(props.assets).values()].map((file) => {
    const url = new URL(file.path, location.href)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid asset URL')
    return url.href.replace(/[?#].*$/, '')
  })
  return ['data:', 'blob:', 'https://*.hdslb.com', FILE_BASE_URL, new URL('/f/', getCurrentAPIUrl()).href, ...urls].join(
    ' ',
  )
}

export function buildCustomHtmlDocument(
  props: CustomHtmlProps,
  theme: CustomHtmlTheme,
  compiled: CompiledCustomVueOutput,
) {
  const files = resolveCustomHtmlAssetMap(props.assets)
  const cssResult = inspectCustomCss(compiled.css, props.assets)
  const themeVariables = [
    `--foreground:${theme.fg}`,
    `--muted-foreground:${theme.fgMuted}`,
    `--background:${theme.bg}`,
    `--popover:${theme.bgElevated}`,
    `--border:${theme.border}`,
    `--primary:${theme.primary}`,
    `--primary-readable:${theme.primaryReadable}`,
    `--radius:${theme.radius}`,
    `--border-width:${theme.borderWidth ?? '1px'}`,
    `--border-style:${theme.borderStyle ?? 'solid'}`,
    `--ui-shadow:${theme.shadow ?? 'none'}`,
    [...files].map(([key, file]) => `--vtsuru-asset-${key}:url("${escapeCssString(file.path)}")`).join(';'),
  ]
    .filter(Boolean)
    .join(';')
  const nonce = createNonce()
  const channelId = createNonce()
  const assets = Object.fromEntries([...files].map(([key, file]) => [key, file.path]))
  const bridge = `(()=>{let frame=0;const send=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>vtsuru.reportHeight(Math.ceil(Math.max(document.body.scrollHeight,document.body.getBoundingClientRect().height))))};new ResizeObserver(send).observe(document.body);addEventListener('load',send);send()})()`
  const reportError = `(()=>{const send=error=>parent.postMessage({__vtsuruBridge:true,channelId:${JSON.stringify(channelId)},direction:'error',error:String(error)},'*');addEventListener('error',event=>send(event.message));addEventListener('unhandledrejection',event=>send(event.reason))})()`
  const baseCss = `:root{${themeVariables};color-scheme:${theme.colorScheme}}*{box-sizing:border-box}html,body{min-width:0;margin:0;padding:0}body{color:var(--foreground);background:transparent;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:0.875rem;line-height:1.5;overflow-wrap:anywhere}img{max-width:100%;height:auto}a{color:var(--primary-readable)}#app{min-height:inherit}@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}`

  return {
    issues: cssResult.issues,
    channelId,
    srcdoc: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${imageSources(props)}; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src 'none'; font-src https://fonts.gstatic.com data:; media-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'"><style>${escapeStyleText(baseCss)}\n${escapeStyleText(cssResult.css)}</style></head><body><div id="app"></div><script nonce="${nonce}">${escapeScriptText(vueRuntime)}</script><script nonce="${nonce}">${escapeScriptText(sandboxLibs)}</script><script nonce="${nonce}">${createSandboxSdkSource(channelId, assets)}</script><script nonce="${nonce}">${reportError}</script><script nonce="${nonce}">${bridge}</script><script nonce="${nonce}">${escapeScriptText(compiled.js)}</script></body></html>`,
  }
}
