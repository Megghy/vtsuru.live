<script setup lang="ts">
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { NCollapse, NCollapseItem, NInput, NInputNumber, NSpace, NSwitch } from 'naive-ui'
import { computed } from 'vue'
import { createDefaultAutoAction } from '@/apps/client/store/autoAction/utils'
import { TriggerType } from '@/apps/client/store/useAutoAction'

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
  <NCollapse>
    <NCollapseItem
      v-if="showUserFilter"
      key="user-filter"
      :title="userFilterModified ? '用户过滤 *' : '用户过滤'"
      :title-extra="userFilterModified ? '已修改' : ''"
      class="settings-section"
      :class="{ 'section-modified': userFilterModified }"
    >
      <div>
        <NSpace
          key="user-filter-enabled"
          vertical
          class="settings-subsection"
        >
          <NSpace
            align="center"
            justify="space-between"
            style="width: 100%"
            class="setting-item" :class="[{ 'setting-modified': isModified('triggerConfig.userFilterEnabled', action.triggerConfig.userFilterEnabled) }]"
          >
            <span>启用用户过滤:</span>
            <NSwitch v-model:value="action.triggerConfig.userFilterEnabled" />
          </NSpace>

          <template v-if="action.triggerConfig.userFilterEnabled">
            <NSpace
              key="require-medal"
              align="center"
              justify="space-between"
              style="width: 100%"
              class="setting-item" :class="[{ 'setting-modified': isModified('triggerConfig.requireMedal', action.triggerConfig.requireMedal) }]"
            >
              <span>要求本房间勋章:</span>
              <NSwitch v-model:value="action.triggerConfig.requireMedal" />
            </NSpace>

            <NSpace
              key="require-captain"
              align="center"
              justify="space-between"
              style="width: 100%"
              class="setting-item" :class="[{ 'setting-modified': isModified('triggerConfig.requireCaptain', action.triggerConfig.requireCaptain) }]"
            >
              <span>要求任意舰长:</span>
              <NSwitch v-model:value="action.triggerConfig.requireCaptain" />
            </NSpace>
          </template>
        </NSpace>
      </div>
    </NCollapseItem>

    <NCollapseItem
      key="cooldown"
      :title="cooldownModified ? '冷却控制 *' : '冷却控制'"
      :title-extra="cooldownModified ? '已修改' : ''"
      class="settings-section"
      :class="{ 'section-modified': cooldownModified }"
    >
      <div>
        <NSpace
          key="ignore-cooldown"
          align="center"
          justify="space-between"
          style="width: 100%"
          class="setting-item" :class="[{ 'setting-modified': isModified('ignoreCooldown', action.ignoreCooldown) }]"
        >
          <span>忽略全局冷却:</span>
          <NSwitch v-model:value="action.ignoreCooldown" />
        </NSpace>

        <NSpace
          key="delay-seconds"
          align="center"
          justify="space-between"
          style="width: 100%"
          class="setting-item" :class="[{ 'setting-modified': isModified('actionConfig.delaySeconds', action.actionConfig.delaySeconds) }]"
        >
          <span>延迟执行(秒):</span>
          <NInputNumber
            v-model:value="action.actionConfig.delaySeconds"
            :min="0"
            :max="600"
            style="width: 120px"
          />
        </NSpace>

        <NSpace
          key="cooldown-seconds"
          align="center"
          justify="space-between"
          style="width: 100%"
          class="setting-item" :class="[{ 'setting-modified': isModified('actionConfig.cooldownSeconds', action.actionConfig.cooldownSeconds) }]"
        >
          <span>冷却时间(秒):</span>
          <NInputNumber
            v-model:value="action.actionConfig.cooldownSeconds"
            :min="0"
            :max="3600"
            style="width: 120px"
          />
        </NSpace>
      </div>
    </NCollapseItem>

    <NCollapseItem
      key="logical-expression"
      :title="logicalExpressionModified ? '逻辑条件表达式 *' : '逻辑条件表达式'"
      :title-extra="logicalExpressionModified ? '已修改' : ''"
      class="settings-section"
      :class="{ 'section-modified': logicalExpressionModified }"
    >
      <div>
        <NSpace vertical>
          <p class="description">
            当表达式为真时才会执行此操作。可使用JS语法，例如: <code>user.guardLevel > 0 || gift.price > 10</code>
          </p>
          <NInput
            v-model:value="action.logicalExpression"
            type="textarea"
            placeholder="输入表达式，留空则始终为真"
            :autosize="{ minRows: 2, maxRows: 5 }"
            :class="{ 'input-modified': isModified('logicalExpression', action.logicalExpression) }"
          />
        </NSpace>
      </div>
    </NCollapseItem>

    <NCollapseItem
      key="custom-js"
      :title="customJsModified ? '自定义JS执行 *' : '自定义JS执行'"
      :title-extra="customJsModified ? '已修改' : ''"
      class="settings-section"
      :class="{ 'section-modified': customJsModified }"
    >
      <div>
        <NSpace vertical>
          <p class="description">
            可访问 context, event, biliFunc, roomId 等变量
          </p>
          <NInput
            v-model:value="action.executeCommand"
            type="textarea"
            placeholder="输入要执行的JS代码"
            :autosize="{ minRows: 3, maxRows: 8 }"
            :class="{ 'input-modified': isModified('executeCommand', action.executeCommand) }"
          />
        </NSpace>
      </div>
    </NCollapseItem>
  </NCollapse>
</template>

<style scoped>
.settings-section {
  margin-bottom: 12px;
  position: relative;
}

.settings-subsection {
  position: relative;
}

.setting-item {
  padding: 4px 8px;
  border-radius: 4px;
}

.setting-item:hover {
  background-color: rgba(0, 0, 0, 0.02);
}

.setting-modified {
  font-weight: bold;
  background-color: rgba(255, 230, 186, 0.2);
}

.setting-modified:hover {
  background-color: rgba(255, 230, 186, 0.3);
}

.input-modified {
  border-color: #faad14;
  background-color: rgba(255, 230, 186, 0.1);
}

.section-modified :deep(.n-collapse-item__header-main) {
  font-weight: bold;
  color: #fa8c16;
}

.section-modified :deep(.n-collapse-item__header-extra) {
  font-size: 12px;
  color: #fa8c16;
  font-weight: normal;
}

.description {
  margin-top: 8px;
  font-size: 13px;
  color: #999;
}

code {
  background-color: rgba(0, 0, 0, 0.06);
  padding: 2px 4px;
  border-radius: 4px;
  font-family: monospace;
}

/* 已移除所有动画相关样式 */
</style>
