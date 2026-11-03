import { createNpmFileSystem } from '@volar/jsdelivr'
import {
  createTypeScriptWorkerLanguageService,
  type LanguageServiceEnvironment,
  WorkerLanguageService,
} from '@volar/monaco/worker'
import {
  createVueLanguagePlugin,
  getDefaultCompilerOptions,
  VueVirtualCode,
  type VueCompilerOptions,
} from '@vue/language-core'
import { createVueLanguageServicePlugins, type LanguageService } from '@vue/language-service'
import { postprocessLanguageService, preprocessLanguageService } from '@vue/typescript-plugin/lib/common'
import { getComponentDirectives } from '@vue/typescript-plugin/lib/requests/getComponentDirectives'
import { getComponentNames } from '@vue/typescript-plugin/lib/requests/getComponentNames'
import { getComponentProps } from '@vue/typescript-plugin/lib/requests/getComponentProps'
import { getComponentSlots } from '@vue/typescript-plugin/lib/requests/getComponentSlots'
import { getElementAttrs } from '@vue/typescript-plugin/lib/requests/getElementAttrs'
import { getElementNames } from '@vue/typescript-plugin/lib/requests/getElementNames'
import { isRefAtPosition } from '@vue/typescript-plugin/lib/requests/isRefAtPosition'
import { initialize } from 'monaco-editor/internal/common/initialize'
import ts from 'typescript'
import { create as createTypeScriptSemanticPlugin } from 'volar-service-typescript/lib/plugins/semantic'
import { URI } from 'vscode-uri'

import propsFallbackDts from '@vue/language-core/types/props-fallback.d.ts?raw'
import templateHelpersDts from '@vue/language-core/types/template-helpers.d.ts?raw'
import vue34ShimsDts from '@vue/language-core/types/vue-3.4-shims.d.ts?raw'

export interface CreateData {
  tsconfig: {
    compilerOptions?: ts.CompilerOptions
    vueCompilerOptions?: Record<string, unknown>
  }
  dependencies: Record<string, string>
}

interface WorkerHost {
  onFetchCdnFile(uri: string, text: string): void
}

const VUE_TYPES_ROOT = '/node_modules/@vue/language-core/types'
const VUE_TYPE_FILES: Record<string, string> = {
  [`${VUE_TYPES_ROOT}/template-helpers.d.ts`]: templateHelpersDts,
  [`${VUE_TYPES_ROOT}/props-fallback.d.ts`]: propsFallbackDts,
  [`${VUE_TYPES_ROOT}/vue-3.4-shims.d.ts`]: vue34ShimsDts,
}
const TS_LIB_FILES: Record<string, string> = Object.fromEntries(
  Object.entries(
    import.meta.glob('../../../../../../node_modules/typescript/lib/lib.{es*,dom*}.d.ts', {
      eager: true,
      query: '?raw',
      import: 'default',
    }) as Record<string, string>,
  )
    .map(([id, content]) => [id.slice(id.lastIndexOf('/') + 1), content] as const)
    .filter(([name]) => !name.includes('.full.'))
    .map(([name, content]) => [`/node_modules/typescript/lib/${name}`, content]),
)
const IGNORE_PLUGINS = new Set([
  'emmet',
  'vue-template (jade)',
  'vue-extract-file',
  'vue-document-drop',
  'vue-document-highlights',
  'typescript-semantic-tokens',
])

const asFileName = (uri: URI) => uri.path
const asUri = (fileName: string) =>
  URI.from({
    scheme: 'file',
    authority: '',
    path: fileName.startsWith('/') ? fileName : `/${fileName}`,
    query: '',
    fragment: '',
  })

function createService(
  ctx: { host: unknown; getMirrorModels: () => unknown[] },
  createData: CreateData,
) {
  const compilerOptions: ts.CompilerOptions = {
    allowJs: true,
    checkJs: false,
    jsx: ts.JsxEmit.Preserve,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ESNext,
    lib: ['esnext', 'dom', 'dom.iterable'],
    types: [],
    ...createData.tsconfig.compilerOptions,
  }
  const vueCompilerOptions: VueCompilerOptions = {
    ...getDefaultCompilerOptions(99, 'vue', false, VUE_TYPES_ROOT),
    ...createData.tsconfig.vueCompilerOptions,
  }
  const npmFs = createNpmFileSystem(
    (uri) => {
      if (uri.path === '/node_modules') return ''
      if (uri.path.startsWith('/node_modules/')) return uri.path.slice('/node_modules/'.length)
    },
    (pkgName) => createData.dependencies[pkgName],
    (path, content) => (ctx.host as WorkerHost).onFetchCdnFile(`file:///node_modules/${path}`, content),
  )
  const env: LanguageServiceEnvironment = {
    workspaceFolders: [URI.parse('file:///')],
    fs: {
      stat(uri) {
        const local = VUE_TYPE_FILES[uri.path] ?? TS_LIB_FILES[uri.path]
        if (local) return { type: 1, ctime: 0, mtime: 0, size: local.length }
        return npmFs.stat(uri)
      },
      readDirectory: (uri) => npmFs.readDirectory(uri),
      readFile(uri, encoding) {
        const local = VUE_TYPE_FILES[uri.path] ?? TS_LIB_FILES[uri.path]
        if (local) return local
        return npmFs.readFile(uri, encoding)
      },
    },
  }

  const workerService = createTypeScriptWorkerLanguageService({
    typescript: ts,
    compilerOptions,
    workerContext: ctx as never,
    env,
    uriConverter: { asFileName, asUri },
    languagePlugins: [createVueLanguagePlugin(ts, compilerOptions, vueCompilerOptions, asFileName)],
    languageServicePlugins: [...getTsLanguageServicePlugins(), ...getVueLanguageServicePlugins()],
  })
  return workerService

  function getTsLanguageServicePlugins() {
    const semanticPlugin = createTypeScriptSemanticPlugin(ts)
    const { create } = semanticPlugin
    semanticPlugin.create = (context) => {
      const created = create(context)
      const ls = created.provide['typescript/languageService']() as ts.LanguageService
      const wrapped = postprocessLanguageService(
        ts,
        context.language,
        preprocessLanguageService(ts, ls, () => context.language),
        vueCompilerOptions,
        asUri,
      )
      created.provide['typescript/languageService'] = () => wrapped
      return created
    }
    return [semanticPlugin]
  }

  function getVueLanguageServicePlugins() {
    return createVueLanguageServicePlugins(ts, {
      getComponentDirectives(fileName) {
        return getComponentDirectives(ts, getProgram(), fileName)
      },
      getComponentNames(fileName) {
        return getComponentNames(ts, getProgram(), getVirtualCode(fileName).virtualCode)
      },
      getComponentProps(fileName, position) {
        const { sourceScript, virtualCode } = getVirtualCode(fileName)
        return getComponentProps(ts, getTs(), getProgram(), getLanguage().context.language as never, sourceScript as never, virtualCode, position)
      },
      getComponentSlots(fileName) {
        return getComponentSlots(ts, getProgram(), getVirtualCode(fileName).virtualCode)
      },
      getElementAttrs(fileName, tag) {
        return getElementAttrs(ts, getProgram(), fileName, tag)
      },
      getElementNames(fileName) {
        return getElementNames(ts, getProgram(), fileName)
      },
      isRefAtPosition(fileName, position) {
        const { sourceScript, virtualCode } = getVirtualCode(fileName)
        return isRefAtPosition(ts, getLanguage().context.language as never, getProgram(), sourceScript as never, virtualCode, position)
      },
      getQuickInfoAtPosition() {
        return null
      },
      collectExtractProps() {
        return null
      },
      getImportPathForFile() {
        return null
      },
      getComponentMeta() {
        return null
      },
      resolveModuleName() {
        return null
      },
      getDocumentHighlights() {
        return null
      },
      getEncodedSemanticClassifications() {
        return null
      },
      getAutoImportSuggestions() {
        return null
      },
      resolveAutoImportCompletionEntry() {
        return null
      },
    }).filter((plugin) => !IGNORE_PLUGINS.has(plugin.name ?? '')).map((plugin) => {
      if (!plugin.name?.startsWith('vue-template')) return plugin
      const create = plugin.create.bind(plugin)
      return {
        ...plugin,
        create(context) {
          try {
            const instance = create(context)
            return instance?.provide ? instance : { dispose() {} }
          } catch {
            return { dispose() {} }
          }
        },
      }
    })
  }

  function getVirtualCode(fileName: string) {
    const sourceScript = getLanguage().context.language.scripts.get(asUri(fileName))
    const virtualCode = sourceScript?.generated?.root
    if (!sourceScript || !(virtualCode instanceof VueVirtualCode)) {
      throw new Error(`No Vue virtual code for ${fileName}`)
    }
    return { sourceScript, virtualCode }
  }

  function getTs() {
    return getLanguage().context.inject('typescript/languageService') as ts.LanguageService
  }

  function getProgram() {
    return getTs().getProgram()!
  }

  function getLanguage() {
    return (workerService as WorkerLanguageService).languageService as LanguageService
  }
}

function lazyForeignModule(factory: () => object) {
  let instance: object | undefined
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') return undefined
        instance ??= factory()
        const value = Reflect.get(instance, prop)
        return typeof value === 'function' ? value.bind(instance) : value
      },
    },
  )
}

self.onmessage = () => {
  initialize((ctx, createData: CreateData) => lazyForeignModule(() => createService(ctx, createData)))
}
