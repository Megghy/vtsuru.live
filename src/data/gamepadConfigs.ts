import StickSvgComp from '@/assets/controller/Shared/shared-Left Joystick.svg?component'
import RightStickSvgComp from '@/assets/controller/Shared/shared-Right Joystick.svg?component'
import StickClickSvgComp from '@/assets/controller/Shared/shared-Left Stick Click.svg?component'
import RightStickClickSvgComp from '@/assets/controller/Shared/shared-Right Stick Click.svg?component'

import XboxBodyBlackComp from '@/assets/controller/Body/Xbox/XboxOneColor/Xbox One Controller VSCView Black.svg?component'
import XboxBodyWhiteComp from '@/assets/controller/Body/Xbox/XboxOneColor/Xbox One Controller VSCView White.svg?component'
import XboxBodyBlueComp from '@/assets/controller/Body/Xbox/XboxOneColor/Xbox One S Controller VSCView Blue.svg?component'
import XboxBodyRedComp from '@/assets/controller/Body/Xbox/XboxOneColor/Xbox One S Controller VSCView Red.svg?component'

import PS4BodyBlackComp from '@/assets/controller/Body/DS4/DS4 VSC SVG.svg?component'
import PS4BodyFrontComp from '@/assets/controller/Body/DS4/DS4 VSC Front SVG.svg?component'
import PS4V2BodyBlackComp from '@/assets/controller/Body/DS4/DS4 V2 VSC SVG.svg?component'
import PS4V2BodyWhiteComp from '@/assets/controller/Body/DS4/DS4 V2 VSC SVG - Glacier White.svg?component'
import PS4V2BodyRedComp from '@/assets/controller/Body/DS4/DS4 V2 VSC SVG - Magma Red.svg?component'
import PS4V2BodyBlueComp from '@/assets/controller/Body/DS4/DS4 V2 VSC SVG - Midnight Blue.svg?component'
import PS4V2BodyGoldComp from '@/assets/controller/Body/DS4/DS4 V2 VSC SVG - Gold.svg?component'
import PS5BodyBlackComp from '@/assets/controller/Body/DS/DualSense VSCView SVG.svg?component'
import PS5BodyWhiteComp from '@/assets/controller/Body/DS/DualSense VSCView SVG Midnight Black.svg?component'

import SwitchProBodyComp from '@/assets/controller/Body/SwitchPro/Switch Pro Controller VSCView.svg?component'

import XboxASvgComp from '@/assets/controller/Shared/shared-A.svg?component'
import XboxBSvgComp from '@/assets/controller/Shared/shared-B.svg?component'
import XboxXSvgComp from '@/assets/controller/Shared/shared-X.svg?component'
import XboxYSvgComp from '@/assets/controller/Shared/shared-Y.svg?component'
import XboxDpadUpSvgComp from '@/assets/controller/Shared/shared-D-PAD Up.svg?component'
import XboxDpadDownSvgComp from '@/assets/controller/Shared/shared-D-PA Down.svg?component'
import XboxDpadLeftSvgComp from '@/assets/controller/Shared/shared-D-PAD Left.svg?component'
import XboxDpadRightSvgComp from '@/assets/controller/Shared/shared-D-PAD Right.svg?component'
import XboxLBSvgComp from '@/assets/controller/Shared/shared-L1.svg?component'
import XboxRBSvgComp from '@/assets/controller/Shared/shared-R1.svg?component'
import XboxLTSvgComp from '@/assets/controller/Shared/shared-L2.svg?component'
import XboxRTSvgComp from '@/assets/controller/Shared/shared-R2.svg?component'
import XboxViewSvgComp from '@/assets/controller/Xbox/xbox-View.svg?component'
import XboxMenuSvgComp from '@/assets/controller/Xbox/xbox-Menu.svg?component'
import XboxGuideSvgComp from '@/assets/controller/Xbox/xbox-Guide.svg?component'

import PsCrossSvgComp from '@/assets/controller/PlayStation/ps-Cross.svg?component'
import PsCircleSvgComp from '@/assets/controller/PlayStation/ps-Circle.svg?component'
import PsSquareSvgComp from '@/assets/controller/PlayStation/ps-Square.svg?component'
import PsTriangleSvgComp from '@/assets/controller/PlayStation/ps-Triangle.svg?component'
import PsTouchpadSvgComp from '@/assets/controller/PlayStation/ps5-Touchpad.svg?component'
import PsL1SvgComp from '@/assets/controller/PlayStation/ps-D-PAD Left.svg?component'
import PsR1SvgComp from '@/assets/controller/PlayStation/ps-D-PAD Right.svg?component'
import PsL2SvgComp from '@/assets/controller/Shared/shared-L2.svg?component'
import PsR2SvgComp from '@/assets/controller/Shared/shared-R2.svg?component'
import PsCreateSvgComp from '@/assets/controller/PlayStation/ps5-Create.svg?component'
import PsOptionsSvgComp from '@/assets/controller/PlayStation/ps5-Option.svg?component'
import PsGuideSvgComp from '@/assets/controller/PlayStation/ps-Guide.svg?component'

import NintendoASvgComp from '@/assets/controller/Nintendo/nintendo-positional prompt A.svg?component'
import NintendoBSvgComp from '@/assets/controller/Nintendo/nintendo-positional prompt B.svg?component'
import NintendoXSvgComp from '@/assets/controller/Nintendo/nintendo-positional prompt X.svg?component'
import NintendoYSvgComp from '@/assets/controller/Nintendo/nintendo-positional prompt Y.svg?component'
import NintendoCaptureSvgComp from '@/assets/controller/Nintendo/nintendoswitch-Capture.svg?component'
import NintendoLSvgComp from '@/assets/controller/Nintendo/nintendo-L.svg?component'
import NintendoRSvgComp from '@/assets/controller/Nintendo/nintendo-R.svg?component'
import NintendoZLSvgComp from '@/assets/controller/Nintendo/nintendo-ZL.svg?component'
import NintendoZRSvgComp from '@/assets/controller/Nintendo/nintendo-ZR.svg?component'
import NintendoPlusSvgComp from '@/assets/controller/Nintendo/nintendo-Plus.svg?component'
import NintendoMinusSvgComp from '@/assets/controller/Nintendo/nintendo-Minus.svg?component'

import type { AllGamepadConfigs, GamepadType, LogicalButton } from '@/types/gamepad'
import type { Component } from 'vue'
import { markRaw } from 'vue'

export interface BodyOptionConfig {
  name: string
  body: Component
  defaultViewBox?: string
}

const L3 = 'LEFT_STICK_PRESS' as LogicalButton
const R3 = 'RIGHT_STICK_PRESS' as LogicalButton
const ACTIONDOWN = 'ACTION_DOWN' as LogicalButton
const ACTIONRIGHT = 'ACTION_RIGHT' as LogicalButton
const ACTIONLEFT = 'ACTION_LEFT' as LogicalButton
const ACTIONUP = 'ACTION_UP' as LogicalButton
const DPADUP = 'DPAD_UP' as LogicalButton
const DPADDOWN = 'DPAD_DOWN' as LogicalButton
const DPADLEFT = 'DPAD_LEFT' as LogicalButton
const DPADRIGHT = 'DPAD_RIGHT' as LogicalButton
const L1 = 'LEFT_SHOULDER_1' as LogicalButton
const R1 = 'RIGHT_SHOULDER_1' as LogicalButton
const L2 = 'LEFT_SHOULDER_2' as LogicalButton
const R2 = 'RIGHT_SHOULDER_2' as LogicalButton
const SELECT = 'SELECT' as LogicalButton
const START = 'START' as LogicalButton
const GUIDE = 'HOME' as LogicalButton
const PSTOUCHPAD = 'PS_TOUCHPAD' as LogicalButton
const NINTENDOCAPTURE = 'NINTENDO_CAPTURE' as LogicalButton

export const controllerBodies: Record<GamepadType, BodyOptionConfig[]> = {
  xbox: [
    { name: 'Xbox One 黑色', body: markRaw(XboxBodyBlackComp), defaultViewBox: '0 0 1543 956' },
    { name: 'Xbox One 白色', body: markRaw(XboxBodyWhiteComp), defaultViewBox: '0 0 1543 956' },
    { name: 'Xbox One S 蓝色', body: markRaw(XboxBodyBlueComp), defaultViewBox: '0 0 1543 956' },
    { name: 'Xbox One S 红色', body: markRaw(XboxBodyRedComp), defaultViewBox: '0 0 1543 956' },
  ],
  ps: [
    { name: 'PS5 DualSense 黑色', body: markRaw(PS5BodyBlackComp), defaultViewBox: '0 0 544.707 302.911' },
    { name: 'PS5 DualSense 白色', body: markRaw(PS5BodyWhiteComp), defaultViewBox: '0 0 544.707 302.911' },
    { name: 'PS4 黑色', body: markRaw(PS4BodyBlackComp), defaultViewBox: '0 0 544.707 302.911' },
    { name: 'PS4 正面视图', body: markRaw(PS4BodyFrontComp), defaultViewBox: '0 0 544.707 302.911' },
    { name: 'PS4 V2 黑色', body: markRaw(PS4V2BodyBlackComp), defaultViewBox: '0 0 544.707 302.911' },
    { name: 'PS4 V2 冰川白', body: markRaw(PS4V2BodyWhiteComp), defaultViewBox: '0 0 544.707 302.911' },
    { name: 'PS4 V2 熔岩红', body: markRaw(PS4V2BodyRedComp), defaultViewBox: '0 0 544.707 302.911' },
    { name: 'PS4 V2 午夜蓝', body: markRaw(PS4V2BodyBlueComp), defaultViewBox: '0 0 544.707 302.911' },
    { name: 'PS4 V2 金色', body: markRaw(PS4V2BodyGoldComp), defaultViewBox: '0 0 544.707 302.911' },
  ],
  nintendo: [
    { name: 'Switch Pro', body: markRaw(SwitchProBodyComp), defaultViewBox: '0 0 1200 780' },
  ],
}

function parseAspectRatioToViewBox(aspectRatio: string): string | undefined {
  const parts = aspectRatio.split('/')
  if (parts.length === 2) {
    const width = Number.parseFloat(parts[0])
    const height = Number.parseFloat(parts[1])
    if (!isNaN(width) && !isNaN(height)) {
      return `0 0 ${width} ${height}`
    }
  }
  return undefined
}

export interface ControllerComponentStructure {
  name: string
  path?: string
  type: 'button' | 'stick' | 'dpad' | 'trigger' | 'group'
  logicalButton?: LogicalButton | string
  childComponents?: ControllerComponentStructure[]
}

const xboxControllerStructure: ControllerComponentStructure[] = [
  {
    name: '控制器主体',
    type: 'group',
    path: 'Xbox One Controller Body',
  },
  {
    name: '摇杆',
    type: 'group',
    childComponents: [
      {
        name: '左摇杆',
        type: 'stick',
        logicalButton: 'LEFT_STICK',
        path: 'Left Stick',
        childComponents: [
          { name: 'Outline', type: 'group', path: 'Left Stick Outline' },
          { name: 'Color', type: 'group', path: 'Left Stick Color' },
        ],
      },
      {
        name: '右摇杆',
        type: 'stick',
        logicalButton: 'RIGHT_STICK',
        path: 'Right Stick',
        childComponents: [
          { name: 'Outline', type: 'group', path: 'Right Stick Outline' },
          { name: 'Color', type: 'group', path: 'Right Stick Color' },
        ],
      },
    ],
  },
  {
    name: '中央按钮',
    type: 'group',
    childComponents: [
      {
        name: 'Xbox按钮',
        type: 'button',
        logicalButton: GUIDE,
        path: 'Xbox Guide Button',
        childComponents: [
          { name: 'Outline', type: 'group', path: 'Xbox Guide Button Outline' },
          { name: 'Color', type: 'group', path: 'Xbox Guide Button Color' },
          { name: 'Icon', type: 'group', path: 'Xbox Icon (OG)' },
        ],
      },
      {
        name: 'View按钮',
        type: 'button',
        logicalButton: SELECT,
        path: 'View Button',
        childComponents: [
          { name: 'Outline', type: 'group', path: 'View Button Outline' },
          { name: 'Color', type: 'group', path: 'View Button Color' },
          { name: 'Icon', type: 'group', path: 'View Button Icon' },
        ],
      },
      {
        name: 'Menu按钮',
        type: 'button',
        logicalButton: START,
        path: 'Menu Button',
        childComponents: [
          { name: 'Outline', type: 'group', path: 'Menu Button Outline' },
          { name: 'Color', type: 'group', path: 'Menu Button Color' },
          { name: 'Icon', type: 'group', path: 'Menu Button Icon' },
        ],
      },
    ],
  },
  {
    name: '面部按钮',
    type: 'group',
    path: 'Face Button',
    childComponents: [
      {
        name: '面部按钮点',
        type: 'group',
        path: 'Face Button Dot',
      },
      {
        name: 'A按钮',
        type: 'button',
        logicalButton: ACTIONDOWN,
        path: 'A Button',
        childComponents: [
          { name: 'Outline', type: 'group', path: 'A Button Outline' },
          { name: 'Color', type: 'group', path: 'A Button Color' },
          { name: 'Text', type: 'group', path: 'A Button Text' },
        ],
      },
      {
        name: 'B按钮',
        type: 'button',
        logicalButton: ACTIONRIGHT,
        path: 'B Button',
        childComponents: [
          { name: 'Text', type: 'group', path: 'Text' },
          { name: 'Color', type: 'group', path: 'Color' },
          { name: 'Outline', type: 'group', path: 'B Button Outline' },
        ],
      },
      {
        name: 'X按钮',
        type: 'button',
        logicalButton: ACTIONLEFT,
        path: 'X Button',
        childComponents: [
          { name: 'Outline', type: 'group', path: 'X Button Outline' },
          { name: 'Color', type: 'group', path: 'X Button Color' },
          { name: 'Text', type: 'group', path: 'X Button Text' },
        ],
      },
      {
        name: 'Y按钮',
        type: 'button',
        logicalButton: ACTIONUP,
        path: 'Y Button',
        childComponents: [
          { name: 'Outline', type: 'group', path: 'Y Button Outline' },
          { name: 'Color', type: 'group', path: 'Y Button Color' },
          { name: 'Text', type: 'group', path: 'Y Button Text' },
        ],
      },
    ],
  },
  {
    name: '方向键组',
    type: 'group',
    path: 'Directional Pads',
    childComponents: [
      {
        name: 'D-PAD',
        type: 'dpad',
        path: 'D-PAD',
        childComponents: [
          { name: 'D-PAD正面轮廓', type: 'group', path: 'D-PAD Outline Front' },
          { name: 'D-PAD底部轮廓', type: 'group', path: 'D-PAD Outline Bottom' },
          { name: 'D-PAD相关主体轮廓', type: 'group', path: 'Body Outline' },
          { name: 'D-PAD颜色', type: 'group', path: 'Color' },
        ],
      },
      {
        name: '上 (逻辑)',
        type: 'button',
        logicalButton: DPADUP,
        path: 'D-PAD Up',
      },
      {
        name: '下 (逻辑)',
        type: 'button',
        logicalButton: DPADDOWN,
        path: 'D-PAD Down',
      },
      {
        name: '左 (逻辑)',
        type: 'button',
        logicalButton: DPADLEFT,
        path: 'D-PAD Left',
      },
      {
        name: '右 (逻辑)',
        type: 'button',
        logicalButton: DPADRIGHT,
        path: 'D-PAD Right',
      },
    ],
  },
  {
    name: '肩部按钮',
    type: 'group',
    path: 'Xbox One Bumpers',
    childComponents: [
      {
        name: '左肩按钮',
        type: 'button',
        logicalButton: L1,
        path: 'Left Bumper',
        childComponents: [
          { name: 'Outline', type: 'group', path: 'LB Outline' },
          { name: 'Color', type: 'group', path: 'Color' },
          { name: 'Text', type: 'group', path: 'LB Text' },
        ],
      },
      {
        name: '右肩按钮',
        type: 'button',
        logicalButton: R1,
        path: 'Right Bumper',
        childComponents: [
          { name: 'Outline', type: 'group', path: 'RB Outline' },
          { name: 'Color', type: 'group', path: 'Color' },
          { name: 'Text', type: 'group', path: 'RB Text' },
        ],
      },
      {
        name: '配对按钮',
        type: 'button',
        path: 'Pair Button',
      },
      { name: 'Xbox One 控制器轮廓 (肩部)', type: 'group', path: 'Xbox One Controller Outline' },
      { name: 'Xbox One S 控制器轮廓 (肩部)', type: 'group', path: 'Xbox One S Controller Outline' },
      { name: '肩部整体颜色', type: 'group', path: 'Color' },
    ],
  },
  {
    name: '扳机键',
    type: 'group',
    path: 'Xbox One Triggers',
    childComponents: [
      {
        name: '左扳机',
        type: 'trigger',
        logicalButton: L2,
        path: 'Left Trigger',
        childComponents: [
          { name: 'Outline', type: 'group', path: 'LT Outline' },
          { name: 'Color', type: 'group', path: 'Color' },
          { name: 'Text', type: 'group', path: 'LT Text' },
        ],
      },
      {
        name: '右扳机',
        type: 'trigger',
        logicalButton: R2,
        path: 'Right Trigger',
        childComponents: [
          { name: 'Outline', type: 'group', path: 'RT Outline' },
          { name: 'Color', type: 'group', path: 'Color' },
          { name: 'Text', type: 'group', path: 'RT Text' },
        ],
      },
    ],
  },
]

const psControllerStructure: ControllerComponentStructure[] = [
  {
    name: 'D-PAD',
    type: 'group',
    path: 'D-PAD',
    childComponents: [
      {
        name: 'D-PAD Right',
        type: 'button',
        logicalButton: DPADRIGHT,
        path: 'D-PAD Right',
        childComponents: [
          { name: 'Symbol', type: 'group', path: 'Symbol' },
          { name: 'Outline', type: 'group', path: 'Outline' },
          { name: 'Color', type: 'group', path: 'Color' },
        ],
      },
      {
        name: 'D-PAD Down',
        type: 'button',
        logicalButton: DPADDOWN,
        path: 'D-PAD Down',
      },
      {
        name: 'D-PAD Left',
        type: 'button',
        logicalButton: DPADLEFT,
        path: 'D-PAD Left',
      },
      {
        name: 'D-PAD Up',
        type: 'button',
        logicalButton: DPADUP,
        path: 'D-PAD Up',
      },
    ],
  },
  {
    name: '摇杆',
    type: 'group',
    childComponents: [
      {
        name: '左摇杆',
        type: 'stick',
        logicalButton: 'LEFT_STICK',
        path: 'Left Stick',
        childComponents: [
          { name: 'Outline', type: 'group', path: 'Left Stick Outline' },
          { name: 'Color', type: 'group', path: 'Left Stick Color' },
        ],
      },
      {
        name: '右摇杆',
        type: 'stick',
        logicalButton: 'RIGHT_STICK',
        path: 'Right Stick',
        childComponents: [
          { name: 'Outline', type: 'group', path: 'Right Stick Outline' },
          { name: 'Color', type: 'group', path: 'Right Stick Color' },
        ],
      },
    ],
  },
  {
    name: '面部按钮',
    type: 'group',
    childComponents: [
      {
        name: 'Face Button',
        type: 'group',
        path: 'Face Button',
      },
      {
        name: 'Option Button',
        type: 'button',
        logicalButton: START,
        path: 'Option Button',
      },
      {
        name: 'Create Button',
        type: 'button',
        logicalButton: SELECT,
        path: 'Create Button',
        childComponents: [
          { name: 'Outline', type: 'group', path: 'Outline' },
          { name: 'Color', type: 'group', path: 'Color' },
          { name: 'Symbol', type: 'group', path: 'Symbol' },
        ],
      },
      {
        name: '十字按钮',
        type: 'button',
        path: 'Crosss',
        logicalButton: ACTIONDOWN,
        childComponents: [
          { name: 'Outline', type: 'group', path: 'Cross Outline' },
          { name: 'Color', type: 'group', path: 'Cross Color' },
        ],
      },
      {
        name: '圆形按钮',
        type: 'button',
        path: 'Circle',
        logicalButton: ACTIONRIGHT,
        childComponents: [
          { name: 'Outline', type: 'group', path: 'Circle Outline' },
          { name: 'Color', type: 'group', path: 'Circle Color' },
        ],
      },
      {
        name: '方形按钮',
        type: 'button',
        path: 'Square',
        logicalButton: ACTIONLEFT,
        childComponents: [
          { name: 'Outline', type: 'group', path: 'Square Outline' },
          { name: 'Color', type: 'group', path: 'Square Color' },
        ],
      },
      {
        name: '三角按钮',
        type: 'button',
        path: 'Triangle',
        logicalButton: ACTIONUP,
        childComponents: [
          { name: 'Outline', type: 'group', path: 'Triangle Outline' },
          { name: 'Color', type: 'group', path: 'Triangle Color' },
        ],
      },
    ],
  },
  {
    name: '静音按钮',
    type: 'button',
    path: 'Mute',
    childComponents: [
      { name: 'Outline', type: 'group', path: 'Outline' },
      {
        name: 'LED',
        type: 'group',
        path: 'LED',
        childComponents: [
          { name: 'Mute With LED', type: 'group', path: 'Mute With LED' },
          { name: 'Mute Without LED', type: 'group', path: 'Mute Without LED' },
          { name: 'Mute Icon', type: 'group', path: 'Mute Icon' },
        ],
      },
    ],
  },
  {
    name: 'Misc.',
    type: 'group',
    path: 'Misc.',
    childComponents: [
      { name: 'PS Button', type: 'button', logicalButton: GUIDE, path: 'PS Button' },
      { name: 'Speakers', type: 'group', path: 'Speakers' },
      { name: 'USB-C Plug', type: 'group', path: 'USB-C Plug' },
    ],
  },
  {
    name: '触摸板',
    type: 'button',
    logicalButton: PSTOUCHPAD,
    path: 'Touchpad',
    childComponents: [
      { name: 'Outline', type: 'group', path: 'Touchpad Outline' },
      { name: 'Color', type: 'group', path: 'Touchpad Color' },
    ],
  },
  {
    name: '分享按钮',
    type: 'button',
    logicalButton: SELECT,
    path: 'Create Button',
    childComponents: [
      { name: 'Outline', type: 'group', path: 'Outline' },
      { name: 'Color', type: 'group', path: 'Color' },
    ],
  },
  {
    name: '菜单按钮',
    type: 'button',
    logicalButton: START,
    path: 'Option Button',
    childComponents: [
      { name: 'Outline', type: 'group', path: 'Outline' },
      { name: 'Color', type: 'group', path: 'Color' },
    ],
  },
  {
    name: '肩部按钮',
    type: 'group',
    childComponents: [
      {
        name: '左肩按钮',
        type: 'button',
        logicalButton: L1,
        path: 'L1',
        childComponents: [
          { name: 'Outline', type: 'group', path: 'Outline' },
          { name: 'Color', type: 'group', path: 'Color' },
          { name: 'Text', type: 'group', path: 'Text' },
        ],
      },
      {
        name: '右肩按钮',
        type: 'button',
        logicalButton: R1,
        path: 'R1',
        childComponents: [
          { name: 'Outline', type: 'group', path: 'Outline' },
          { name: 'Color', type: 'group', path: 'Color' },
          { name: 'Text', type: 'group', path: 'Text' },
        ],
      },
    ],
  },
  {
    name: '扳机键',
    type: 'group',
    childComponents: [
      {
        name: '左扳机',
        type: 'trigger',
        logicalButton: L2,
        path: 'L2 Triggers',
        childComponents: [
          { name: 'Outline', type: 'group', path: 'Outline' },
          { name: 'Color', type: 'group', path: 'Color' },
          { name: 'Text', type: 'group', path: 'Text' },
        ],
      },
      {
        name: '右扳机',
        type: 'trigger',
        logicalButton: R2,
        path: 'R2 Trigger',
        childComponents: [
          { name: 'Outline', type: 'group', path: 'Outline' },
          { name: 'Color', type: 'group', path: 'Color' },
          { name: 'Text', type: 'group', path: 'Text' },
        ],
      },
    ],
  },
]

const nintendoControllerStructure: ControllerComponentStructure[] = [
  {
    name: '摇杆',
    type: 'group',
    childComponents: [
      {
        name: '左摇杆',
        type: 'stick',
        logicalButton: 'LEFT_STICK',
        childComponents: [
          { name: 'Outline', type: 'group', path: 'Left Stick Outline' },
          { name: 'Color', type: 'group', path: 'Left Stick Color' },
        ],
      },
      {
        name: '右摇杆',
        type: 'stick',
        logicalButton: 'RIGHT_STICK',
        childComponents: [
          { name: 'Outline', type: 'group', path: 'Right Stick Outline' },
          { name: 'Color', type: 'group', path: 'Right Stick Color' },
        ],
      },
    ],
  },
]

export const controllerStructures: Record<GamepadType, ControllerComponentStructure[]> = {
  xbox: xboxControllerStructure,
  ps: psControllerStructure,
  nintendo: nintendoControllerStructure,
}

export const gamepadConfigs: AllGamepadConfigs = {
  xbox: {
    name: 'Xbox Controller',
    bodySvg: markRaw(XboxBodyBlackComp),
    aspectRatio: '1000/625',
    defaultViewBox: parseAspectRatioToViewBox('1000/625') || '0 0 1543 956',
    components: [
      { type: 'stick', logicalButton: 'LEFT_STICK', svg: markRaw(StickSvgComp), position: { top: '48%', left: '23%', width: '16%' } },
      { type: 'stick', logicalButton: 'RIGHT_STICK', svg: markRaw(RightStickSvgComp), position: { top: '65%', left: '57%', width: '16%' } },
      { type: 'button', logicalButton: L3, name: 'L3', svg: markRaw(StickClickSvgComp), position: { top: '48%', left: '23%', width: '16%' } },
      { type: 'button', logicalButton: R3, name: 'R3', svg: markRaw(RightStickClickSvgComp), position: { top: '65%', left: '57%', width: '16%' } },
      { type: 'button', logicalButton: ACTIONDOWN, name: 'A', svg: markRaw(XboxASvgComp), position: { top: '62%', left: '71.5%', width: '8%' } },
      { type: 'button', logicalButton: ACTIONRIGHT, name: 'B', svg: markRaw(XboxBSvgComp), position: { top: '50%', left: '79%', width: '8%' } },
      { type: 'button', logicalButton: ACTIONLEFT, name: 'X', svg: markRaw(XboxXSvgComp), position: { top: '50%', left: '64%', width: '8%' } },
      { type: 'button', logicalButton: ACTIONUP, name: 'Y', svg: markRaw(XboxYSvgComp), position: { top: '38%', left: '71.5%', width: '8%' } },
      { type: 'button', logicalButton: DPADUP, name: 'D-Up', svg: markRaw(XboxDpadUpSvgComp), position: { top: '35%', left: '37%', width: '7%' } },
      { type: 'button', logicalButton: DPADDOWN, name: 'D-Down', svg: markRaw(XboxDpadDownSvgComp), position: { top: '47%', left: '37%', width: '7%' } },
      { type: 'button', logicalButton: DPADLEFT, name: 'D-Left', svg: markRaw(XboxDpadLeftSvgComp), position: { top: '41%', left: '31%', width: '7%' } },
      { type: 'button', logicalButton: DPADRIGHT, name: 'D-Right', svg: markRaw(XboxDpadRightSvgComp), position: { top: '41%', left: '43%', width: '7%' } },
      { type: 'button', logicalButton: L1, name: 'LB', svg: markRaw(XboxLBSvgComp), position: { top: '18%', left: '25%', width: '10%' } },
      { type: 'button', logicalButton: R1, name: 'RB', svg: markRaw(XboxRBSvgComp), position: { top: '18%', left: '65%', width: '10%' } },
      { type: 'button', logicalButton: L2, name: 'LT', svg: markRaw(XboxLTSvgComp), position: { top: '7%', left: '25%', width: '10%' } },
      { type: 'button', logicalButton: R2, name: 'RT', svg: markRaw(XboxRTSvgComp), position: { top: '7%', left: '65%', width: '10%' } },
      { type: 'button', logicalButton: SELECT, name: 'View', svg: markRaw(XboxViewSvgComp), position: { top: '35%', left: '52%', width: '6%' } },
      { type: 'button', logicalButton: START, name: 'Menu', svg: markRaw(XboxMenuSvgComp), position: { top: '35%', left: '62%', width: '6%' } },
      { type: 'button', logicalButton: GUIDE, name: 'Guide', svg: markRaw(XboxGuideSvgComp), position: { top: '20%', left: '50%', width: '8%' } },
    ],
  },
  ps: {
    name: 'PlayStation Controller',
    bodySvg: markRaw(PS4BodyBlackComp),
    aspectRatio: '1000/520',
    defaultViewBox: parseAspectRatioToViewBox('1000/520') || '0 0 1000 520',
    components: [
      { type: 'stick', logicalButton: 'LEFT_STICK', svg: markRaw(StickSvgComp), position: { top: '58%', left: '24%', width: '15%' } },
      { type: 'stick', logicalButton: 'RIGHT_STICK', svg: markRaw(RightStickSvgComp), position: { top: '58%', left: '61%', width: '15%' } },
      { type: 'button', logicalButton: L3, name: 'L3', svg: markRaw(StickClickSvgComp), position: { top: '58%', left: '24%', width: '15%' } },
      { type: 'button', logicalButton: R3, name: 'R3', svg: markRaw(RightStickClickSvgComp), position: { top: '58%', left: '61%', width: '15%' } },
      { type: 'button', logicalButton: ACTIONDOWN, name: 'Cross', svg: markRaw(PsCrossSvgComp), position: { top: '58%', left: '78%', width: '7%' } },
      { type: 'button', logicalButton: ACTIONRIGHT, name: 'Circle', svg: markRaw(PsCircleSvgComp), position: { top: '46%', left: '84%', width: '7%' } },
      { type: 'button', logicalButton: ACTIONLEFT, name: 'Square', svg: markRaw(PsSquareSvgComp), position: { top: '46%', left: '72%', width: '7%' } },
      { type: 'button', logicalButton: ACTIONUP, name: 'Triangle', svg: markRaw(PsTriangleSvgComp), position: { top: '34%', left: '78%', width: '7%' } },
      { type: 'button', logicalButton: PSTOUCHPAD, name: 'Touchpad', svg: markRaw(PsTouchpadSvgComp), position: { top: '20%', left: '35%', width: '30%', height: '25%' } },
      { type: 'button', logicalButton: L1, name: 'L1', svg: markRaw(PsL1SvgComp), position: { top: '25%', left: '20%', width: '10%' } },
      { type: 'button', logicalButton: R1, name: 'R1', svg: markRaw(PsR1SvgComp), position: { top: '25%', left: '70%', width: '10%' } },
      { type: 'button', logicalButton: L2, name: 'L2', svg: markRaw(PsL2SvgComp), position: { top: '12%', left: '20%', width: '10%' } },
      { type: 'button', logicalButton: R2, name: 'R2', svg: markRaw(PsR2SvgComp), position: { top: '12%', left: '70%', width: '10%' } },
      { type: 'button', logicalButton: SELECT, name: 'Create', svg: markRaw(PsCreateSvgComp), position: { top: '35%', left: '30%', width: '6%' } },
      { type: 'button', logicalButton: START, name: 'Options', svg: markRaw(PsOptionsSvgComp), position: { top: '35%', left: '70%', width: '6%' } },
      { type: 'button', logicalButton: GUIDE, name: 'PS Button', svg: markRaw(PsGuideSvgComp), position: { top: '40%', left: '50%', width: '8%' } },
    ],
  },
  nintendo: {
    name: 'Nintendo Switch Pro Controller',
    bodySvg: markRaw(SwitchProBodyComp),
    aspectRatio: '1000/650',
    defaultViewBox: parseAspectRatioToViewBox('1000/650') || '0 0 1200 780',
    components: [
      { type: 'stick', logicalButton: 'LEFT_STICK', svg: markRaw(StickSvgComp), position: { top: '40%', left: '23%', width: '16%' } },
      { type: 'stick', logicalButton: 'RIGHT_STICK', svg: markRaw(RightStickSvgComp), position: { top: '58%', left: '58%', width: '16%' } },
      { type: 'button', logicalButton: L3, name: 'L3', svg: markRaw(StickClickSvgComp), position: { top: '40%', left: '23%', width: '16%' } },
      { type: 'button', logicalButton: R3, name: 'R3', svg: markRaw(RightStickClickSvgComp), position: { top: '58%', left: '58%', width: '16%' } },
      { type: 'button', logicalButton: ACTIONDOWN, name: 'B', svg: markRaw(NintendoBSvgComp), position: { top: '57%', left: '78%', width: '7%' } },
      { type: 'button', logicalButton: ACTIONRIGHT, name: 'A', svg: markRaw(NintendoASvgComp), position: { top: '45%', left: '85%', width: '7%' } },
      { type: 'button', logicalButton: ACTIONLEFT, name: 'Y', svg: markRaw(NintendoYSvgComp), position: { top: '45%', left: '71%', width: '7%' } },
      { type: 'button', logicalButton: ACTIONUP, name: 'X', svg: markRaw(NintendoXSvgComp), position: { top: '34%', left: '78%', width: '7%' } },
      { type: 'button', logicalButton: NINTENDOCAPTURE, name: 'Capture', svg: markRaw(NintendoCaptureSvgComp), position: { top: '48%', left: '42%', width: '5%' } },
      { type: 'button', logicalButton: L1, name: 'L', svg: markRaw(NintendoLSvgComp), position: { top: '20%', left: '25%', width: '10%' } },
      { type: 'button', logicalButton: R1, name: 'R', svg: markRaw(NintendoRSvgComp), position: { top: '20%', left: '65%', width: '10%' } },
      { type: 'button', logicalButton: L2, name: 'ZL', svg: markRaw(NintendoZLSvgComp), position: { top: '10%', left: '25%', width: '10%' } },
      { type: 'button', logicalButton: R2, name: 'ZR', svg: markRaw(NintendoZRSvgComp), position: { top: '10%', left: '65%', width: '10%' } },
      { type: 'button', logicalButton: SELECT, name: '-', svg: markRaw(NintendoMinusSvgComp), position: { top: '35%', left: '35%', width: '5%' } },
      { type: 'button', logicalButton: START, name: '+', svg: markRaw(NintendoPlusSvgComp), position: { top: '35%', left: '65%', width: '5%' } },
    ],
  },
}
