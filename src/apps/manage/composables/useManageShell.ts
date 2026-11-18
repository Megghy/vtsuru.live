import { useMediaQuery } from '@vueuse/core'
import { ref, watch } from 'vue'

import { usePersistedStorage } from '@/shared/storage/persist'

const isMobileSider = useMediaQuery('(max-width: 749px)')
const siderCollapsed = usePersistedStorage<boolean>('Settings.ManageSiderCollapsed', false)
const mobileSiderOpen = ref(false)

watch(isMobileSider, (mobile) => {
  if (!mobile) {
    mobileSiderOpen.value = false
  }
})

export function useManageShell() {
  function toggleSider() {
    if (isMobileSider.value) {
      mobileSiderOpen.value = !mobileSiderOpen.value
      return
    }
    siderCollapsed.value = !siderCollapsed.value
  }

  return {
    isMobileSider,
    siderCollapsed,
    mobileSiderOpen,
    toggleSider,
  }
}
