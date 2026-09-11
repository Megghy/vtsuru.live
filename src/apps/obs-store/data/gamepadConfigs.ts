import type { Component } from 'vue'
import { markRaw } from 'vue'

// --- PS5 DualSense 底壳 ---
import PS5BodyWhiteComp from '@/assets/controller/Body/DS/DualSense VSCView SVG.svg?component'
import PS5BodyBlackComp from '@/assets/controller/Body/DS/DualSense VSCView SVG Midnight Black.svg?component'
import PS5BodyRedComp from '@/assets/controller/Body/DS/DualSense VSCView SVG Cosmic Red.svg?component'
import PS5BodyPurpleComp from '@/assets/controller/Body/DS/DualSense VSCView SVG Galactic Purple.svg?component'
import PS5BodyPinkComp from '@/assets/controller/Body/DS/DualSense VSCView SVG Nova Pink.svg?component'

// --- PS4 底壳 ---
import PS4BodyBlackComp from '@/assets/controller/Body/DS4/DS4 VSC SVG.svg?component'
import PS4BodyFrontComp from '@/assets/controller/Body/DS4/DS4 VSC Front SVG.svg?component'
import PS4V2BodyBlackComp from '@/assets/controller/Body/DS4/DS4 V2 VSC SVG.svg?component'
import PS4V2BodyWhiteComp from '@/assets/controller/Body/DS4/DS4 V2 VSC SVG - Glacier White.svg?component'
import PS4V2BodyRedComp from '@/assets/controller/Body/DS4/DS4 V2 VSC SVG - Magma Red.svg?component'
import PS4V2BodyBlueComp from '@/assets/controller/Body/DS4/DS4 V2 VSC SVG - Midnight Blue.svg?component'
import PS4V2BodyGoldComp from '@/assets/controller/Body/DS4/DS4 V2 VSC SVG - Gold.svg?component'

// --- Switch Pro 底壳 ---
import SwitchProBodyComp from '@/assets/controller/Body/SwitchPro/Switch Pro Controller VSCView.svg?component'

// --- Xbox One 底壳 ---
import XboxBodyBlackComp from '@/assets/controller/Body/Xbox/XboxOneColor/Xbox One Controller VSCView Black.svg?component'
import XboxBodyWhiteComp from '@/assets/controller/Body/Xbox/XboxOneColor/Xbox One Controller VSCView White.svg?component'
import XboxBodyBlueComp from '@/assets/controller/Body/Xbox/XboxOneColor/Xbox One S Controller VSCView Blue.svg?component'
import XboxBodyRedComp from '@/assets/controller/Body/Xbox/XboxOneColor/Xbox One S Controller VSCView Red.svg?component'

// --- Xbox Series X 底壳 ---
import XboxSXBlackComp from '@/assets/controller/Body/Xbox/XboxSeriesXColor/Xbox Series X Controller VSCView Black.svg?component'
import XboxSXWhiteComp from '@/assets/controller/Body/Xbox/XboxSeriesXColor/Xbox Series X Controller VSCView White.svg?component'
import XboxSXBlueComp from '@/assets/controller/Body/Xbox/XboxSeriesXColor/Xbox Series X Controller VSCView Blue.svg?component'
import XboxSXRedComp from '@/assets/controller/Body/Xbox/XboxSeriesXColor/Xbox Series X Controller VSCView Red.svg?component'

import type { AllGamepadConfigs, GamepadType } from '@/types/gamepad'

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
      body: markRaw(XboxSXBlackComp),
      defaultViewBox: '0 0 1534.73 954.01',
      aspectRatio: '1534.73 / 954.01',
    },
    {
      id: 'xsx-white',
      name: 'Xbox Series X 冰雪白',
      body: markRaw(XboxSXWhiteComp),
      defaultViewBox: '0 0 1534.73 954.01',
      aspectRatio: '1534.73 / 954.01',
    },
    {
      id: 'xsx-blue',
      name: 'Xbox Series X 极光蓝',
      body: markRaw(XboxSXBlueComp),
      defaultViewBox: '0 0 1534.73 954.01',
      aspectRatio: '1534.73 / 954.01',
    },
    {
      id: 'xsx-red',
      name: 'Xbox Series X 脉冲红',
      body: markRaw(XboxSXRedComp),
      defaultViewBox: '0 0 1534.73 954.01',
      aspectRatio: '1534.73 / 954.01',
    },
    {
      id: 'xb1-black',
      name: 'Xbox One 黑色',
      body: markRaw(XboxBodyBlackComp),
      defaultViewBox: '0 0 1543.24 956.31',
      aspectRatio: '1543.24 / 956.31',
    },
    {
      id: 'xb1-white',
      name: 'Xbox One 白色',
      body: markRaw(XboxBodyWhiteComp),
      defaultViewBox: '0 0 1543.24 956.31',
      aspectRatio: '1543.24 / 956.31',
    },
    {
      id: 'xb1s-blue',
      name: 'Xbox One S 蓝色',
      body: markRaw(XboxBodyBlueComp),
      defaultViewBox: '0 0 1543.24 956.31',
      aspectRatio: '1543.24 / 956.31',
    },
    {
      id: 'xb1s-red',
      name: 'Xbox One S 红色',
      body: markRaw(XboxBodyRedComp),
      defaultViewBox: '0 0 1543.24 956.31',
      aspectRatio: '1543.24 / 956.31',
    },
  ],
  ps: [
    {
      id: 'ps5-white',
      name: 'PS5 DualSense 经典白',
      body: markRaw(PS5BodyWhiteComp),
      defaultViewBox: '0 0 544.707 302.911',
      aspectRatio: '544.707 / 302.911',
    },
    {
      id: 'ps5-black',
      name: 'PS5 DualSense 午夜黑',
      body: markRaw(PS5BodyBlackComp),
      defaultViewBox: '0 0 544.707 302.911',
      aspectRatio: '544.707 / 302.911',
    },
    {
      id: 'ps5-red',
      name: 'PS5 DualSense 星云红',
      body: markRaw(PS5BodyRedComp),
      defaultViewBox: '0 0 544.707 302.911',
      aspectRatio: '544.707 / 302.911',
    },
    {
      id: 'ps5-purple',
      name: 'PS5 DualSense 星河紫',
      body: markRaw(PS5BodyPurpleComp),
      defaultViewBox: '0 0 544.707 302.911',
      aspectRatio: '544.707 / 302.911',
    },
    {
      id: 'ps5-pink',
      name: 'PS5 DualSense 新星粉',
      body: markRaw(PS5BodyPinkComp),
      defaultViewBox: '0 0 544.707 302.911',
      aspectRatio: '544.707 / 302.911',
    },
    {
      id: 'ps4-black',
      name: 'PS4 黑色',
      body: markRaw(PS4BodyBlackComp),
      defaultViewBox: '0 0 544.707 302.911',
      aspectRatio: '544.707 / 302.911',
    },
    {
      id: 'ps4-front',
      name: 'PS4 正面视图',
      body: markRaw(PS4BodyFrontComp),
      defaultViewBox: '0 0 544.707 302.911',
      aspectRatio: '544.707 / 302.911',
    },
    {
      id: 'ps4-v2-black',
      name: 'PS4 V2 黑色',
      body: markRaw(PS4V2BodyBlackComp),
      defaultViewBox: '0 0 544.707 302.911',
      aspectRatio: '544.707 / 302.911',
    },
    {
      id: 'ps4-v2-white',
      name: 'PS4 V2 冰川白',
      body: markRaw(PS4V2BodyWhiteComp),
      defaultViewBox: '0 0 544.707 302.911',
      aspectRatio: '544.707 / 302.911',
    },
    {
      id: 'ps4-v2-red',
      name: 'PS4 V2 熔岩红',
      body: markRaw(PS4V2BodyRedComp),
      defaultViewBox: '0 0 544.707 302.911',
      aspectRatio: '544.707 / 302.911',
    },
    {
      id: 'ps4-v2-blue',
      name: 'PS4 V2 午夜蓝',
      body: markRaw(PS4V2BodyBlueComp),
      defaultViewBox: '0 0 544.707 302.911',
      aspectRatio: '544.707 / 302.911',
    },
    {
      id: 'ps4-v2-gold',
      name: 'PS4 V2 金色',
      body: markRaw(PS4V2BodyGoldComp),
      defaultViewBox: '0 0 544.707 302.911',
      aspectRatio: '544.707 / 302.911',
    },
  ],
  nintendo: [
    {
      id: 'switch-pro',
      name: 'Switch Pro 经典黑',
      body: markRaw(SwitchProBodyComp),
      defaultViewBox: '0 0 1200 780',
      aspectRatio: '1200 / 780',
    },
  ],
}

// --- 手柄类型默认配置 ---

export const gamepadConfigs: AllGamepadConfigs = {
  xbox: {
    name: 'Xbox Wireless Controller',
    bodySvg: markRaw(XboxSXBlackComp),
    aspectRatio: '1534.73 / 954.01',
    defaultViewBox: '0 0 1534.73 954.01',
  },
  ps: {
    name: 'PlayStation DualSense / DualShock',
    bodySvg: markRaw(PS5BodyWhiteComp),
    aspectRatio: '544.707 / 302.911',
    defaultViewBox: '0 0 544.707 302.911',
  },
  nintendo: {
    name: 'Nintendo Switch Pro Controller',
    bodySvg: markRaw(SwitchProBodyComp),
    aspectRatio: '1200 / 780',
    defaultViewBox: '0 0 1200 780',
  },
}
