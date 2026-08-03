<script setup lang="ts">
import { computed } from 'vue'

import { createDefaultAutoAction } from '@/apps/client/store/autoAction/utils'
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { TriggerType } from '@/apps/client/store/useAutoAction'

const props = defineProps({
  action: {
    type: Object as () => AutoActionItem,
    required: true,
  },
  hideUserFilter: {
    type: Boolean,
    default: false,
  },
})

// 根据触发类型判断是否显示用户过滤选项
const showUserFilter = computed(() => {
  return !props.hideUserFilter && ![TriggerType.SCHEDULED].includes(props.action.triggerType)
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
    defaultValue =
      defaultValue && typeof defaultValue === 'object' ? defaultValue[part as keyof typeof defaultValue] : undefined
    currentValue =
      currentValue && typeof currentValue === 'object' ? currentValue[part as keyof typeof currentValue] : undefined
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
  return (
    isModified('triggerConfig.userFilterEnabled', props.action.triggerConfig.userFilterEnabled) ||
    isModified('triggerConfig.requireMedal', props.action.triggerConfig.requireMedal) ||
    isModified('triggerConfig.requireCaptain', props.action.triggerConfig.requireCaptain)
  )
})

// 检查冷却控制区域是否有修改
const cooldownModified = computed(() => {
  return (
    isModified('ignoreCooldown', props.action.ignoreCooldown) ||
    isModified('actionConfig.delaySeconds', props.action.actionConfig.delaySeconds) ||
    isModified('actionConfig.cooldownSeconds', props.action.actionConfig.cooldownSeconds)
  )
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
    <div
      :default-expanded-names="[]"
      accordion
    >
      <details
        v-if="showUserFilter"
        key="user-filter"
        name="user-filter"
        class="settings-section"
        :class="{ 'section-modified': userFilterModified }"
      >
        <summary>
          <div
            align="center"
            :size="8"
          >
            <span
              strong
              :type="userFilterModified ? 'warning' : 'default'"
            >
              用户过滤条件
            </span>
            <UBadge
              v-if="userFilterModified"
              size="tiny"
              type="warning"
              round
              border-weight="0"
            >
              已修改
            </UBadge>
          </div>
        </summary>

        <div class="section-content">
          <UForm
            label-placement="left"
            label-width="120"
            size="small"
            :show-feedback="false"
          >
            <UFormField label="启用过滤">
              <USwitch
                v-model="action.triggerConfig.userFilterEnabled"
                size="small"
              />
            </UFormField>

            <transition name="fade">
              <div
                v-if="action.triggerConfig.userFilterEnabled"
                vertical
                :size="8"
                style="padding-top: 8px"
              >
                <UFormField label="要求本房勋章">
                  <USwitch
                    v-model="action.triggerConfig.requireMedal"
                    size="small"
                  />
                </UFormField>
                <UFormField label="要求任意舰长">
                  <USwitch
                    v-model="action.triggerConfig.requireCaptain"
                    size="small"
                  />
                </UFormField>
              </div>
            </transition>
          </UForm>
        </div>
      </details>

      <details
        key="cooldown"
        name="cooldown"
        class="settings-section"
        :class="{ 'section-modified': cooldownModified }"
      >
        <summary>
          <div
            align="center"
            :size="8"
          >
            <span
              strong
              :type="cooldownModified ? 'warning' : 'default'"
            >
              频率与延迟控制
            </span>
            <UBadge
              v-if="cooldownModified"
              size="tiny"
              type="warning"
              round
              border-weight="0"
            >
              已修改
            </UBadge>
          </div>
        </summary>

        <div class="section-content">
          <UForm
            label-placement="left"
            label-width="120"
            size="small"
            :show-feedback="false"
          >
            <UFormField label="忽略全局冷却">
              <template #label>
                <UTooltip>
                  <span
                    >忽略全局冷却
                    <UIcon
                      name="i-lucide-circle"
                      style="vertical-align: -2px"
                  /></span>
                  <template #content> 开启后此操作不受全局发送频率限制的影响 </template>
                </UTooltip>
              </template>
              <USwitch
                v-model="action.ignoreCooldown"
                size="small"
              />
            </UFormField>

            <UFormField label="延迟执行(秒)">
              <UInputNumber
                v-model="action.actionConfig.delaySeconds"
                :min="0"
                :max="600"
                style="width: 120px"
                placeholder="0"
              />
            </UFormField>

            <UFormField label="冷却时间(秒)">
              <UInputNumber
                v-model="action.actionConfig.cooldownSeconds"
                :min="0"
                :max="3600"
                style="width: 120px"
                placeholder="0"
              />
            </UFormField>
          </UForm>
        </div>
      </details>

      <details
        key="logical-expression"
        name="logical-expression"
        class="settings-section"
        :class="{ 'section-modified': logicalExpressionModified }"
      >
        <summary>
          <div
            align="center"
            :size="8"
          >
            <span
              strong
              :type="logicalExpressionModified ? 'warning' : 'default'"
            >
              逻辑判断表达式
            </span>
            <UBadge
              v-if="logicalExpressionModified"
              size="tiny"
              type="warning"
              round
              border-weight="0"
            >
              已配置
            </UBadge>
          </div>
        </summary>

        <div class="section-content">
          <div
            vertical
            :size="8"
          >
            <span
              depth="3"
              style="font-size: 12px"
            >
              使用 JavaScript 语法，仅在返回值为真时执行。例如：
              <span code> user.guardLevel &gt; 0 || gift.price &gt;= 10 </span>
            </span>
            <UInput
              v-model="action.logicalExpression"
              type="textarea"
              placeholder="输入表达式..."
              :autosize="{ minRows: 2, maxRows: 5 }"
              class="code-input"
            />
          </div>
        </div>
      </details>

      <details
        key="custom-js"
        name="custom-js"
        class="settings-section"
        :class="{ 'section-modified': customJsModified }"
      >
        <summary>
          <div
            align="center"
            :size="8"
          >
            <span
              strong
              :type="customJsModified ? 'warning' : 'default'"
            >
              自定义脚本 (JS)
            </span>
            <UBadge
              v-if="customJsModified"
              size="tiny"
              type="warning"
              round
              border-weight="0"
            >
              已编写
            </UBadge>
          </div>
        </summary>

        <div class="section-content">
          <div
            vertical
            :size="8"
          >
            <span
              depth="3"
              style="font-size: 12px"
            >
              在操作执行前运行。可访问
              <span code> context </span>, <span code> event </span>, <span code> biliFunc </span> 等变量。
            </span>
            <UInput
              v-model="action.executeCommand"
              type="textarea"
              placeholder="输入要执行的JS代码..."
              :autosize="{ minRows: 3, maxRows: 8 }"
              class="code-input"
            />
          </div>
        </div>
      </details>
    </div>
  </div>
</template>

<style scoped>
.advanced-settings {
  width: 100%;
}

.settings-section {
  border-radius: var(--vtsuru-radius);
  margin-bottom: 4px;
}

.section-content {
  padding: 8px 12px 12px;
  background-color: var(--vtsuru-bg-muted);
  border-radius: var(--vtsuru-radius);
}

.section-modified :deep(.u-collapse-item__header-main) {
  font-weight: 500;
}

.code-input :deep(textarea) {
  font-family: 'Courier New', Courier, monospace;
  font-size: 13px;
  background-color: var(--vtsuru-bg-elevated);
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
