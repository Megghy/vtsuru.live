import { defineStore } from 'pinia'
import { LoadingBarApi } from 'naive-ui'
import { ref } from 'vue'

export const useProviderStore = defineStore('provider', () => {
    const loadingBar = ref<LoadingBarApi>()

    function setLoadingBar(b: LoadingBarApi) {
        loadingBar.value = b
    }

    return { loadingBar, setLoadingBar }
})