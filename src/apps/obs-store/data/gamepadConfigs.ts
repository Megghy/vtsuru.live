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

export interface ControllerComponentStructure {
  name: string
  path?: string
  type: 'button' | 'stick' | 'dpad' | 'trigger' | 'group'
  logicalButton?: LogicalButton | string
  childComponents?: ControllerComponentStructure[]
}

// --- Body Options ---

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

// --- Controller Structures (SVG 直接操作模式的按键映射) ---

const xboxStructure: ControllerComponentStructure[] = [
  {
    name: '摇杆', type: 'group',
    childComponents: [
      { name: '左摇杆', type: 'stick', logicalButton: 'LEFT_STICK', path: 'Left Stick' },
      { name: '右摇杆', type: 'stick', logicalButton: 'RIGHT_STICK', path: 'Right Stick' },
    ],
  },
  {
    name: '面部按钮', type: 'group',
    childComponents: [
      { name: 'A按钮', type: 'button', logicalButton: 'ACTION_DOWN', path: 'A Button' },
      { name: 'B按钮', type: 'button', logicalButton: 'ACTION_RIGHT', path: 'B Button' },
      { name: 'X按钮', type: 'button', logicalButton: 'ACTION_LEFT', path: 'X Button' },
      { name: 'Y按钮', type: 'button', logicalButton: 'ACTION_UP', path: 'Y Button' },
    ],
  },
  {
    name: '方向键', type: 'group',
    childComponents: [
      { name: '上', type: 'button', logicalButton: 'DPAD_UP', path: 'D-PAD Up' },
      { name: '下', type: 'button', logicalButton: 'DPAD_DOWN', path: 'D-PAD Down' },
      { name: '左', type: 'button', logicalButton: 'DPAD_LEFT', path: 'D-PAD Left' },
      { name: '右', type: 'button', logicalButton: 'DPAD_RIGHT', path: 'D-PAD Right' },
    ],
  },
  {
    name: '中央按钮', type: 'group',
    childComponents: [
      { name: 'Xbox按钮', type: 'button', logicalButton: 'HOME', path: 'Xbox Guide Button' },
      { name: 'View按钮', type: 'button', logicalButton: 'SELECT', path: 'View Button' },
      { name: 'Menu按钮', type: 'button', logicalButton: 'START', path: 'Menu Button' },
    ],
  },
  {
    name: '肩部按钮', type: 'group',
    childComponents: [
      { name: '左肩按钮', type: 'button', logicalButton: 'LEFT_SHOULDER_1', path: 'Left Bumper' },
      { name: '右肩按钮', type: 'button', logicalButton: 'RIGHT_SHOULDER_1', path: 'Right Bumper' },
    ],
  },
  {
    name: '扳机键', type: 'group',
    childComponents: [
      { name: '左扳机', type: 'trigger', logicalButton: 'LEFT_SHOULDER_2', path: 'Left Trigger' },
      { name: '右扳机', type: 'trigger', logicalButton: 'RIGHT_SHOULDER_2', path: 'Right Trigger' },
    ],
  },
]

const psStructure: ControllerComponentStructure[] = [
  {
    name: '摇杆', type: 'group',
    childComponents: [
      { name: '左摇杆', type: 'stick', logicalButton: 'LEFT_STICK', path: 'Left Stick' },
      { name: '右摇杆', type: 'stick', logicalButton: 'RIGHT_STICK', path: 'Right Stick' },
    ],
  },
  {
    name: '面部按钮', type: 'group',
    childComponents: [
      { name: '十字按钮', type: 'button', logicalButton: 'ACTION_DOWN', path: 'Crosss' },
      { name: '圆形按钮', type: 'button', logicalButton: 'ACTION_RIGHT', path: 'Circle' },
      { name: '方形按钮', type: 'button', logicalButton: 'ACTION_LEFT', path: 'Square' },
      { name: '三角按钮', type: 'button', logicalButton: 'ACTION_UP', path: 'Triangle' },
    ],
  },
  {
    name: '方向键', type: 'group',
    childComponents: [
      { name: '上', type: 'button', logicalButton: 'DPAD_UP', path: 'D-PAD Up' },
      { name: '下', type: 'button', logicalButton: 'DPAD_DOWN', path: 'D-PAD Down' },
      { name: '左', type: 'button', logicalButton: 'DPAD_LEFT', path: 'D-PAD Left' },
      { name: '右', type: 'button', logicalButton: 'DPAD_RIGHT', path: 'D-PAD Right' },
    ],
  },
  {
    name: '中央按钮', type: 'group',
    childComponents: [
      { name: 'PS按钮', type: 'button', logicalButton: 'HOME', path: 'PS Button' },
      { name: 'Create', type: 'button', logicalButton: 'SELECT', path: 'Create Button' },
      { name: 'Options', type: 'button', logicalButton: 'START', path: 'Option Button' },
      { name: '触摸板', type: 'button', logicalButton: 'PS_TOUCHPAD', path: 'Touchpad' },
    ],
  },
  {
    name: '肩部按钮', type: 'group',
    childComponents: [
      { name: 'L1', type: 'button', logicalButton: 'LEFT_SHOULDER_1', path: 'L1' },
      { name: 'R1', type: 'button', logicalButton: 'RIGHT_SHOULDER_1', path: 'R1' },
    ],
  },
  {
    name: '扳机键', type: 'group',
    childComponents: [
      { name: 'L2', type: 'trigger', logicalButton: 'LEFT_SHOULDER_2', path: 'L2 Triggers' },
      { name: 'R2', type: 'trigger', logicalButton: 'RIGHT_SHOULDER_2', path: 'R2 Trigger' },
    ],
  },
]

const nintendoStructure: ControllerComponentStructure[] = [
  {
    name: '摇杆', type: 'group',
    childComponents: [
      { name: '左摇杆', type: 'stick', logicalButton: 'LEFT_STICK', path: 'Left Stick' },
      { name: '右摇杆', type: 'stick', logicalButton: 'RIGHT_STICK', path: 'Right Stick' },
    ],
  },
  {
    name: '面部按钮', type: 'group',
    childComponents: [
      { name: 'B按钮', type: 'button', logicalButton: 'ACTION_DOWN', path: 'B Button' },
      { name: 'A按钮', type: 'button', logicalButton: 'ACTION_RIGHT', path: 'A Button' },
      { name: 'Y按钮', type: 'button', logicalButton: 'ACTION_LEFT', path: 'Y Button' },
      { name: 'X按钮', type: 'button', logicalButton: 'ACTION_UP', path: 'X Button' },
    ],
  },
  {
    name: '方向键', type: 'group',
    childComponents: [
      { name: '上', type: 'button', logicalButton: 'DPAD_UP', path: 'D-PAD Up' },
      { name: '下', type: 'button', logicalButton: 'DPAD_DOWN', path: 'D-PAD Down' },
      { name: '左', type: 'button', logicalButton: 'DPAD_LEFT', path: 'D-PAD Left' },
      { name: '右', type: 'button', logicalButton: 'DPAD_RIGHT', path: 'D-PAD Right' },
    ],
  },
  {
    name: '中央按钮', type: 'group',
    childComponents: [
      { name: 'Home', type: 'button', logicalButton: 'HOME', path: 'Home Button' },
      { name: '-', type: 'button', logicalButton: 'SELECT', path: 'Minus Button' },
      { name: '+', type: 'button', logicalButton: 'START', path: 'Plus Button' },
      { name: 'Capture', type: 'button', logicalButton: 'NINTENDO_CAPTURE', path: 'Capture Button' },
    ],
  },
  {
    name: '肩部按钮', type: 'group',
    childComponents: [
      { name: 'L', type: 'button', logicalButton: 'LEFT_SHOULDER_1', path: 'L Button' },
      { name: 'R', type: 'button', logicalButton: 'RIGHT_SHOULDER_1', path: 'R Button' },
    ],
  },
  {
    name: '扳机键', type: 'group',
    childComponents: [
      { name: 'ZL', type: 'trigger', logicalButton: 'LEFT_SHOULDER_2', path: 'ZL Trigger' },
      { name: 'ZR', type: 'trigger', logicalButton: 'RIGHT_SHOULDER_2', path: 'ZR Trigger' },
    ],
  },
]

export const controllerStructures: Record<GamepadType, ControllerComponentStructure[]> = {
  xbox: xboxStructure,
  ps: psStructure,
  nintendo: nintendoStructure,
}

// --- Overlay 模式的组件配置 ---

export const gamepadConfigs: AllGamepadConfigs = {
  xbox: {
    name: 'Xbox Controller',
    bodySvg: markRaw(XboxBodyBlackComp),
    aspectRatio: '1543/956',
    defaultViewBox: '0 0 1543 956',
    components: [
      { type: 'stick', logicalButton: 'LEFT_STICK', svg: markRaw(StickSvgComp), position: { top: '48%', left: '23%', width: '16%' } },
      { type: 'stick', logicalButton: 'RIGHT_STICK', svg: markRaw(RightStickSvgComp), position: { top: '65%', left: '57%', width: '16%' } },
      { type: 'button', logicalButton: 'LEFT_STICK_PRESS', name: 'L3', svg: markRaw(StickClickSvgComp), position: { top: '48%', left: '23%', width: '16%' } },
      { type: 'button', logicalButton: 'RIGHT_STICK_PRESS', name: 'R3', svg: markRaw(RightStickClickSvgComp), position: { top: '65%', left: '57%', width: '16%' } },
      { type: 'button', logicalButton: 'ACTION_DOWN', name: 'A', svg: markRaw(XboxASvgComp), position: { top: '62%', left: '71.5%', width: '8%' } },
      { type: 'button', logicalButton: 'ACTION_RIGHT', name: 'B', svg: markRaw(XboxBSvgComp), position: { top: '50%', left: '79%', width: '8%' } },
      { type: 'button', logicalButton: 'ACTION_LEFT', name: 'X', svg: markRaw(XboxXSvgComp), position: { top: '50%', left: '64%', width: '8%' } },
      { type: 'button', logicalButton: 'ACTION_UP', name: 'Y', svg: markRaw(XboxYSvgComp), position: { top: '38%', left: '71.5%', width: '8%' } },
      { type: 'button', logicalButton: 'DPAD_UP', name: 'D-Up', svg: markRaw(XboxDpadUpSvgComp), position: { top: '35%', left: '37%', width: '7%' } },
      { type: 'button', logicalButton: 'DPAD_DOWN', name: 'D-Down', svg: markRaw(XboxDpadDownSvgComp), position: { top: '47%', left: '37%', width: '7%' } },
      { type: 'button', logicalButton: 'DPAD_LEFT', name: 'D-Left', svg: markRaw(XboxDpadLeftSvgComp), position: { top: '41%', left: '31%', width: '7%' } },
      { type: 'button', logicalButton: 'DPAD_RIGHT', name: 'D-Right', svg: markRaw(XboxDpadRightSvgComp), position: { top: '41%', left: '43%', width: '7%' } },
      { type: 'button', logicalButton: 'LEFT_SHOULDER_1', name: 'LB', svg: markRaw(XboxLBSvgComp), position: { top: '18%', left: '25%', width: '10%' } },
      { type: 'button', logicalButton: 'RIGHT_SHOULDER_1', name: 'RB', svg: markRaw(XboxRBSvgComp), position: { top: '18%', left: '65%', width: '10%' } },
      { type: 'button', logicalButton: 'LEFT_SHOULDER_2', name: 'LT', svg: markRaw(XboxLTSvgComp), position: { top: '7%', left: '25%', width: '10%' } },
      { type: 'button', logicalButton: 'RIGHT_SHOULDER_2', name: 'RT', svg: markRaw(XboxRTSvgComp), position: { top: '7%', left: '65%', width: '10%' } },
      { type: 'button', logicalButton: 'SELECT', name: 'View', svg: markRaw(XboxViewSvgComp), position: { top: '35%', left: '52%', width: '6%' } },
      { type: 'button', logicalButton: 'START', name: 'Menu', svg: markRaw(XboxMenuSvgComp), position: { top: '35%', left: '62%', width: '6%' } },
      { type: 'button', logicalButton: 'HOME', name: 'Guide', svg: markRaw(XboxGuideSvgComp), position: { top: '20%', left: '50%', width: '8%' } },
    ],
  },
  ps: {
    name: 'PlayStation Controller',
    bodySvg: markRaw(PS5BodyBlackComp),
    aspectRatio: '544.707/302.911',
    defaultViewBox: '0 0 544.707 302.911',
    components: [
      { type: 'stick', logicalButton: 'LEFT_STICK', svg: markRaw(StickSvgComp), position: { top: '58%', left: '24%', width: '15%' } },
      { type: 'stick', logicalButton: 'RIGHT_STICK', svg: markRaw(RightStickSvgComp), position: { top: '58%', left: '61%', width: '15%' } },
      { type: 'button', logicalButton: 'LEFT_STICK_PRESS', name: 'L3', svg: markRaw(StickClickSvgComp), position: { top: '58%', left: '24%', width: '15%' } },
      { type: 'button', logicalButton: 'RIGHT_STICK_PRESS', name: 'R3', svg: markRaw(RightStickClickSvgComp), position: { top: '58%', left: '61%', width: '15%' } },
      { type: 'button', logicalButton: 'ACTION_DOWN', name: 'Cross', svg: markRaw(PsCrossSvgComp), position: { top: '58%', left: '78%', width: '7%' } },
      { type: 'button', logicalButton: 'ACTION_RIGHT', name: 'Circle', svg: markRaw(PsCircleSvgComp), position: { top: '46%', left: '84%', width: '7%' } },
      { type: 'button', logicalButton: 'ACTION_LEFT', name: 'Square', svg: markRaw(PsSquareSvgComp), position: { top: '46%', left: '72%', width: '7%' } },
      { type: 'button', logicalButton: 'ACTION_UP', name: 'Triangle', svg: markRaw(PsTriangleSvgComp), position: { top: '34%', left: '78%', width: '7%' } },
      { type: 'button', logicalButton: 'PS_TOUCHPAD', name: 'Touchpad', svg: markRaw(PsTouchpadSvgComp), position: { top: '20%', left: '35%', width: '30%', height: '25%' } },
      { type: 'button', logicalButton: 'LEFT_SHOULDER_1', name: 'L1', svg: markRaw(PsL1SvgComp), position: { top: '25%', left: '20%', width: '10%' } },
      { type: 'button', logicalButton: 'RIGHT_SHOULDER_1', name: 'R1', svg: markRaw(PsR1SvgComp), position: { top: '25%', left: '70%', width: '10%' } },
      { type: 'button', logicalButton: 'LEFT_SHOULDER_2', name: 'L2', svg: markRaw(XboxLTSvgComp), position: { top: '12%', left: '20%', width: '10%' } },
      { type: 'button', logicalButton: 'RIGHT_SHOULDER_2', name: 'R2', svg: markRaw(XboxRTSvgComp), position: { top: '12%', left: '70%', width: '10%' } },
      { type: 'button', logicalButton: 'SELECT', name: 'Create', svg: markRaw(PsCreateSvgComp), position: { top: '35%', left: '30%', width: '6%' } },
      { type: 'button', logicalButton: 'START', name: 'Options', svg: markRaw(PsOptionsSvgComp), position: { top: '35%', left: '70%', width: '6%' } },
      { type: 'button', logicalButton: 'HOME', name: 'PS Button', svg: markRaw(PsGuideSvgComp), position: { top: '40%', left: '50%', width: '8%' } },
    ],
  },
  nintendo: {
    name: 'Nintendo Switch Pro Controller',
    bodySvg: markRaw(SwitchProBodyComp),
    aspectRatio: '1200/780',
    defaultViewBox: '0 0 1200 780',
    components: [
      { type: 'stick', logicalButton: 'LEFT_STICK', svg: markRaw(StickSvgComp), position: { top: '40%', left: '23%', width: '16%' } },
      { type: 'stick', logicalButton: 'RIGHT_STICK', svg: markRaw(RightStickSvgComp), position: { top: '58%', left: '58%', width: '16%' } },
      { type: 'button', logicalButton: 'LEFT_STICK_PRESS', name: 'L3', svg: markRaw(StickClickSvgComp), position: { top: '40%', left: '23%', width: '16%' } },
      { type: 'button', logicalButton: 'RIGHT_STICK_PRESS', name: 'R3', svg: markRaw(RightStickClickSvgComp), position: { top: '58%', left: '58%', width: '16%' } },
      { type: 'button', logicalButton: 'ACTION_DOWN', name: 'B', svg: markRaw(NintendoBSvgComp), position: { top: '57%', left: '78%', width: '7%' } },
      { type: 'button', logicalButton: 'ACTION_RIGHT', name: 'A', svg: markRaw(NintendoASvgComp), position: { top: '45%', left: '85%', width: '7%' } },
      { type: 'button', logicalButton: 'ACTION_LEFT', name: 'Y', svg: markRaw(NintendoYSvgComp), position: { top: '45%', left: '71%', width: '7%' } },
      { type: 'button', logicalButton: 'ACTION_UP', name: 'X', svg: markRaw(NintendoXSvgComp), position: { top: '34%', left: '78%', width: '7%' } },
      { type: 'button', logicalButton: 'NINTENDO_CAPTURE', name: 'Capture', svg: markRaw(NintendoCaptureSvgComp), position: { top: '48%', left: '42%', width: '5%' } },
      { type: 'button', logicalButton: 'LEFT_SHOULDER_1', name: 'L', svg: markRaw(NintendoLSvgComp), position: { top: '20%', left: '25%', width: '10%' } },
      { type: 'button', logicalButton: 'RIGHT_SHOULDER_1', name: 'R', svg: markRaw(NintendoRSvgComp), position: { top: '20%', left: '65%', width: '10%' } },
      { type: 'button', logicalButton: 'LEFT_SHOULDER_2', name: 'ZL', svg: markRaw(NintendoZLSvgComp), position: { top: '10%', left: '25%', width: '10%' } },
      { type: 'button', logicalButton: 'RIGHT_SHOULDER_2', name: 'ZR', svg: markRaw(NintendoZRSvgComp), position: { top: '10%', left: '65%', width: '10%' } },
      { type: 'button', logicalButton: 'SELECT', name: '-', svg: markRaw(NintendoMinusSvgComp), position: { top: '35%', left: '35%', width: '5%' } },
      { type: 'button', logicalButton: 'START', name: '+', svg: markRaw(NintendoPlusSvgComp), position: { top: '35%', left: '65%', width: '5%' } },
    ],
  },
}

