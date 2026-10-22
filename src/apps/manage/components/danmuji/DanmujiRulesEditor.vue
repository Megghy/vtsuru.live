<script setup lang="ts">
import type { DanmujiConfig } from '@/shared/danmujiConfig'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { NumberField } from '@/shared/ui/number-field'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Textarea } from '@/shared/ui/textarea'

const config = defineModel<DanmujiConfig>({ required: true })
defineEmits<{ reset: [] }>()
</script>

<template>
  <div class="space-y-4 text-xs">
    <section class="space-y-2">
      <h3 class="font-medium text-foreground">消息显示</h3>
      <div class="flex items-center gap-4 flex-wrap">
        <label class="flex items-center gap-1.5 cursor-pointer select-none">
          <Checkbox v-model:checked="config.showDanmaku" />
          <span>普通弹幕</span>
        </label>
        <label class="flex items-center gap-1.5 cursor-pointer select-none">
          <Checkbox v-model:checked="config.showGift" />
          <span>礼物消息</span>
        </label>
        <label class="flex items-center gap-1.5 cursor-pointer select-none">
          <Checkbox v-model:checked="config.showGiftName" />
          <span>显示礼物名</span>
        </label>
      </div>
    </section>

    <section class="space-y-2">
      <h3 class="font-medium text-foreground">合并与限制</h3>
      <div class="flex items-center gap-4 flex-wrap">
        <label class="flex items-center gap-1.5 cursor-pointer select-none">
          <Checkbox v-model:checked="config.mergeSimilarDanmaku" />
          <span>合并相似弹幕</span>
        </label>
        <label class="flex items-center gap-1.5 cursor-pointer select-none">
          <Checkbox v-model:checked="config.mergeGift" />
          <span>合并连击礼物</span>
        </label>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div class="space-y-1">
          <label class="text-xs text-muted-foreground">最大消息积压数</label>
          <NumberField
            v-model="config.maxNumber"
            :min="10"
            :max="300"
          />
        </div>
        <div class="space-y-1">
          <label class="text-xs text-muted-foreground">最低礼物价值 (元)</label>
          <NumberField
            v-model="config.minGiftPrice"
            :min="0"
            :step="0.1"
          />
        </div>
      </div>
    </section>

    <section class="space-y-2">
      <h3 class="font-medium text-foreground">屏蔽与过滤</h3>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">屏蔽用户名（一行一个）</label>
        <Textarea
          v-model="config.blockUsers"
          :rows="3"
          placeholder="输入要屏蔽的用户名"
          class="text-xs"
        />
      </div>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">屏蔽关键词（一行一个）</label>
        <Textarea
          v-model="config.blockKeywords"
          :rows="3"
          placeholder="输入要屏蔽的关键词"
          class="text-xs"
        />
      </div>
      <p class="text-[11px] text-muted-foreground">规则对新收到的消息生效，可在右侧发送测试消息验证。</p>
    </section>

    <div class="pt-2">
      <Popconfirm
        title="确认恢复默认？"
        description="确定恢复默认功能配置吗？"
        @confirm="$emit('reset')"
      >
        <Button variant="outline"> 恢复默认规则 </Button>
      </Popconfirm>
    </div>
  </div>
</template>
