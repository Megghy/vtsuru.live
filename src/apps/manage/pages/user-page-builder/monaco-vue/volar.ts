import { activateAutoInsertion, activateMarkers, registerProviders } from '@volar/monaco'
import type { WorkerLanguageService } from '@volar/monaco/worker'
import * as monaco from 'monaco-editor'
import { createWebWorker } from 'monaco-editor/internal/common/workers.js'

import { VTSURU_SANDBOX_DTS } from '@/apps/user-page/runtime/customHtmlBridge'

let setup: Promise<void> | null = null

function onFetchCdnFile(uri: string, text: string) {
  const parsed = monaco.Uri.parse(uri)
  if (!monaco.editor.getModel(parsed)) monaco.editor.createModel(text, 'typescript', parsed)
}

function syncUris() {
  return monaco.editor.getModels().map((model) => model.uri).filter((uri) => uri.scheme === 'file')
}

export function activateCustomHtmlVolar() {
  setup ??= (async () => {
    const envUri = monaco.Uri.parse('file:///env.d.ts')
    if (!monaco.editor.getModel(envUri)) monaco.editor.createModel(VTSURU_SANDBOX_DTS, 'typescript', envUri)
    const worker = createWebWorker({
      label: 'vue',
      keepIdleModels: true,
      host: { onFetchCdnFile },
      createData: {
        tsconfig: {},
        dependencies: {
          vue: '3.5.44',
          '@vue/compiler-core': '3.5.44',
          '@vue/compiler-dom': '3.5.44',
          '@vue/compiler-sfc': '3.5.44',
          '@vue/reactivity': '3.5.44',
          '@vue/runtime-core': '3.5.44',
          '@vue/runtime-dom': '3.5.44',
          '@vue/shared': '3.5.44',
          '@vue/language-core': '3.3.14',
          typescript: '6.0.3',
        },
      },
    }) as monaco.editor.MonacoWebWorker<WorkerLanguageService>
    activateMarkers(worker, ['vue', 'javascript', 'typescript'], 'vue', syncUris, monaco.editor)
    activateAutoInsertion(worker, ['vue', 'javascript', 'typescript'], syncUris, monaco.editor)
    await registerProviders(worker, ['vue', 'javascript', 'typescript'], syncUris, monaco.languages)
  })()
  return setup
}
