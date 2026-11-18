import { ref } from 'vue'

const open = ref(false)

export function useCommandPalette() {
  return {
    open,
    openPalette: () => {
      open.value = true
    },
    closePalette: () => {
      open.value = false
    },
    togglePalette: () => {
      open.value = !open.value
    },
  }
}
