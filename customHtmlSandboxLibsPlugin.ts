import { build } from 'esbuild'
import type { Plugin } from 'vite'

export const CUSTOM_HTML_SANDBOX_LIBS_ID = 'virtual:custom-html-sandbox-libs'

export function customHtmlSandboxLibsPlugin(): Plugin {
  const resolved = `\0${CUSTOM_HTML_SANDBOX_LIBS_ID}`
  let cached = ''

  async function bundle() {
    const result = await build({
      absWorkingDir: process.cwd(),
      stdin: {
        contents: `import * as VueUse from '@vueuse/core'\nimport dayjs from 'dayjs'\nglobalThis.VueUse = VueUse\nglobalThis.dayjs = dayjs\n`,
        resolveDir: process.cwd(),
        sourcefile: 'custom-html-sandbox-libs.js',
      },
      bundle: true,
      write: false,
      format: 'iife',
      minify: true,
      platform: 'browser',
      target: ['es2020'],
      logLevel: 'silent',
      plugins: [
        {
          name: 'vue-global',
          setup(api) {
            api.onResolve({ filter: /^vue$/ }, () => ({ path: 'vue', namespace: 'vue-global' }))
            api.onLoad({ filter: /.*/, namespace: 'vue-global' }, () => ({
              contents: 'module.exports = Object.assign({ __esModule: true, default: globalThis.Vue }, globalThis.Vue)',
              loader: 'js',
            }))
          },
        },
      ],
    })
    cached = result.outputFiles[0].text
  }

  return {
    name: 'custom-html-sandbox-libs',
    async buildStart() {
      await bundle()
    },
    resolveId(id) {
      if (id === CUSTOM_HTML_SANDBOX_LIBS_ID) return resolved
    },
    load(id) {
      if (id === resolved) return `export default ${JSON.stringify(cached)}`
    },
  }
}
