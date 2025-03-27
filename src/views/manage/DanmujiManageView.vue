<script setup lang="ts">
import { NAlert, NFlex, NInput } from 'naive-ui';
import DanmujiOBS from '../obs/DanmujiOBS.vue';
import { useAccount } from '@/api/account';
import MonacoEditorComponent from '@/components/MonacoEditorComponent.vue';
import { ref } from 'vue';
import { CURRENT_HOST } from '@/data/constants';

const accountInfo = useAccount()
const css = ref('')
</script>

<template>
  <NFlex
    wrap
    style="height: 100%"
  >
    <NFlex
      style="flex: 1;"
      vertical
    >
      <NAlert type="error">
        未完成
      </NAlert>
      <NInput
        :allow-input="() => false"
        :value="`${CURRENT_HOST}obs/danmuji?token=${accountInfo.token}`"
      />
      <MonacoEditorComponent
        v-model:value="css"
        language="css"
        :height="500"
      />
    </NFlex>
    <div
      class="danmuji-obs"
      style="width: 300px; height: calc(100% - 2px); min-height: 500px;border: 1px solid #adadad;border-radius: 8px;
      overflow: hidden;"
    >
      <DanmujiOBS
        :is-o-b-s="false"
        style="height: 100%; width: 100%;"
        :custom-css="css"
      />
    </div>
  </NFlex>
</template>

<style scoped>
.danmuji-obs {
  --danmuji-bg: #333;
  background-color: #222;
  background-image: linear-gradient(45deg, var(--danmuji-bg) 25%, transparent 25%),
    linear-gradient(-45deg, var(--danmuji-bg) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, var(--danmuji-bg) 75%),
    linear-gradient(-45deg, transparent 75%, var(--danmuji-bg) 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0;
}
</style>