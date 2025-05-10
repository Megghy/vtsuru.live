// src/composables/useGamepad.ts
import { ref, onMounted, onUnmounted, reactive, readonly, Ref, DeepReadonly, computed, watch } from 'vue';
import { defineStore } from 'pinia';
import { useGamepad } from '@vueuse/core';
import type {
  GamepadConnectionInfo,
  RawGamepadState,
  NormalizedGamepadState,
  LogicalButton,
  ButtonInputState,
  StickInputState
} from '@/types/gamepad'; // 使用 @ 指向 src 目录
import { LogicalButtonsList } from '@/types/gamepad';

// 定义事件处理函数类型
type GamepadEventHandler = (gamepadInfo: GamepadConnectionInfo, index: number) => void;

// 标准按钮映射，根据标准布局将gamepad API的按钮索引映射到逻辑按钮
const standardButtonMap: Partial<Record<number, LogicalButton>> = {
  0: 'ACTION_DOWN',     // Xbox A / PS Cross / Nintendo B
  1: 'ACTION_RIGHT',    // Xbox B / PS Circle / Nintendo A
  2: 'ACTION_LEFT',     // Xbox X / PS Square / Nintendo Y
  3: 'ACTION_UP',       // Xbox Y / PS Triangle / Nintendo X
  4: 'LEFT_SHOULDER_1', // LB / L1
  5: 'RIGHT_SHOULDER_1', // RB / R1
  6: 'LEFT_SHOULDER_2',  // LT / L2 (触发器)
  7: 'RIGHT_SHOULDER_2', // RT / R2 (触发器)
  8: 'SELECT',           // Xbox View / PS Select / Nintendo -
  9: 'START',            // Xbox Menu / PS Start / Nintendo +
  10: 'LEFT_STICK_PRESS', // 左摇杆按下
  11: 'RIGHT_STICK_PRESS', // 右摇杆按下
  12: 'DPAD_UP',          // 方向键上
  13: 'DPAD_DOWN',        // 方向键下
  14: 'DPAD_LEFT',        // 方向键左
  15: 'DPAD_RIGHT',       // 方向键右
  16: 'HOME',             // Xbox Home / PS Home / Nintendo Home
  17: 'PS_TOUCHPAD',      // PS触摸板按下
  // 18可能对应任天堂的截图按钮
  18: 'NINTENDO_CAPTURE'
};

export const useGamepadStore = defineStore('gamepad', () => {
  const { gamepads, onConnected, onDisconnected } = useGamepad();

  const connectedGamepadInfo = ref<GamepadConnectionInfo | null>(null);
  const activeGamepadIndex = ref<number | null>(null);

  // 存储自定义事件处理器
  const connectedHandlers: Set<GamepadEventHandler> = new Set();
  const disconnectedHandlers: Set<GamepadEventHandler> = new Set();

  // 初始化所有按钮状态
  const initialButtonStates = LogicalButtonsList.reduce((acc, key) => {
    acc[key] = { pressed: false, value: 0 };
    return acc;
  }, {} as Record<LogicalButton, ButtonInputState>);

  // 手柄状态，包含按钮和摇杆
  const normalizedGamepadState = reactive<NormalizedGamepadState>({
    buttons: initialButtonStates,
    sticks: {
      LEFT_STICK: { x: 0, y: 0 },
      RIGHT_STICK: { x: 0, y: 0 },
    },
  });

  // 计算属性：手柄是否已连接
  const isGamepadConnected = computed(() => activeGamepadIndex.value !== null && !!gamepads.value[activeGamepadIndex.value]?.connected);

  // 重置手柄状态
  const resetNormalizedState = () => {
    Object.keys(normalizedGamepadState.buttons).forEach(key => {
        const buttonKey = key as LogicalButton;
        if (normalizedGamepadState.buttons[buttonKey]) {
            normalizedGamepadState.buttons[buttonKey]!.pressed = false;
            normalizedGamepadState.buttons[buttonKey]!.value = 0;
        }
    });
    normalizedGamepadState.sticks.LEFT_STICK = { x: 0, y: 0 };
    normalizedGamepadState.sticks.RIGHT_STICK = { x: 0, y: 0 };
  };

  // 更新手柄状态
  const updateNormalizedState = (gamepad: Gamepad | undefined) => {
    if (!gamepad || !gamepad.connected) {
      resetNormalizedState();
      return;
    }

    // 更新按钮状态
    gamepad.buttons.forEach((button, index) => {
      const logicalKey = standardButtonMap[index];
      if (logicalKey && normalizedGamepadState.buttons[logicalKey]) {
        normalizedGamepadState.buttons[logicalKey]!.pressed = button.pressed;
        normalizedGamepadState.buttons[logicalKey]!.value = button.value;
      }
    });

    // 更新摇杆状态
    normalizedGamepadState.sticks.LEFT_STICK.x = gamepad.axes[0] ?? 0;
    normalizedGamepadState.sticks.LEFT_STICK.y = gamepad.axes[1] ?? 0;
    normalizedGamepadState.sticks.RIGHT_STICK.x = gamepad.axes[2] ?? 0;
    normalizedGamepadState.sticks.RIGHT_STICK.y = gamepad.axes[3] ?? 0;
  };

  // 手柄连接事件处理
  onConnected((index: number) => {
    const gamepad = navigator.getGamepads()[index];
    if (!gamepad) return;

    console.log('手柄已连接:', gamepad.id, '索引:', index);
    // 如果当前没有活动的，或者连接的是同一个，则激活
    if (activeGamepadIndex.value === null || activeGamepadIndex.value === index) {
      activeGamepadIndex.value = index;
      connectedGamepadInfo.value = {
        id: gamepad.id,
        mapping: gamepad.mapping
      };

      // 触发外部注册的连接事件处理器
      if (connectedGamepadInfo.value) {
        connectedHandlers.forEach(handler => {
          try {
            handler(connectedGamepadInfo.value!, index);
          } catch (err) {
            console.error('手柄连接事件处理器执行错误:', err);
          }
        });
      }
    } else {
      // 如果已有活动手柄，而新连接的手柄不是当前活动的，则忽略，或按需处理（例如允许切换）
      console.log(`另一个手柄 (索引: ${activeGamepadIndex.value}) 已经处于活动状态`);
    }
  });

  // 手柄断开连接事件处理
  onDisconnected((index: number) => {
    const gamepadCache = gamepads.value[index];
    if (!gamepadCache) return;

    console.log('手柄已断开连接:', gamepadCache.id);

    // 保存断开连接前的信息，用于触发事件
    const disconnectedInfo = connectedGamepadInfo.value ? { ...connectedGamepadInfo.value } : null;

    if (activeGamepadIndex.value === index) {
      activeGamepadIndex.value = null;
      connectedGamepadInfo.value = null;
      resetNormalizedState();

      // 触发外部注册的断开连接事件处理器
      if (disconnectedInfo) {
        disconnectedHandlers.forEach(handler => {
          try {
            handler(disconnectedInfo, index);
          } catch (err) {
            console.error('手柄断开连接事件处理器执行错误:', err);
          }
        });
      }

      // 尝试连接其他已连接的手柄 (VueUse 的 gamepads 数组会自动更新)
      const nextGamepad = gamepads.value.find(gp => gp && gp.connected);
      if (nextGamepad) {
        activeGamepadIndex.value = nextGamepad.index;
        connectedGamepadInfo.value = {
          id: nextGamepad.id,
          mapping: nextGamepad.mapping
        };

        // 如果自动切换到其他手柄，也触发连接事件
        connectedHandlers.forEach(handler => {
          try {
            handler(connectedGamepadInfo.value!, nextGamepad.index);
          } catch (err) {
            console.error('手柄连接事件处理器执行错误:', err);
          }
        });
      }
    }
  });

  // 监视 VueUse 的 gamepads 数组中的活动手柄
  // VueUse 内部使用 rAF 来更新 gamepads 数组中的状态
  watch(
    () => {
      // 确保 activeGamepadIndex.value 不为 null，并且对应的 gamepad 存在
      return activeGamepadIndex.value !== null && gamepads.value[activeGamepadIndex.value]
        ? gamepads.value[activeGamepadIndex.value]
        : undefined;
    },
    (activePad) => {
      updateNormalizedState(activePad);
    },
    { deep: true, immediate: true } // immediate: true 保证初始状态也被处理
  );

  // 对外提供的连接事件注册方法
  const onGamepadConnected = (handler: GamepadEventHandler) => {
    connectedHandlers.add(handler);

    // 如果当前已有连接的手柄，立即触发一次事件
    if (isGamepadConnected.value && connectedGamepadInfo.value && activeGamepadIndex.value !== null) {
      handler(connectedGamepadInfo.value, activeGamepadIndex.value);
    }

    // 返回取消注册的函数
    return () => {
      connectedHandlers.delete(handler);
    };
  };

  // 对外提供的断开连接事件注册方法
  const onGamepadDisconnected = (handler: GamepadEventHandler) => {
    disconnectedHandlers.add(handler);

    // 返回取消注册的函数
    return () => {
      disconnectedHandlers.delete(handler);
    };
  };

  return {
    connectedGamepadInfo: readonly(connectedGamepadInfo),
    normalizedGamepadState: readonly(normalizedGamepadState),
    isGamepadConnected: readonly(isGamepadConnected),
    onConnected: onGamepadConnected,
    onDisconnected: onGamepadDisconnected,
  };
});
