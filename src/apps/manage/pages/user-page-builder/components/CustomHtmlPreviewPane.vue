<script setup lang="ts">
import DesktopOutline from '@vicons/ionicons5/es/DesktopOutline'
import MoonOutline from '@vicons/ionicons5/es/MoonOutline'
import PhonePortraitOutline from '@vicons/ionicons5/es/PhonePortraitOutline'
import SunnyOutline from '@vicons/ionicons5/es/SunnyOutline'

import type { ResponseUserInfo } from '@/api/generated/model'
import CustomHtmlBlock from '@/apps/user-page/block/blocks/CustomHtmlBlock.vue'
import type { CustomHtmlProps } from '@/apps/user-page/block/customHtmlContract'
import type { CustomHtmlTheme } from '@/apps/user-page/block/customHtmlRuntime'
import { Button } from '@/shared/ui/button'
import { Switch } from '@/shared/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

import { useScopedCustomCssPreview } from '../previewThemeContext'

defineOptions({ name: 'CustomHtmlPreviewPane' })

const props = defineProps<{
  previewProps: CustomHtmlProps
  previewStale: boolean
  theme: CustomHtmlTheme
  stageStyle: Record<string, string | undefined>
  userInfo?: ResponseUserInfo
  pageMode: 'block' | 'custom'
  pageSlug?: string | null
  customCss?: string
}>()

const livePreview = defineModel<boolean>('livePreview', { required: true })
const previewDevice = defineModel<'desktop' | 'mobile'>('previewDevice', { required: true })
const previewDark = defineModel<boolean>('previewDark', { required: true })

const emit = defineEmits<{
  refresh: []
}>()

useScopedCustomCssPreview('.custom-html-modal-preview-scope', () => props.customCss ?? '')

function handleDeviceChange(value: unknown) {
  if (value === 'desktop' || value === 'mobile') previewDevice.value = value
}
</script>

<template>
  <section class="preview-pane flex flex-col min-h-0 bg-muted/10">
    <div class="pane-toolbar preview-toolbar flex justify-between items-center px-3 py-2 border-b bg-card shrink-0">
      <div class="flex items-center gap-2 min-w-0">
        <span class="text-xs font-semibold text-foreground">预览</span>
        <label class="inline-flex-center gap-1.5 text-xs text-muted-foreground">
          实时更新
          <Switch v-model="livePreview" />
        </label>
        <Button
          v-if="!livePreview"
          size="xs"
          :variant="previewStale ? 'default' : 'outline'"
          @click="emit('refresh')"
        >
          更新预览
        </Button>
      </div>
      <div class="flex items-center gap-1.5">
        <ToggleGroup
          :model-value="previewDevice"
          type="single"
          size="xs"
          aria-label="预览视口"
          @update:model-value="handleDeviceChange"
        >
          <ToggleGroupItem
            value="desktop"
            aria-label="桌面预览"
          >
            <DesktopOutline class="size-3.5" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="mobile"
            aria-label="移动预览"
          >
            <PhonePortraitOutline class="size-3.5" />
          </ToggleGroupItem>
        </ToggleGroup>
        <Button
          size="icon-xs"
          variant="ghost"
          :aria-label="previewDark ? '切换亮色预览' : '切换暗色预览'"
          @click="previewDark = !previewDark"
        >
          <SunnyOutline
            v-if="previewDark"
            class="size-4"
          />
          <MoonOutline
            v-else
            class="size-4"
          />
        </Button>
      </div>
    </div>
    <div class="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
      <div
        class="preview-stage custom-html-modal-preview-scope relative min-h-full p-4 flex justify-center transition-colors duration-150"
        :class="{ dark: previewDark }"
        :style="stageStyle"
      >
        <div
          class="preview-content"
          :style="{
            width: previewDevice === 'mobile' ? '390px' : '100%',
            maxWidth: '100%',
          }"
        >
          <CustomHtmlBlock
            :block-props="previewProps"
            :theme="theme"
            :user-info="userInfo"
            :page-mode="pageMode"
            :page-slug="pageSlug"
          />
        </div>
      </div>
    </div>
  </section>
</template>
