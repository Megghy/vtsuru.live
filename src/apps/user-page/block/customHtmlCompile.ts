import { compileScript, compileStyle, compileTemplate, parse } from 'vue/compiler-sfc'
import { transform } from 'sucrase'

import { CUSTOM_HTML_ALLOWED_IMPORTS } from './customHtmlContract'
import type { CustomCodeIssue } from './customHtmlRuntime'

const FILENAME = 'App.vue'
const ALLOWED_IMPORT_HINT = Object.keys(CUSTOM_HTML_ALLOWED_IMPORTS)
  .map((spec) => `'${spec}'`)
  .join(' / ')

export interface CompiledCustomVue {
  js: string
  css: string
  issues: CustomCodeIssue[]
}

export function compileCustomVueSfc(source: string): CompiledCustomVue {
  const issues: CustomCodeIssue[] = []
  if (!source.trim()) return { js: '', css: '', issues }

  const { descriptor, errors } = parse(rewriteAssetAttrs(ensureScript(source)), { filename: FILENAME })
  for (const error of errors) issues.push(mapError(error))

  const langs = [descriptor.script?.lang, descriptor.scriptSetup?.lang, ...descriptor.styles.map((style) => style.lang)]
  if (langs.some((lang) => lang && !['js', 'ts', 'css'].includes(lang))) {
    issues.push(issue('仅支持 <script> js/ts 与 <style> css'))
  }
  if (descriptor.customBlocks.length) issues.push(issue('不支持自定义块'))

  const id = `data-v-${fnv1a(source)}`
  let script = ''
  try {
    if (descriptor.script || descriptor.scriptSetup) {
      const compiled = compileScript(descriptor, {
        id,
        isProd: true,
        inlineTemplate: true,
        genDefaultAs: '__sfc__',
        fs: { fileExists: () => false, readFile: () => undefined },
      })
      script = compiled.content
      const lang = compiled.lang || descriptor.scriptSetup?.lang || descriptor.script?.lang
      if (lang === 'ts') script = transform(script, { transforms: ['typescript'] }).code
    } else if (descriptor.template) {
      const compiled = compileTemplate({
        source: descriptor.template.content,
        filename: FILENAME,
        id,
        scoped: descriptor.styles.some((style) => style.scoped),
      })
      for (const error of compiled.errors) issues.push(mapError(error))
      script = `${compiled.code}\nconst __sfc__ = { render }`
    }
  } catch (error) {
    issues.push(mapError(error))
  }

  const rewritten = rewriteAllowedImports(script)
  if (rewritten.error) issues.push(issue(rewritten.error))

  const cssParts: string[] = []
  for (const style of descriptor.styles) {
    const compiled = compileStyle({ source: style.content, filename: FILENAME, id, scoped: style.scoped })
    cssParts.push(compiled.code)
    for (const error of compiled.errors) issues.push(mapError(error))
  }

  return {
    js: issues.length || !rewritten.code.trim() ? '' : wrapMount(rewritten.code),
    css: cssParts.join('\n'),
    issues,
  }
}

function ensureScript(source: string) {
  return /<script\b/i.test(source) ? source : `${source}\n<script setup lang="ts">\n</script>`
}

function rewriteAssetAttrs(source: string) {
  return source.replace(/<template\b([^>]*)>([\s\S]*?)<\/template>/i, (_full, attrs: string, inner: string) => {
    const next = inner.replace(/<(img|source|video|audio|image)\b([^>]*?)(\s*\/?)>/gi, (tag, name, rest, close) => {
      if (!/\bdata-vtsuru-asset\s*=/.test(rest) || /\s(?::src|v-bind:src)\b/.test(rest)) return tag
      const key = rest.match(/data-vtsuru-asset\s*=\s*(["'])(.*?)\1/)?.[2]
      if (!key) return tag
      return `<${name}${rest} :src="vtsuru.getAssetUrl('${key}')"${close}>`
    })
    return `<template${attrs}>${next}</template>`
  })
}

function rewriteAllowedImports(code: string): { code: string; error?: string } {
  const other = [...code.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)]
    .map((match) => match[1])
    .find((spec) => !(spec in CUSTOM_HTML_ALLOWED_IMPORTS))
  if (other) return { code, error: `不支持导入 '${other}'，仅允许 from ${ALLOWED_IMPORT_HINT}` }

  const prelude: string[] = []
  let js = code.replace(/import\s+type\s+[\s\S]*?from\s*['"][^'"]+['"]\s*;?/g, '')
  for (const [spec, globalName] of Object.entries(CUSTOM_HTML_ALLOWED_IMPORTS)) {
    const escaped = spec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = new RegExp(
      String.raw`(?:import\s+(?:([A-Za-z_$][\w$]*)\s*,\s*)?\{([^}]+)\}\s*from\s*['"]${escaped}['"]\s*;?|import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s*from\s*['"]${escaped}['"]\s*;?|import\s+([A-Za-z_$][\w$]*)\s*from\s*['"]${escaped}['"]\s*;?|import\s*['"]${escaped}['"]\s*;?)`,
      'g',
    )
    js = js.replace(pattern, (_full, defaultWithNamed, specifiers, namespace, defaultOnly) => {
      const globalExpr = `globalThis.${globalName}`
      if (namespace) prelude.push(`const ${namespace} = ${globalExpr};`)
      if (defaultWithNamed || defaultOnly)
        prelude.push(`const ${defaultWithNamed || defaultOnly} = ${globalExpr}.default ?? ${globalExpr};`)
      if (specifiers) {
        const named: string[] = []
        for (const part of specifiers.split(',')) {
          const token = part.trim()
          if (!token) continue
          const [exported, local] = token.split(/\s+as\s+/).map((item: string) => item.trim())
          named.push(local && local !== exported ? `${exported}: ${local}` : exported)
        }
        if (named.length) prelude.push(`const { ${named.join(', ')} } = ${globalExpr};`)
      }
      return ''
    })
  }
  js = js.replace(/export\s+default\s+[\w$]+\s*;?/, '').replace(/^export\s+/gm, '')
  return { code: `${prelude.join('\n')}${prelude.length ? '\n' : ''}${js}` }
}

function wrapMount(code: string) {
  return `(function(){${code}\nif(typeof __sfc__==='undefined')throw new Error('Vue 组件编译失败');\nconst app=Vue.createApp(__sfc__);\napp.config.globalProperties.vtsuru=window.vtsuru;\napp.mount('#app');\n})()`
}

function fnv1a(input: string) {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16)
}

function mapError(error: unknown): CustomCodeIssue {
  if (error && typeof error === 'object' && 'message' in error) {
    const loc = (error as { loc?: { start: { line: number; column: number } }; message: string }).loc?.start
    return issue(String((error as { message: string }).message), loc?.line ?? 1, (loc?.column ?? 0) + 1)
  }
  return issue(String(error))
}

function issue(message: string, line = 1, column = 1): CustomCodeIssue {
  return { field: 'source', message, line, column }
}
