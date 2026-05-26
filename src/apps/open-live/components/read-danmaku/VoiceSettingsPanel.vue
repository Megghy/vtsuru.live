<script setup lang="ts">
import { computed } from 'vue'
import { NDivider, NFlex, NSlider } from 'naive-ui'
import { useSpeechService } from '@/store/useSpeechService'
import ProviderTile from './ProviderTile.vue'
import SectionField from './SectionField.vue'
import LocalForm from './providers/LocalForm.vue'
import AzureForm from './providers/AzureForm.vue'
import CustomApiForm from './providers/CustomApiForm.vue'
import MimoForm from './providers/MimoForm.vue'
import OpenAIForm from './providers/OpenAIForm.vue'

const speechService = useSpeechService()
const { settings } = speechService

const supportsProsody = computed(() =>
  settings.value.provider === 'local' || settings.value.provider === 'azure'
)

const providers = [
  { id: 'mimo', title: 'MiMo TTS', desc: '小米 MiMo 语音, 支持风格标签' },
  { id: 'azure', title: 'Azure', desc: '本站托管的 Microsoft Azure 语音' },
  { id: 'local', title: '本地语音', desc: '使用浏览器内置 TTS' },
  { id: 'openai', title: 'OpenAI 兼容', desc: '直连 OpenAI Audio API', badge: '前端直连' },
  { id: 'api', title: '自定义 API', desc: '指向自建 / 第三方 TTS 服务' },
]
</script>

<template>
  <div class="voice-settings">
    <SectionField
      label="音量"
      :value="`${(settings.speechInfo.volume * 100).toFixed(0)}%`"
    >
      <NSlider
        v-model:value="settings.speechInfo.volume"
        :min="0" :max="1" :step="0.01"
      />
    </SectionField>

    <template v-if="supportsProsody">
      <SectionField label="音调" :value="settings.speechInfo.pitch.toFixed(2)">
        <NSlider
          v-model:value="settings.speechInfo.pitch"
          :min="0.5" :max="2" :step="0.01"
        />
      </SectionField>

      <SectionField label="语速" :value="settings.speechInfo.rate.toFixed(2)">
        <NSlider
          v-model:value="settings.speechInfo.rate"
          :min="0.5" :max="2" :step="0.01"
        />
      </SectionField>
    </template>

    <NDivider style="margin: 4px 0" />

    <SectionField label="语音引擎">
      <NFlex :size="6" :wrap="true">
        <ProviderTile
          v-for="p in providers"
          :key="p.id"
          :title="p.title"
          :description="p.desc"
          :badge="p.badge"
          :active="settings.provider === p.id"
          style="flex: 1 1 calc(50% - 3px); min-width: 140px"
          @click="settings.provider = p.id"
        />
      </NFlex>
    </SectionField>

    <Transition name="fade" mode="out-in">
      <LocalForm v-if="settings.provider === 'local'" />
      <AzureForm v-else-if="settings.provider === 'azure'" />
      <CustomApiForm v-else-if="settings.provider === 'api'" />
      <MimoForm v-else-if="settings.provider === 'mimo'" />
      <OpenAIForm v-else-if="settings.provider === 'openai'" />
    </Transition>
  </div>
</template>

<style scoped>
.voice-settings {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
