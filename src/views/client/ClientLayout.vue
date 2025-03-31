<script setup lang="ts">
import { useAccount } from '@/api/account';
import { useWebFetcher } from '@/store/useWebFetcher';
import {fetch} from "@tauri-apps/plugin-http";
import { NFlex } from 'naive-ui';

const webfetcher = useWebFetcher();
const accountInfo = useAccount();

function initWebfetcher() {
  webfetcher.Start();
  webfetcher.signalRClient?.send();
}

onMounted(() => {
  if (accountInfo.value.id) {
    initWebfetcher();
    console.info('WebFetcher started')
  }
})
</script>

<template>
  <NFlex v-if="!accountInfo.id">
    <RegisterAndLogin />
  </NFlex>
  <NFlex v-else>
    {{ webfetcher }}
  </NFlex>
</template>