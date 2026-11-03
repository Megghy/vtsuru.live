import { describe, expect, it } from 'vitest'

import { detectSfcRegion, hoverMarkdown } from '../components/customHtmlEditorLanguage'

const source = `<script setup>
const n = 1
</script>
<template>
  <button>{{ n }}</button>
</template>
<style>
.x { color: red }
</style>`

describe('detectSfcRegion', () => {
  it('detects script template and style blocks', () => {
    expect(detectSfcRegion(source, source.indexOf('const n'))).toBe('script')
    expect(detectSfcRegion(source, source.indexOf('<button>'))).toBe('template')
    expect(detectSfcRegion(source, source.indexOf('.x {'))).toBe('style')
  })

  it('treats css language as style', () => {
    expect(detectSfcRegion('.x { color: red }', 0, 'css')).toBe('style')
  })
})

describe('hoverMarkdown', () => {
  it('documents vtsuru sdk methods', () => {
    expect(hoverMarkdown('vtsuru')).toContain('沙盒宿主 SDK')
    expect(hoverMarkdown('getSongs')).toContain('vtsuru.getSongs')
    expect(hoverMarkdown('ref')).toBeNull()
    expect(hoverMarkdown('v-if')).toContain('Vue 指令')
  })
})
