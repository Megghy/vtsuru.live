<script setup lang="ts">
import CopyOutline from '@vicons/ionicons5/es/CopyOutline'
import { computed, ref } from 'vue'

import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { useMessage } from '@/shared/utils'

import { THEME_VARIABLES, VTSURU_SDK_GROUPS, VTSURU_SDK_METHODS } from './customHtmlEditorLanguage'

const emit = defineEmits<{ insert: [snippet: string] }>()
const query = ref('')
const message = useMessage()

const matched = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (!needle) return VTSURU_SDK_METHODS
  return VTSURU_SDK_METHODS.filter((api) => `${api.name} ${api.doc} ${api.snippet}`.toLowerCase().includes(needle))
})

function methodsOf(group: (typeof VTSURU_SDK_GROUPS)[number]['key']) {
  return matched.value.filter((api) => api.group === group)
}

async function copySnippet(snippet: string) {
  try {
    await navigator.clipboard.writeText(snippet)
    message.success('已复制')
  } catch {
    message.error('复制失败，请检查浏览器剪贴板权限')
  }
}
</script>

<template>
  <TooltipProvider>
    <div class="flex min-w-0 flex-col gap-5">
      <Input
        v-model="query"
        placeholder="搜索方法"
      />
      <p class="text-xs leading-relaxed text-muted-foreground">
        在
        <code class="font-mono text-foreground">&lt;script setup&gt;</code>
        中调用
        <code class="font-mono text-foreground">vtsuru</code>
        。写操作会弹出宿主确认。允许
        <code class="font-mono text-foreground">from 'vue'</code>
        、
        <code class="font-mono text-foreground">'dayjs'</code>
        、
        <code class="font-mono text-foreground">'@vueuse/core'</code>
        ；网络类 API 不可用。点击方法插入到光标处。
      </p>

      <section
        v-for="group in VTSURU_SDK_GROUPS"
        v-show="methodsOf(group.key).length"
        :key="group.key"
        class="flex min-w-0 flex-col gap-2"
      >
        <h3 class="text-xs font-medium text-muted-foreground">{{ group.label }}</h3>
        <div
          v-for="api in methodsOf(group.key)"
          :key="api.name"
          class="flex min-w-0 items-start rounded-lg border bg-card"
        >
          <button
            type="button"
            class="min-w-0 flex-1 cursor-pointer rounded-lg px-3 py-2.5 text-left hover:bg-muted/50 active:scale-[0.99]"
            @click="emit('insert', api.snippet)"
          >
            <div class="flex items-start justify-between gap-2">
              <code class="min-w-0 break-all text-[13px] font-medium text-foreground"
                >{{ api.name }}({{ api.args }})</code
              >
              <span class="shrink-0 text-[10px] text-muted-foreground">{{ api.await ? 'await' : 'sync' }}</span>
            </div>
            <p class="mt-1 break-words text-xs leading-relaxed text-muted-foreground">{{ api.doc }}</p>
            <code class="mt-1 block break-all text-[11px] text-muted-foreground/80">{{ api.returns }}</code>
          </button>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                size="xs"
                variant="ghost"
                class="mt-1.5 mr-1 size-7 shrink-0"
                aria-label="复制代码"
                @click.stop="copySnippet(api.snippet)"
              >
                <CopyOutline class="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>复制</TooltipContent>
          </Tooltip>
        </div>
      </section>

      <p
        v-if="!matched.length"
        class="py-8 text-center text-xs text-muted-foreground"
      >
        没有匹配的方法
      </p>

      <section class="flex min-w-0 flex-col gap-2">
        <h3 class="text-xs font-medium text-muted-foreground">主题变量</h3>
        <div class="flex min-w-0 flex-wrap gap-1.5">
          <code
            v-for="variable in THEME_VARIABLES"
            :key="variable"
            class="max-w-full break-all rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground"
          >
            {{ variable }}
          </code>
        </div>
      </section>
    </div>
  </TooltipProvider>
</template>
