<script setup lang="ts">
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { NCollapse, NCollapseItem, NInput, NInputNumber, NFlex, NSwitch, NForm, NFormItem, NText, NTooltip, NIcon } from 'naive-ui';
import { computed } from 'vue'
import { createDefaultAutoAction } from '@/apps/client/store/autoAction/utils'
import { TriggerType } from '@/apps/client/store/useAutoAction'
import { Info16Regular } from '@vicons/fluent'

const props = defineProps({
  action: {
    type: Object as () => AutoActionItem,
    required: true,
  },
})

// 根据触发类型判断是否显示用户过滤选项
const showUserFilter = computed(() => {
  return ![TriggerType.SCHEDULED].includes(props.action.triggerType)
})

// 获取默认配置作为比较基准
const defaultAction = computed(() => createDefaultAutoAction(props.action.triggerType))

// 检查设置项是否被修改
function isModified(path: string, value: any) {
  const pathParts = path.split('.')
  let defaultValue: any = defaultAction.value
  let currentValue: any = props.action

  // 遍历路径获取值
  for (const part of pathParts) {
    defaultValue = defaultValue && typeof defaultValue === 'object' ? defaultValue[part as keyof typeof defaultValue] : undefined
    currentValue = currentValue && typeof currentValue === 'object' ? currentValue[part as keyof typeof currentValue] : undefined
  }

  // 处理特殊情况，如果指定了具体值进行比较
  if (value !== undefined) {
    return value !== defaultValue
  }

  return currentValue !== defaultValue
}

// 检查用户过滤区域是否有修改
const userFilterModified = computed(() => {
  if (!showUserFilter.value) return false
  return isModified('triggerConfig.userFilterEnabled', props.action.triggerConfig.userFilterEnabled)
    || isModified('triggerConfig.requireMedal', props.action.triggerConfig.requireMedal)
    || isModified('triggerConfig.requireCaptain', props.action.triggerConfig.requireCaptain)
})

// 检查冷却控制区域是否有修改
const cooldownModified = computed(() => {
  return isModified('ignoreCooldown', props.action.ignoreCooldown)
    || isModified('actionConfig.delaySeconds', props.action.actionConfig.delaySeconds)
    || isModified('actionConfig.cooldownSeconds', props.action.actionConfig.cooldownSeconds)
})

// 检查逻辑表达式是否有修改
const logicalExpressionModified = computed(() => {
  return isModified('logicalExpression', props.action.logicalExpression)
})

// 检查自定义JS是否有修改
const customJsModified = computed(() => {
  return isModified('executeCommand', props.action.executeCommand)
})
</script>

<template>
  <div class="advanced-settings">
    <NCollapse :default-expanded-names="[]" accordion>
      <NCollapseItem
        v-if="showUserFilter"
        key="user-filter"
        name="user-filter"
        class="settings-section"
        :class="{ 'section-modified': userFilterModified }"
      >
        <template #header>
          <NFlex align="center" :size="8">
            <NText strong :type="userFilterModified ? 'warning' : 'default'">
              用户过滤条件
            </NText>
            <NTag v-if="userFilterModified" size="tiny" type="warning" round border-weight="0">
              已修改
            </NTag>
          </NFlex>
        </template>
        
        <div class="section-content">
          <NForm label-placement="left" label-width="120" size="small" :show-feedback="false">
            <NFormItem label="启用过滤">
              <NSwitch v-model:value="action.triggerConfig.userFilterEnabled" size="small" />
            </NFormItem>
            
            <transition name="fade">
              <NFlex v-if="action.triggerConfig.userFilterEnabled" vertical :size="8" style="padding-top: 8px">
                <NFormItem label="要求本房勋章">
                  <NSwitch v-model:value="action.triggerConfig.requireMedal" size="small" />
                </NFormItem>
                <NFormItem label="要求任意舰长">
                  <NSwitch v-model:value="action.triggerConfig.requireCaptain" size="small" />
                </NFormItem>
              </NFlex>
            </transition>
          </NForm>
        </div>
      </NCollapseItem>

      <NCollapseItem
        key="cooldown"
        name="cooldown"
        class="settings-section"
        :class="{ 'section-modified': cooldownModified }"
      >
        <template #header>
          <NFlex align="center" :size="8">
            <NText strong :type="cooldownModified ? 'warning' : 'default'">
              频率与延迟控制
            </NText>
            <NTag v-if="cooldownModified" size="tiny" type="warning" round border-weight="0">
              已修改
            </NTag>
          </NFlex>
        </template>
        
        <div class="section-content">
          <NForm label-placement="left" label-width="120" size="small" :show-feedback="false">
            <NFormItem label="忽略全局冷却">
              <template #label>
                <NTooltip trigger="hover">
                  <template #trigger>
                    <span>忽略全局冷却 <NIcon :component="Info16Regular" style="vertical-align: -2px" /></span>
                  </template>
                  开启后此操作不受全局发送频率限制的影响
                </NTooltip>
              </template>
              <NSwitch v-model:value="action.ignoreCooldown" size="small" />
            </NFormItem>
            
            <NFormItem label="延迟执行(秒)">
              <NInputNumber
                v-model:value="action.actionConfig.delaySeconds"
                :min="0"
                :max="600"
                style="width: 120px"
                placeholder="0"
              />
            </NFormItem>
            
            <NFormItem label="冷却时间(秒)">
              <NInputNumber
                v-model:value="action.actionConfig.cooldownSeconds"
                :min="0"
                :max="3600"
                style="width: 120px"
                placeholder="0"
              />
            </NFormItem>
          </NForm>
        </div>
      </NCollapseItem>

      <NCollapseItem
        key="logical-expression"
        name="logical-expression"
        class="settings-section"
        :class="{ 'section-modified': logicalExpressionModified }"
      >
        <template #header>
          <NFlex align="center" :size="8">
            <NText strong :type="logicalExpressionModified ? 'warning' : 'default'">
              逻辑判断表达式
            </NText>
            <NTag v-if="logicalExpressionModified" size="tiny" type="warning" round border-weight="0">
              已配置
            </NTag>
          </NFlex>
        </template>
        
        <div class="section-content">
          <NFlex vertical :size="8">
            <NText depth="3" style="font-size: 12px">
              使用 JavaScript 语法，仅在返回值为真时执行。例如：
              <NText code>
                user.guardLevel &gt; 0 || gift.price &gt;= 10
              </NText>
            </NText>
            <NInput
              v-model:value="action.logicalExpression"
              type="textarea"
              placeholder="输入表达式..."
              :autosize="{ minRows: 2, maxRows: 5 }"
              class="code-input"
            />
          </NFlex>
        </div>
      </NCollapseItem>

      <NCollapseItem
        key="custom-js"
        name="custom-js"
        class="settings-section"
        :class="{ 'section-modified': customJsModified }"
      >
        <template #header>
          <NFlex align="center" :size="8">
            <NText strong :type="customJsModified ? 'warning' : 'default'">
              自定义脚本 (JS)
            </NText>
            <NTag v-if="customJsModified" size="tiny" type="warning" round border-weight="0">
              已编写
            </NTag>
          </NFlex>
        </template>
        
        <div class="section-content">
          <NFlex vertical :size="8">
            <NText depth="3" style="font-size: 12px">
              在操作执行前运行。可访问 
              <NText code>
                context
              </NText>, <NText code>
                event
              </NText>, <NText code>
                biliFunc
              </NText> 等变量。
            </NText>
            <NInput
              v-model:value="action.executeCommand"
              type="textarea"
              placeholder="输入要执行的JS代码..."
              :autosize="{ minRows: 3, maxRows: 8 }"
              class="code-input"
            />
          </NFlex>
        </div>
      </NCollapseItem>
    </NCollapse>
  </div>
</template>

<style scoped>
.advanced-settings {
  width: 100%;
}

.settings-section {
  border-radius: var(--n-border-radius);
  margin-bottom: 4px;
}

.section-content {
  padding: 8px 12px 12px;
  background-color: var(--n-action-color);
  border-radius: var(--n-border-radius);
}

.section-modified :deep(.n-collapse-item__header-main) {
  font-weight: 500;
}

.code-input :deep(textarea) {
  font-family: 'Courier New', Courier, monospace;
  font-size: 13px;
  background-color: var(--n-color-modal);
}

/* Fade animation for internal form items */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
