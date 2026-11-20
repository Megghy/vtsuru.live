<script setup lang="ts">
import { computed, defineAsyncComponent, inject, ref } from 'vue'

import { CUSTOM_HTML_MAX_HEIGHT, CUSTOM_HTML_MIN_HEIGHT } from '@/apps/user-page/block/customHtmlContract'
import { Button } from '@/shared/ui/button'
import { FormField } from '@/shared/ui/form-field'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'

import { UserPageEditorKey } from '../context'

const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')
const config = computed(() => editor.currentPage.value.custom!)
const editorOpen = ref(false)
const CodeWorkbench = defineAsyncComponent(() => import('./CustomHtmlEditorModal.vue'))
</script>

<template>
  <section class="space-y-4">
    <Button
      class="w-full"
      @click="editorOpen = true"
      >打开全屏代码工作台</Button
    >
    <SettingRow
      title="全屏沉浸模式"
      variant="none"
    >
      <Switch v-model:checked="config.immersive" />
    </SettingRow>
    <FormField label="高度方式">
      <Select v-model="config.heightMode">
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="viewport">铺满视口</SelectItem>
          <SelectItem value="auto">自适应内容</SelectItem>
          <SelectItem value="fixed">固定高度</SelectItem>
        </SelectContent>
      </Select>
      <NumberField
        v-if="config.heightMode === 'fixed'"
        v-model="config.height"
        :min="CUSTOM_HTML_MIN_HEIGHT"
        :max="CUSTOM_HTML_MAX_HEIGHT"
        aria-label="固定高度"
      />
      <NumberField
        v-else-if="config.heightMode === 'auto'"
        v-model="config.maxHeight"
        :min="160"
        :max="CUSTOM_HTML_MAX_HEIGHT"
        aria-label="最大高度"
      />
    </FormField>
    <SettingRow
      title="外框"
      variant="none"
    >
      <Switch v-model:checked="config.framed" />
    </SettingRow>
    <SettingRow
      title="背景"
      variant="none"
    >
      <Switch v-model:checked="config.backgrounded" />
    </SettingRow>
    <CodeWorkbench
      v-if="editorOpen"
      v-model:show="editorOpen"
      page
    />
  </section>
</template>
