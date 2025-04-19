<script setup lang="ts">
import { AutoActionItem, TriggerType, useAutoAction } from '@/client/store/useAutoAction';
import { useDanmakuClient } from '@/store/useDanmakuClient';
import {
  NAlert,
  NButton,
  NCard,
  NCountdown,
  NDropdown,
  NEmpty,
  NModal,
  NPopconfirm,
  NSelect,
  NSpace,
  NTabPane,
  NTabs,
  NTag,
  useMessage,
  NDataTable,
  NSwitch
} from 'naive-ui';
import { computed, h, onMounted, onUnmounted, provide, reactive, ref, watch } from 'vue';
import AutoActionEditor from './components/autoaction/AutoActionEditor.vue';

const autoActionStore = useAutoAction();
const message = useMessage();
const danmakuClient = useDanmakuClient();

// 分类标签
const typeMap = {
  [TriggerType.DANMAKU]: '自动回复',
  [TriggerType.GIFT]: '礼物感谢',
  [TriggerType.GUARD]: '舰长相关',
  [TriggerType.FOLLOW]: '关注感谢',
  [TriggerType.ENTER]: '入场欢迎',
  [TriggerType.SCHEDULED]: '定时发送',
  [TriggerType.SUPER_CHAT]: 'SC感谢',
};

// 类型总开关状态
const typeEnabledStatus = reactive<Record<string, boolean>>({});

// 初始化每种类型的启用状态（默认启用）
Object.values(TriggerType).forEach(type => {
  typeEnabledStatus[type as string] = true;
});

// 激活的标签页
const activeTab = ref(TriggerType.GIFT);

// 添加自动操作模态框
const showAddModal = ref(false);
const selectedTriggerType = ref<TriggerType>(TriggerType.GIFT);

// 正在编辑的自动操作
const editingActionId = ref<string | null>(null);

const triggerTypeOptions = [
  { label: '自动回复', value: TriggerType.DANMAKU },
  { label: '礼物感谢', value: TriggerType.GIFT },
  { label: '舰长相关', value: TriggerType.GUARD },
  { label: '关注感谢', value: TriggerType.FOLLOW },
  { label: '入场欢迎', value: TriggerType.ENTER },
  { label: '定时发送', value: TriggerType.SCHEDULED },
  { label: 'SC感谢', value: TriggerType.SUPER_CHAT },
];

// 自定义列存储，按触发类型分组
const customColumnsByType = reactive<Record<string, any[]>>({});

// 基础表格列定义
const baseColumns = [
  {
    title: '名称',
    key: 'name',
    render: (row: AutoActionItem) => {
      return h('div', { style: 'font-weight: 500' }, row.name || '未命名自动操作');
    }
  },
  {
    title: '状态',
    key: 'enabled',
    width: 100,
    render: (row: AutoActionItem) => {
      const status = getStatusTag(row);
      return h(
        NTag,
        {
          type: status.type,
          size: 'small',
          round: true,
          style: 'cursor: pointer;',
          onClick: () => toggleActionStatus(row)
        },
        { default: () => status.text }
      );
    }
  },
];

// 定义定时任务的剩余时间列
const remainingTimeColumn = {
  title: '剩余时间',
  key: 'remainingTime',
  width: 150,
  render: (row: AutoActionItem) => {
    // 从runtimeState中获取该任务的定时器状态
    const timer = autoActionStore.runtimeState.scheduledTimers[row.id];

    if (timer) {
      // 从store中获取剩余时间
      const timerInfo = autoActionStore.getScheduledTimerInfo(row.id);
      const remainingMs = timerInfo?.remainingMs || 0;

      // 获取状态标记
      const remainingSeconds = Math.floor(remainingMs / 1000);

      // 根据剩余时间确定状态
      let statusType: 'success' | 'warning' | 'error' = 'success';
      let statusText = '等待中';

      if (remainingSeconds <= 10) {
        statusType = 'error';
        statusText = '即将发送';
      } else if (remainingSeconds <= 30) {
        statusType = 'warning';
        statusText = '即将发送';
      }

      return h(
        NSpace,
        { align: 'center' },
        {
          default: () => [
            h(NCountdown, {
              duration: remainingMs,
              precision: 0,
              render: (props) => {
                const { minutes, seconds } = props;
                return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
              }
            }),
            h(
              NTag,
              {
                type: statusType,
                size: 'small',
                round: true
              },
              { default: () => statusText }
            )
          ]
        }
      );
    } else {
      // 没有定时器，显示未设置状态
      return h(
        NTag,
        {
          type: 'default',
          size: 'small',
          round: true
        },
        { default: () => '未启动' }
      );
    }
  }
};

// 操作列定义
const actionsColumn = {
  title: '操作',
  key: 'actions',
  width: 180,
  render: (row: AutoActionItem) => {
    return h(
      NSpace,
      { justify: 'end', align: 'center' },
      {
        default: () => [
          h(
            NButton,
            {
              size: 'small',
              type: 'primary',
              ghost: true,
              onClick: () => editAction(row.id)
            },
            { default: () => '编辑' }
          ),
          h(
            NDropdown,
            {
              trigger: 'hover',
              options: [
                {
                  label: '复制',
                  key: 'duplicate',
                },
                {
                  label: '删除',
                  key: 'delete',
                }
              ],
              onSelect: (key: string) => {
                if (key === 'duplicate') duplicateAutoAction(row);
                if (key === 'delete') removeAutoAction(row);
              }
            },
            {
              default: () => h(
                NButton,
                {
                  size: 'small',
                  tertiary: true,
                  style: 'padding: 0 8px;'
                },
                { default: () => '•••' }
              )
            }
          )
        ]
      }
    );
  }
};

// 获取当前类型的列，组合基础列、自定义列和操作列
const getColumnsForType = (type: TriggerType) => {
  const customCols = customColumnsByType[type] || [];

  // 如果是定时发送类型，添加剩余时间列
  if (type === TriggerType.SCHEDULED) {
    return [...baseColumns, remainingTimeColumn, ...customCols, actionsColumn];
  }

  return [...baseColumns, ...customCols, actionsColumn];
};

// 按类型分组的自动操作
const groupedActions = computed(() => {
  const grouped: Record<string, AutoActionItem[]> = {};

  // 初始化所有分组
  Object.values(TriggerType).forEach(type => {
    grouped[type as string] = [];
  });

  // 放入对应分组
  autoActionStore.autoActions.forEach(action => {
    if (grouped[action.triggerType]) {
      grouped[action.triggerType].push(action);
    }
  });

  // 对每个组内的操作进行排序，启用的排在前面
  Object.keys(grouped).forEach(type => {
    grouped[type].sort((a, b) => {
      if (a.enabled === b.enabled) return 0;
      return a.enabled ? -1 : 1; // 启用的排在前面
    });
  });

  return grouped;
});

// 添加新的自动操作
function addAutoAction() {
  if (!selectedTriggerType.value) {
    message.error('请选择触发类型');
    return;
  }

  const newAction = autoActionStore.addAutoAction(selectedTriggerType.value);
  showAddModal.value = false;
  activeTab.value = selectedTriggerType.value; // 切换到新添加的类型的标签页
  editingActionId.value = newAction.id; // 自动打开编辑界面
  message.success('已添加新的自动操作');
}

// 删除自动操作
function removeAutoAction(action: AutoActionItem) {
  autoActionStore.removeAutoAction(action.id);
  if (editingActionId.value === action.id) {
    editingActionId.value = null;
  }
  message.success('已删除自动操作');
}

// 复制自动操作
function duplicateAutoAction(action: AutoActionItem) {
  const newAction = JSON.parse(JSON.stringify(action));
  newAction.id = `${newAction.id}-copy-${Date.now()}`;
  newAction.name += ' (复制)';
  autoActionStore.autoActions.push(newAction);
  message.success('已复制自动操作');
}

// 切换到编辑模式
function editAction(actionId: string) {
  editingActionId.value = actionId;
}

// 返回到概览
function backToOverview() {
  editingActionId.value = null;
}

// 获取状态标签
function getStatusTag(action: AutoActionItem) {
  // 如果该类型被禁用，显示为类型禁用状态
  if (!typeEnabledStatus[action.triggerType]) {
    return { type: 'warning' as const, text: '类型已禁用' };
  }

  if (!action.enabled) {
    return { type: 'error' as const, text: '已禁用' };
  }
  return { type: 'success' as const, text: '已启用' };
}

// 切换动作状态
function toggleActionStatus(action: AutoActionItem) {
  action.enabled = !action.enabled;
  message.success(`已${action.enabled ? '启用' : '禁用'}操作: ${action.name || '未命名自动操作'}`);
}

// 切换类型启用状态
function toggleTypeStatus(type: string) {
  typeEnabledStatus[type] = !typeEnabledStatus[type];
  message.success(`已${typeEnabledStatus[type] ? '启用' : '禁用'}所有${typeMap[type as TriggerType]}`);
}

// 判断自动操作是否实际启用（考虑类型总开关）
function isActionActuallyEnabled(action: AutoActionItem) {
  return action.enabled && typeEnabledStatus[action.triggerType];
}

// 在组件挂载后初始化自动操作模块
onMounted(() => {
  // 确保danmakuClient已经初始化
  if (danmakuClient.connected) {
    autoActionStore.init();

    // 添加总开关状态检查代码
    // 监听类型总开关变化，根据开关启用或禁用定时任务
    watch(typeEnabledStatus, (newStatus) => {
      // 更新定时任务
      const scheduledActions = autoActionStore.autoActions.filter(
        action => action.triggerType === TriggerType.SCHEDULED
      );

      // 如果定时发送类型被禁用，停止所有定时任务
      if (!newStatus[TriggerType.SCHEDULED]) {
        scheduledActions.forEach(action => {
          if (autoActionStore.runtimeState.scheduledTimers[action.id]) {
            clearTimeout(autoActionStore.runtimeState.scheduledTimers[action.id]!);
            autoActionStore.runtimeState.scheduledTimers[action.id] = null;
          }
        });
      } else {
        // 如果定时发送类型被启用，重新初始化自动操作
        autoActionStore.init();
      }
    }, { deep: true });

    // 修改shouldProcessAction函数，使其考虑类型总开关
    const originalShouldProcess = autoActionStore.shouldProcessAction;
    if (originalShouldProcess) {
      autoActionStore.shouldProcessAction = (action, event) => {
        // 首先检查类型总开关状态
        if (!typeEnabledStatus[action.triggerType]) {
          return false;
        }

        // 然后再执行原始检查
        return originalShouldProcess(action, event);
      };
    }
  } else {
    // 如果没有连接，等待连接状态变化后再初始化
    watch(() => danmakuClient.connected, (isConnected) => {
      if (isConnected) {
        autoActionStore.init();
      }
    });
  }

  // 提供类型启用状态和判断函数给子组件使用
  provide('typeEnabledStatus', typeEnabledStatus);
  provide('isActionActuallyEnabled', isActionActuallyEnabled);

  // 组件卸载时清理定时器
  onUnmounted(() => {
    // 清理操作保留在这里，但移除了具体的定时器引用
  });
});

</script>

<template>
  <div>
    <NAlert type="warning">
      施工中
    </NAlert>
    <NCard
      title="自动操作设置"
      size="small"
    >
      <template #header-extra>
        <NButton
          type="primary"
          @click="showAddModal = true"
        >
          添加自动操作
        </NButton>
      </template>

      <NSpace
        vertical
        size="large"
      >
        <!-- 分类标签页 -->
        <NTabs
          v-model:value="activeTab"
          type="line"
          animated
          @update:value="editingActionId = null"
        >
          <NTabPane
            v-for="(label, type) in typeMap"
            :key="type"
            :name="type"
            :tab="label"
          >
            <NSpace vertical>
              <!-- 类型总开关 -->
              <NSpace
                align="center"
                style="padding: 8px 0; margin-bottom: 8px"
              >
                <NSwitch
                  v-model:value="typeEnabledStatus[type]"
                  @update:value="toggleTypeStatus(type)"
                />
                <span>{{ typeEnabledStatus[type] ? '启用' : '禁用' }}所有{{ label }}</span>
              </NSpace>

              <!-- 如果没有此类型的动作，显示空状态 -->
              <NEmpty
                v-if="groupedActions[type].length === 0"
                description="暂无自动操作"
              >
                <template #extra>
                  <NButton
                    type="primary"
                    @click="() => { selectedTriggerType = type; showAddModal = true; }"
                  >
                    添加{{ typeMap[type] }}
                  </NButton>
                </template>
              </NEmpty>

              <!-- 此类型的所有操作概览 -->
              <div
                v-else-if="editingActionId === null"
                class="overview-container"
              >
                <NDataTable
                  :bordered="false"
                  :single-line="false"
                  :columns="getColumnsForType(type)"
                  :data="groupedActions[type]"
                >
                  <template #empty>
                    <NEmpty description="暂无数据" />
                  </template>
                </NDataTable>

                <!-- 添加按钮 -->
                <NButton
                  type="default"
                  style="width: 100%; margin-top: 16px;"
                  class="btn-with-transition"
                  @click="() => { selectedTriggerType = type; showAddModal = true; }"
                >
                  + 添加{{ typeMap[type] }}
                </NButton>
              </div>

              <!-- 编辑视图 -->
              <div
                v-else
                class="edit-container"
              >
                <NSpace vertical>
                  <NButton
                    size="small"
                    style="align-self: flex-start; margin-bottom: 8px"
                    class="back-btn btn-with-transition"
                    @click="backToOverview"
                  >
                    ← 返回列表
                  </NButton>

                  <transition-group
                    name="fade-slide"
                    tag="div"
                  >
                    <div
                      v-for="action in groupedActions[type]"
                      v-show="action.id === editingActionId"
                      :key="action.id"
                      class="action-item"
                    >
                      <!-- 编辑器组件 -->
                      <AutoActionEditor :action="action" />
                    </div>
                  </transition-group>
                </NSpace>
              </div>
            </NSpace>
          </NTabPane>
        </NTabs>
      </NSpace>
    </NCard>

    <!-- 添加新自动操作的模态框 -->
    <NModal
      v-model:show="showAddModal"
      preset="dialog"
      title="添加新的自动操作"
      positive-text="确认"
      negative-text="取消"
      class="modal-with-transition"
      @positive-click="addAutoAction"
    >
      <NSpace vertical>
        <div>请选择要添加的自动操作类型：</div>
        <NSelect
          v-model:value="selectedTriggerType"
          :options="triggerTypeOptions"
          placeholder="选择触发类型"
          style="width: 100%"
        />
      </NSpace>
    </NModal>
  </div>
</template>

<style scoped>
.action-item {
  position: relative;
  margin-bottom: 16px;
}

.action-menu-button {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 10;
}

.config-description {
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

/* 淡入淡出过渡 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 列表动画 */
.list-item {
  transition: all 0.3s ease;
}
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}
.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
.list-move {
  transition: transform 0.3s ease;
}

/* 淡入滑动过渡 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}
.fade-slide-enter-from {
  opacity: 0;
  transform: translateX(20px);
}
.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* 按钮过渡 */
.btn-with-transition {
  transition: all 0.2s ease;
}
.btn-with-transition:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

/* 返回按钮特殊动画 */
.back-btn {
  position: relative;
  overflow: hidden;
}
.back-btn::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s ease;
}
.back-btn:hover::after {
  left: 100%;
}

/* 容器过渡 */
.overview-container,
.edit-container {
  transition: all 0.4s ease;
  transform-origin: center top;
}
</style>