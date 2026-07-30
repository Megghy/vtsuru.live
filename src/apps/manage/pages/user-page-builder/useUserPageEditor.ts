import { useMessage } from 'naive-ui'
import { computed } from 'vue'

import { useAccount } from '@/api/account'

import { useUserPageContrib } from './useUserPageContrib'
import { useUserPageEditorCore } from './useUserPageEditorCore'
import { useUserPageEditorIO } from './useUserPageEditorIO'
import { useUserPageEditorLifecycle } from './useUserPageEditorLifecycle'

const MAX_PAGES_COUNT = 16
const MAX_CONFIG_BYTES = 128 * 1024

export function useUserPageEditor() {
  const message = useMessage()
  const account = useAccount()
  const accountId = computed(() => account.value.id)
  const core = useUserPageEditorCore({
    maxPagesCount: MAX_PAGES_COUNT,
    notify: {
      success: message.success,
      warning: message.warning,
      error: message.error,
    },
  })
  const contrib = useUserPageContrib({
    currentPage: core.currentPage,
    currentContrib: core.currentContrib,
    accountId,
    notifySuccess: message.success,
  })
  const lifecycle = useUserPageEditorLifecycle({ core, message, accountId, maxConfigBytes: MAX_CONFIG_BYTES })
  const io = useUserPageEditorIO({
    settings: core.settings,
    currentKey: core.currentKey,
    currentPage: core.currentPage,
    currentProject: core.currentProject,
    loadedRollback: core.loadedRollback,
    accountId,
    accountName: computed(() => account.value?.name),
    selectedBlockIds: core.selectedBlockIds,
    hoveredBlockId: core.hoveredBlockId,
    maxConfigBytes: MAX_CONFIG_BYTES,
    batchHistory: core.batchHistory,
    clearSelection: core.blocks.clearSelection,
    notifySuccess: message.success,
  })

  return {
    account,
    message,
    MAX_PAGES_COUNT,
    MAX_CONFIG_BYTES,
    ...core.api,
    ...contrib,
    ...lifecycle,
    ...io,
  }
}

export type UserPageEditor = ReturnType<typeof useUserPageEditor>
