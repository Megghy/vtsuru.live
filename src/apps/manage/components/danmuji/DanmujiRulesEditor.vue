<script setup lang="ts">
import { NCheckbox, NForm, NFormItem, NInput, NInputNumber, NPopconfirm, NButton } from 'naive-ui'
import type { DanmujiConfig } from '@/shared/danmujiConfig'

const config = defineModel<DanmujiConfig>({ required: true })
defineEmits<{ reset: [] }>()
</script>

<template>
  <NForm label-placement="top" size="small" class="rules-form">
    <section>
      <h3>消息显示</h3>
      <div class="checks">
        <NCheckbox v-model:checked="config.showDanmaku">普通弹幕</NCheckbox>
        <NCheckbox v-model:checked="config.showGift">礼物消息</NCheckbox>
        <NCheckbox v-model:checked="config.showGiftName">显示礼物名</NCheckbox>
      </div>
    </section>
    <section>
      <h3>合并与限制</h3>
      <div class="checks">
        <NCheckbox v-model:checked="config.mergeSimilarDanmaku">合并相似弹幕</NCheckbox>
        <NCheckbox v-model:checked="config.mergeGift">合并连击礼物</NCheckbox>
      </div>
      <div class="fields">
        <NFormItem label="最大消息积压数">
          <NInputNumber v-model:value="config.maxNumber" :min="10" :max="300" :update-value-on-input="false" />
        </NFormItem>
        <NFormItem label="最低礼物价值">
          <NInputNumber v-model:value="config.minGiftPrice" :min="0" :step="0.1" :update-value-on-input="false">
            <template #suffix>元</template>
          </NInputNumber>
        </NFormItem>
      </div>
    </section>
    <section>
      <h3>屏蔽与过滤</h3>
      <NFormItem label="屏蔽用户名（一行一个）">
        <NInput v-model:value="config.blockUsers" type="textarea" :rows="3" placeholder="输入要屏蔽的用户名" />
      </NFormItem>
      <NFormItem label="屏蔽关键词（一行一个）">
        <NInput v-model:value="config.blockKeywords" type="textarea" :rows="3" placeholder="输入要屏蔽的关键词" />
      </NFormItem>
      <p>规则对新收到的消息生效，可在右侧发送测试消息验证。</p>
    </section>
    <NPopconfirm @positive-click="$emit('reset')">
      <template #trigger><NButton size="small" secondary>恢复默认规则</NButton></template>
      确定恢复默认功能配置吗？
    </NPopconfirm>
  </NForm>
</template>

<style scoped>
.rules-form { display: grid; gap: 20px; }
h3 { margin: 0 0 12px; font-size: 13px; font-weight: 600; }
.checks { display: flex; flex-wrap: wrap; gap: 10px 18px; }
.fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 16px; }
p { margin: 0; color: var(--vtsuru-fg-muted); font-size: 12px; }
</style>
