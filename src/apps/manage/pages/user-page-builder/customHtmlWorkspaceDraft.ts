import {
  DEFAULT_CUSTOM_VUE_SOURCE,
  normalizeCustomHtmlProps,
} from '@/apps/user-page/block/customHtmlContract'
import type { CustomHtmlProps } from '@/apps/user-page/block/customHtmlContract'

import { CUSTOM_HTML_WORKSPACE_KEY } from './storageKeys'

export interface CustomHtmlWorkspaceDraft {
  baseSnapshot: string
  props: CustomHtmlProps
}

export function getCustomHtmlWorkspaceKey(accountId: number, pageKey: string, scope: string) {
  return `${CUSTOM_HTML_WORKSPACE_KEY}:${accountId}:${pageKey}:${scope}`
}

export function appliedCustomHtmlDraft(source: unknown): CustomHtmlProps {
  const applied = normalizeCustomHtmlProps(source)
  if (!applied.source.trim()) applied.source = DEFAULT_CUSTOM_VUE_SOURCE
  return applied
}

export function restoreCustomHtmlWorkspace(
  applied: CustomHtmlProps,
  stash: CustomHtmlWorkspaceDraft | null,
): { props: CustomHtmlProps; dropStash: boolean } {
  if (!stash || stash.baseSnapshot !== JSON.stringify(applied)) {
    return { props: applied, dropStash: Boolean(stash) }
  }
  return { props: normalizeCustomHtmlProps(stash.props), dropStash: false }
}
