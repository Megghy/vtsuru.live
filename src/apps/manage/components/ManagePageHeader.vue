<script setup lang="ts">
import { Copy24Regular, Info24Filled } from '@vicons/fluent'
import { computed } from 'vue'

import { useAccount } from '@/api/account'
import type { FunctionTypes } from '@/api/api-models'
import { useFunctionToggle } from '@/apps/manage/composables/useFunctionToggle'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Switch } from '@/shared/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { copyToClipboard } from '@/shared/utils'

interface ManageHeaderLink {
  label: string
  value: string
  copyValue?: string
  description?: string
}

const props = defineProps<{
  title: string
  subtitle?: string
  description?: string
  functionType?: FunctionTypes
  links?: ManageHeaderLink[]
  loading?: boolean
}>()

const accountInfo = useAccount()
const toggle = props.functionType != null ? useFunctionToggle(props.functionType, props.title) : null
const links = computed(() => props.links?.filter((link) => link.value) ?? [])
const switchLoading = computed(() => toggle?.loading.value ?? false)
const displayedSubtitle = computed(() => props.subtitle || props.description || '')

const isFunctionEnabled = computed(() => {
  if (props.functionType == null || !accountInfo.value) return false
  return accountInfo.value.settings?.enableFunctions?.includes(props.functionType) ?? false
})
</script>

<template>
  <div class="flex flex-col gap-3 w-full">
    <div class="flex items-start justify-between gap-3 flex-wrap">
      <div class="flex flex-col gap-1 min-w-0">
        <div class="flex items-center gap-3 flex-wrap">
          <h1 class="text-xl font-bold tracking-tight text-foreground m-0">
            {{ title }}
          </h1>

          <div
            v-if="functionType != null && accountInfo"
            class="flex items-center gap-2 pl-2 border-l border-border"
          >
            <span class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"> 功能 </span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger as-child>
                  <div class="flex items-center gap-1.5 cursor-pointer">
                    <Switch
                      :model-value="isFunctionEnabled"
                      :disabled="loading || switchLoading"
                      @update:model-value="(val) => toggle?.setEnable(Boolean(val))"
                    />
                    <span class="text-xs text-muted-foreground select-none">
                      {{ isFunctionEnabled ? '已启用' : '已禁用' }}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent class="text-xs"> 关闭后不会显示在个人主页 </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <p
          v-if="displayedSubtitle"
          class="text-xs text-muted-foreground m-0 leading-relaxed max-w-3xl"
        >
          {{ displayedSubtitle }}
        </p>
      </div>

      <div class="flex items-center gap-2 flex-wrap shrink-0">
        <slot name="action">
          <slot name="actions" />
        </slot>
      </div>
    </div>

    <div v-if="$slots.default">
      <slot />
    </div>

    <!-- 链接展示区 -->
    <Card
      v-if="links.length > 0 || $slots['links-extra']"
      class="border-border bg-card shadow-none"
    >
      <CardContent class="p-3">
        <div class="flex items-end gap-3 flex-wrap">
          <div
            v-for="link in links"
            :key="`${link.label}:${link.value}`"
            class="flex flex-col gap-1.5 flex-1 min-w-[280px]"
          >
            <div class="flex items-center gap-1.5">
              <span class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {{ link.label }}
              </span>
              <TooltipProvider v-if="link.description">
                <Tooltip>
                  <TooltipTrigger as-child>
                    <component
                      :is="Info24Filled"
                      class="h-3.5 w-3.5 text-muted-foreground cursor-help"
                    />
                  </TooltipTrigger>
                  <TooltipContent class="text-xs max-w-xs">
                    {{ link.description }}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div class="flex items-center gap-1.5">
              <Input
                :model-value="link.value"
                readonly
                class="flex-1 font-mono bg-muted/40"
              />
              <Button
                variant="outline"
                @click="copyToClipboard(link.copyValue ?? link.value)"
              >
                <component
                  :is="Copy24Regular"
                  class="h-3.5 w-3.5 mr-1"
                />
                复制
              </Button>
            </div>
          </div>

          <div
            v-if="$slots['links-extra']"
            class="shrink-0"
          >
            <slot name="links-extra" />
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
