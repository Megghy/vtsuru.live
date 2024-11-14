import { useAccount } from '@/api/account'
import { MasterRTCClient, SlaveRTCClient } from '@/data/RTCClient'
import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'

export const useWebRTC = defineStore('WebRTC', () => {
  const masterClient = ref<MasterRTCClient>()
  const slaveClient = ref<SlaveRTCClient>()
  const accountInfo = useAccount()

  function Init(type: 'master' | 'slave') {
    if (type == 'master') {
      if (masterClient.value) {
        return masterClient
      } else {
        masterClient.value = new MasterRTCClient(
          accountInfo.value.id.toString(),
          accountInfo.value.token
        )
        masterClient.value.Init()
        return masterClient
      }
    } else {
      if (slaveClient.value) {
        return slaveClient
      } else {
        slaveClient.value = new SlaveRTCClient(
          accountInfo.value.id.toString(),
          accountInfo.value.token
        )
        slaveClient.value.Init()
        return slaveClient
      }
    }
  }

  return {
    Init
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useWebRTC, import.meta.hot))
}
