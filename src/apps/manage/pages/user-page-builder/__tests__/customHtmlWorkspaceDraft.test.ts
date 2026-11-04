import { describe, expect, it } from 'vitest'

import { DEFAULT_CUSTOM_VUE_SOURCE, normalizeCustomHtmlProps } from '@/apps/user-page/block/customHtmlContract'

import {
  appliedCustomHtmlDraft,
  getCustomHtmlWorkspaceKey,
  restoreCustomHtmlWorkspace,
} from '../customHtmlWorkspaceDraft'

describe('customHtmlWorkspaceDraft', () => {
  it('keys workspace by account, page and scope', () => {
    expect(getCustomHtmlWorkspaceKey(8, 'home', 'block:b1')).toBe(
      'vtsuru:user-page-builder:custom-html-workspace:v1:8:home:block:b1',
    )
  })

  it('fills empty source with the default template', () => {
    expect(appliedCustomHtmlDraft({ source: '', assets: [] }).source).toBe(DEFAULT_CUSTOM_VUE_SOURCE)
  })

  it('restores stash only when the applied snapshot still matches', () => {
    const applied = appliedCustomHtmlDraft({ source: DEFAULT_CUSTOM_VUE_SOURCE, assets: [] })
    const edited = { ...applied, source: `${applied.source}\n<!-- edited -->` }
    const restored = restoreCustomHtmlWorkspace(applied, {
      baseSnapshot: JSON.stringify(applied),
      props: edited,
    })
    expect(restored.dropStash).toBe(false)
    expect(restored.props.source).toContain('<!-- edited -->')
  })

  it('drops stale stash after the applied source changes', () => {
    const applied = appliedCustomHtmlDraft({ source: DEFAULT_CUSTOM_VUE_SOURCE, assets: [] })
    const next = appliedCustomHtmlDraft({ source: '<script setup></script>', assets: [] })
    const result = restoreCustomHtmlWorkspace(next, {
      baseSnapshot: JSON.stringify(applied),
      props: normalizeCustomHtmlProps({ source: 'stale', assets: [] }),
    })
    expect(result.dropStash).toBe(true)
    expect(result.props.source).toBe('<script setup></script>')
  })
})
