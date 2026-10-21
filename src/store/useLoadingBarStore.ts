import { defineStore } from 'pinia'
import { ref } from 'vue'

export type LoadingBarApi = {
  start: () => void
  finish: () => void
  error: () => void
}

export const useLoadingBarStore = defineStore('provider', () => {
  const loadingBar = ref<LoadingBarApi>()

  function setLoadingBar(b: LoadingBarApi) {
    loadingBar.value = b
  }

  return { loadingBar, setLoadingBar }
})
