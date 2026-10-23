import { defineConfig } from 'orval'

const BINARY_PATH =
  /\/api\/tts\/(azure|mimo|synthesize|mimo\/preview|mimo\/custom)$|\/api\/schedule\/\{id\}\.ics$|\/api\/vtsuru\/gen-face\//

const EXTRA_MEDIA = new Set(['text/json', 'text/plain', 'application/*+json'])

function stripExtraMedia(content?: Record<string, unknown>) {
  if (!content) return
  for (const type of Object.keys(content)) {
    if (EXTRA_MEDIA.has(type)) delete content[type]
  }
}

function transformSpec(spec: { paths?: Record<string, Record<string, any>> }) {
  if (!spec.paths) return spec
  for (const path of Object.keys(spec.paths)) {
    if (BINARY_PATH.test(path)) {
      delete spec.paths[path]
      continue
    }
    const item = spec.paths[path]
    for (const op of Object.values(item ?? {})) {
      if (!op || typeof op !== 'object') continue
      stripExtraMedia(op.requestBody?.content)
      if (!op.responses) continue
      for (const response of Object.values(op.responses) as { content?: Record<string, unknown> }[]) {
        stripExtraMedia(response?.content)
      }
    }
  }
  return spec
}

export default defineConfig({
  vtsuru: {
    input: {
      target: './openapi.json',
      override: {
        transformer: transformSpec,
      },
    },
    output: {
      mode: 'tags-split',
      target: 'src/api/generated/endpoints.ts',
      schemas: 'src/api/generated/model',
      client: 'fetch',
      indexFiles: true,
      prettier: false,
      override: {
        enumGenerationType: 'enum',
        mutator: {
          path: './src/api/orval-mutator.ts',
          name: 'vtsuruMutator',
        },
        fetch: {
          includeHttpResponseReturnType: false,
        },
      },
    },
  },
})
