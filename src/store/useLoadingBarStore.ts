import type { LoadingBarApi } from 'naive-ui'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useLoadingBarStore = defineStore('provider', () => {
  const loadingBar = ref<LoadingBarApi>()

  function setLoadingBar(b: LoadingBarApi) {
    loadingBar.value = b
  }

  return { loadingBar, setLoadingBar }
})
