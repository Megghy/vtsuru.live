import { describe, expect, it } from 'vitest'

import { compileCustomVueSfc } from '../customHtmlCompile'
import { DEFAULT_CUSTOM_VUE_SOURCE } from '../customHtmlContract'
import { CUSTOM_CODE_TEMPLATES } from '../customHtmlTemplates'

describe('compileCustomVueSfc', () => {
  it('compiles script setup and template into a Vue.createApp runner', () => {
    const result = compileCustomVueSfc(`<script setup>
import { ref } from 'vue'
const count = ref(0)
</script>
<template>
  <button @click="count++">{{ count }}</button>
</template>
<style>
button { color: var(--foreground); }
</style>`)

    expect(result.issues).toEqual([])
    expect(result.js).toContain('Vue.createApp')
    expect(result.js).toMatch(/\bref\b/)
    expect(result.js).not.toContain("from 'vue'")
    expect(result.css).toContain('button')
  })

  it('rewrites bound assets in the template', () => {
    const result = compileCustomVueSfc(
      `<template><img data-vtsuru-asset="cover" alt=""></template>`,
    )
    expect(result.issues).toEqual([])
    expect(result.js).toContain("vtsuru.getAssetUrl('cover')")
  })

  it('rejects non-vue imports', () => {
    const result = compileCustomVueSfc(`<script setup>
import axios from 'axios'
</script>
<template><div /></template>`)
    expect(result.issues.map((item) => item.message).join('\n')).toContain("不支持导入 'axios'")
    expect(result.js).toBe('')
  })

  it('compiles the default source and templates', () => {
    expect(compileCustomVueSfc(DEFAULT_CUSTOM_VUE_SOURCE).issues).toEqual([])
    for (const template of CUSTOM_CODE_TEMPLATES) {
      expect(compileCustomVueSfc(template.source).issues, template.key).toEqual([])
    }
  })

  it('strips TypeScript in script setup', () => {
    const result = compileCustomVueSfc(`<script setup lang="ts">
const name: string = 'ok'
</script>
<template><p>{{ name }}</p></template>`)
    expect(result.issues).toEqual([])
    expect(result.js).toContain("'ok'")
    expect(result.js).not.toContain(': string')
  })
})
