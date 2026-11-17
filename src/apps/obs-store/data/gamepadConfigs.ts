import type { Component } from 'vue'
import { defineAsyncComponent, markRaw } from 'vue'

import type { AllGamepadConfigs, GamepadType } from '@/types/gamepad'

const asyncSvg = (loader: () => Promise<{ default: Component }> | Promise<Component>) =>
  markRaw(defineAsyncComponent(loader as () => Promise<Component>))

// 按需懒加载手柄底壳 SVG，避免将 1.9MB 全部底壳静态打入初始 store chunk
const PS5BodyWhiteComp = asyncSvg(() => import('@/assets/controller/Body/DS/DualSense VSCView SVG.svg?component'))
const PS5BodyRedComp = asyncSvg(() => import('@/assets/controller/Body/DS/DualSense VSCView SVG Cosmic Red.svg?component'))
const PS5BodyPurpleComp = asyncSvg(
  () => import('@/assets/controller/Body/DS/DualSense VSCView SVG Galactic Purple.svg?component'),
)
const PS5BodyBlackComp = asyncSvg(
  () => import('@/assets/controller/Body/DS/DualSense VSCView SVG Midnight Black.svg?component'),
)
const PS5BodyPinkComp = asyncSvg(() => import('@/assets/controller/Body/DS/DualSense VSCView SVG Nova Pink.svg?component'))
const PS4V2BodyWhiteComp = asyncSvg(() => import('@/assets/controller/Body/DS4/DS4 V2 VSC SVG - Glacier White.svg?component'))
const PS4V2BodyGoldComp = asyncSvg(() => import('@/assets/controller/Body/DS4/DS4 V2 VSC SVG - Gold.svg?component'))
const PS4V2BodyRedComp = asyncSvg(() => import('@/assets/controller/Body/DS4/DS4 V2 VSC SVG - Magma Red.svg?component'))
const PS4V2BodyBlueComp = asyncSvg(() => import('@/assets/controller/Body/DS4/DS4 V2 VSC SVG - Midnight Blue.svg?component'))
const PS4V2BodyBlackComp = asyncSvg(() => import('@/assets/controller/Body/DS4/DS4 V2 VSC SVG.svg?component'))
const PS4BodyFrontComp = asyncSvg(() => import('@/assets/controller/Body/DS4/DS4 VSC Front SVG.svg?component'))
const PS4BodyBlackComp = asyncSvg(() => import('@/assets/controller/Body/DS4/DS4 VSC SVG.svg?component'))
const SwitchProBodyComp = asyncSvg(
  () => import('@/assets/controller/Body/SwitchPro/Switch Pro Controller VSCView.svg?component'),
)
const XboxBodyBlackComp = asyncSvg(
  () => import('@/assets/controller/Body/Xbox/XboxOneColor/Xbox One Controller VSCView Black.svg?component'),
)
const XboxBodyWhiteComp = asyncSvg(
  () => import('@/assets/controller/Body/Xbox/XboxOneColor/Xbox One Controller VSCView White.svg?component'),
)
const XboxBodyBlueComp = asyncSvg(
  () => import('@/assets/controller/Body/Xbox/XboxOneColor/Xbox One S Controller VSCView Blue.svg?component'),
)
const XboxBodyRedComp = asyncSvg(
  () => import('@/assets/controller/Body/Xbox/XboxOneColor/Xbox One S Controller VSCView Red.svg?component'),
)
const XboxSXBlackComp = asyncSvg(
  () => import('@/assets/controller/Body/Xbox/XboxSeriesXColor/Xbox Series X Controller VSCView Black.svg?component'),
)
const XboxSXBlueComp = asyncSvg(
  () => import('@/assets/controller/Body/Xbox/XboxSeriesXColor/Xbox Series X Controller VSCView Blue.svg?component'),
)
const XboxSXRedComp = asyncSvg(
  () => import('@/assets/controller/Body/Xbox/XboxSeriesXColor/Xbox Series X Controller VSCView Red.svg?component'),
)
const XboxSXWhiteComp = asyncSvg(
  () => import('@/assets/controller/Body/Xbox/XboxSeriesXColor/Xbox Series X Controller VSCView White.svg?component'),
)

export interface BodyOptionConfig {
  id: string
  name: string
  body: Component
  defaultViewBox: string
  aspectRatio: string
}

// --- 手柄底壳选项列表 ---

export const controllerBodies: Record<GamepadType, BodyOptionConfig[]> = {
  xbox: [
    {
      id: 'xsx-black',
      name: 'Xbox Series X 经典黑',
      body: XboxSXBlackComp,
      defaultViewBox: '0 0 1534.73 954.01',
      aspectRatio: '1534.73 / 954.01',
    },
    {
      id: 'xsx-white',
      name: 'Xbox Series X 冰雪白',
      body: XboxSXWhiteComp,
      defaultViewBox: '0 0 1534.73 954.01',
      aspectRatio: '1534.73 / 954.01',
    },
    {
      id: 'xsx-blue',
      name: 'Xbox Series X 极光蓝',
      body: XboxSXBlueComp,
      defaultViewBox: '0 0 1534.73 954.01',
      aspectRatio: '1534.73 / 954.01',
    },
    {
      id: 'xsx-red',
      name: 'Xbox Series X 脉冲红',
      body: XboxSXRedComp,
      defaultViewBox: '0 0 1534.73 954.01',
      aspectRatio: '1534.73 / 954.01',
    },
    {
      id: 'xb1-black',
      name: 'Xbox One 黑色',
      body: XboxBodyBlackComp,
      defaultViewBox: '0 0 1543.24 956.31',
      aspectRatio: '1543.24 / 956.31',
    },
    {
      id: 'xb1-white',
      name: 'Xbox One 白色',
      body: XboxBodyWhiteComp,
      defaultViewBox: '0 0 1543.24 956.31',
      aspectRatio: '1543.24 / 956.31',
    },
    {
      id: 'xb1s-blue',
      name: 'Xbox One S 蓝色',
      body: XboxBodyBlueComp,
      defaultViewBox: '0 0 1543.24 956.31',
      aspectRatio: '1543.24 / 956.31',
    },
    {
      id: 'xb1s-red',
      name: 'Xbox One S 红色',
      body: XboxBodyRedComp,
      defaultViewBox: '0 0 1543.24 956.31',
      aspectRatio: '1543.24 / 956.31',
    },
  ],
  ps: [
    {
      id: 'ps5-white',
      name: 'PS5 DualSense 经典白',
      body: PS5BodyWhiteComp,
      defaultViewBox: '0 0 544.707 302.911',
      aspectRatio: '544.707 / 302.911',
    },
    {
      id: 'ps5-black',
      name: 'PS5 DualSense 午夜黑',
      body: PS5BodyBlackComp,
      defaultViewBox: '0 0 544.707 302.911',
      aspectRatio: '544.707 / 302.911',
    },
    {
      id: 'ps5-red',
      name: 'PS5 DualSense 星云红',
      body: PS5BodyRedComp,
      defaultViewBox: '0 0 544.707 302.911',
      aspectRatio: '544.707 / 302.911',
    },
    {
      id: 'ps5-purple',
      name: 'PS5 DualSense 星河紫',
      body: PS5BodyPurpleComp,
      defaultViewBox: '0 0 544.707 302.911',
      aspectRatio: '544.707 / 302.911',
    },
    {
      id: 'ps5-pink',
      name: 'PS5 DualSense 新星粉',
      body: PS5BodyPinkComp,
      defaultViewBox: '0 0 544.707 302.911',
      aspectRatio: '544.707 / 302.911',
    },
    {
      id: 'ps4-black',
      name: 'PS4 黑色',
      body: PS4BodyBlackComp,
      defaultViewBox: '0 0 544.707 302.911',
      aspectRatio: '544.707 / 302.911',
    },
    {
      id: 'ps4-front',
      name: 'PS4 正面视图',
      body: PS4BodyFrontComp,
      defaultViewBox: '0 0 544.707 302.911',
      aspectRatio: '544.707 / 302.911',
    },
    {
      id: 'ps4-v2-black',
      name: 'PS4 V2 黑色',
      body: PS4V2BodyBlackComp,
      defaultViewBox: '0 0 544.707 302.911',
      aspectRatio: '544.707 / 302.911',
    },
    {
      id: 'ps4-v2-white',
      name: 'PS4 V2 冰川白',
      body: PS4V2BodyWhiteComp,
      defaultViewBox: '0 0 544.707 302.911',
      aspectRatio: '544.707 / 302.911',
    },
    {
      id: 'ps4-v2-red',
      name: 'PS4 V2 熔岩红',
      body: PS4V2BodyRedComp,
      defaultViewBox: '0 0 544.707 302.911',
      aspectRatio: '544.707 / 302.911',
    },
    {
      id: 'ps4-v2-blue',
      name: 'PS4 V2 午夜蓝',
      body: PS4V2BodyBlueComp,
      defaultViewBox: '0 0 544.707 302.911',
      aspectRatio: '544.707 / 302.911',
    },
    {
      id: 'ps4-v2-gold',
      name: 'PS4 V2 金色',
      body: PS4V2BodyGoldComp,
      defaultViewBox: '0 0 544.707 302.911',
      aspectRatio: '544.707 / 302.911',
    },
  ],
  nintendo: [
    {
      id: 'switch-pro',
      name: 'Switch Pro 经典黑',
      body: SwitchProBodyComp,
      defaultViewBox: '0 0 1200 780',
      aspectRatio: '1200 / 780',
    },
  ],
}

// --- 手柄类型默认配置 ---

export const gamepadConfigs: AllGamepadConfigs = {
  xbox: {
    name: 'Xbox Wireless Controller',
    bodySvg: XboxSXBlackComp,
    aspectRatio: '1534.73 / 954.01',
    defaultViewBox: '0 0 1534.73 954.01',
  },
  ps: {
    name: 'PlayStation DualSense / DualShock',
    bodySvg: PS5BodyWhiteComp,
    aspectRatio: '544.707 / 302.911',
    defaultViewBox: '0 0 544.707 302.911',
  },
  nintendo: {
    name: 'Nintendo Switch Pro Controller',
    bodySvg: SwitchProBodyComp,
    aspectRatio: '1200 / 780',
    defaultViewBox: '0 0 1200 780',
  },
}
