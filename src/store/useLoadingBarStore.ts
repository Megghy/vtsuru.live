import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useLoadingBarStore = defineStore('route-loading', () => {
  const active = ref(false)

  const start = () => (active.value = true)
  const finish = () => (active.value = false)

  return { active, start, finish }
})
