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

// --- 任天堂按键 SVG ---
import NintendoLSvgComp from '@/assets/controller/Nintendo/nintendo-L.svg?component'
import NintendoMinusSvgComp from '@/assets/controller/Nintendo/nintendo-Minus.svg?component'
import NintendoPlusSvgComp from '@/assets/controller/Nintendo/nintendo-Plus.svg?component'
import NintendoASvgComp from '@/assets/controller/Nintendo/nintendo-positional prompt A.svg?component'
import NintendoBSvgComp from '@/assets/controller/Nintendo/nintendo-positional prompt B.svg?component'
import NintendoXSvgComp from '@/assets/controller/Nintendo/nintendo-positional prompt X.svg?component'
import NintendoYSvgComp from '@/assets/controller/Nintendo/nintendo-positional prompt Y.svg?component'
import NintendoRSvgComp from '@/assets/controller/Nintendo/nintendo-R.svg?component'
import NintendoZLSvgComp from '@/assets/controller/Nintendo/nintendo-ZL.svg?component'
import NintendoZRSvgComp from '@/assets/controller/Nintendo/nintendo-ZR.svg?component'
import NintendoCaptureSvgComp from '@/assets/controller/Nintendo/nintendoswitch-Capture.svg?component'
import NintendoGuideSvgComp from '@/assets/controller/Nintendo/nintendoswitch-Guide.svg?component'
import NintendoDpadDownSvgComp from '@/assets/controller/Nintendo/nintendoswitch-JoyCon D-PAD Down.svg?component'
import NintendoDpadLeftSvgComp from '@/assets/controller/Nintendo/nintendoswitch-JoyCon D-PAD Left.svg?component'
import NintendoDpadRightSvgComp from '@/assets/controller/Nintendo/nintendoswitch-JoyCon D-PAD Right.svg?component'
import NintendoDpadUpSvgComp from '@/assets/controller/Nintendo/nintendoswitch-JoyCon D-PAD Up.svg?component'

// --- PlayStation 按键 SVG ---
import PsCircleSvgComp from '@/assets/controller/PlayStation/ps-Circle.svg?component'
import PsCrossSvgComp from '@/assets/controller/PlayStation/ps-Cross.svg?component'
import PsSquareSvgComp from '@/assets/controller/PlayStation/ps-Square.svg?component'
import PsTriangleSvgComp from '@/assets/controller/PlayStation/ps-Triangle.svg?component'
import PsDpadDownSvgComp from '@/assets/controller/PlayStation/ps-D-PAD Down.svg?component'
import PsDpadLeftSvgComp from '@/assets/controller/PlayStation/ps-D-PAD Left.svg?component'
import PsDpadRightSvgComp from '@/assets/controller/PlayStation/ps-D-PAD Right.svg?component'
import PsDpadUpSvgComp from '@/assets/controller/PlayStation/ps-D-PAD Up.svg?component'
import PsGuideSvgComp from '@/assets/controller/PlayStation/ps-Guide.svg?component'
import PsCreateSvgComp from '@/assets/controller/PlayStation/ps5-Create.svg?component'
import PsOptionsSvgComp from '@/assets/controller/PlayStation/ps5-Option.svg?component'
import PsTouchpadSvgComp from '@/assets/controller/PlayStation/ps5-Touchpad.svg?component'

// --- Xbox / 通用按键与摇杆 SVG ---
import XboxASvgComp from '@/assets/controller/Shared/shared-A.svg?component'
import XboxBSvgComp from '@/assets/controller/Shared/shared-B.svg?component'
import XboxXSvgComp from '@/assets/controller/Shared/shared-X.svg?component'
import XboxYSvgComp from '@/assets/controller/Shared/shared-Y.svg?component'
import XboxDpadDownSvgComp from '@/assets/controller/Shared/shared-D-PA Down.svg?component'
import XboxDpadLeftSvgComp from '@/assets/controller/Shared/shared-D-PAD Left.svg?component'
import XboxDpadRightSvgComp from '@/assets/controller/Shared/shared-D-PAD Right.svg?component'
import XboxDpadUpSvgComp from '@/assets/controller/Shared/shared-D-PAD Up.svg?component'
import SharedL1SvgComp from '@/assets/controller/Shared/shared-L1.svg?component'
import SharedL2SvgComp from '@/assets/controller/Shared/shared-L2.svg?component'
import SharedR1SvgComp from '@/assets/controller/Shared/shared-R1.svg?component'
import SharedR2SvgComp from '@/assets/controller/Shared/shared-R2.svg?component'
import StickSvgComp from '@/assets/controller/Shared/shared-Left Joystick.svg?component'
import StickClickSvgComp from '@/assets/controller/Shared/shared-Left Stick Click.svg?component'
import RightStickSvgComp from '@/assets/controller/Shared/shared-Right Joystick.svg?component'
import RightStickClickSvgComp from '@/assets/controller/Shared/shared-Right Stick Click.svg?component'
import XboxGuideSvgComp from '@/assets/controller/Xbox/xbox-Guide.svg?component'
import XboxMenuSvgComp from '@/assets/controller/Xbox/xbox-Menu.svg?component'
import XboxViewSvgComp from '@/assets/controller/Xbox/xbox-View.svg?component'

import type { AllGamepadConfigs, GamepadType } from '@/types/gamepad'

export interface BodyOptionConfig {
  id: string
  name: string
  body: Component
  defaultViewBox: string
}

// --- 手柄底壳选项 ---

export const controllerBodies: Record<GamepadType, BodyOptionConfig[]> = {
  xbox: [
    { id: 'xb1-black', name: 'Xbox One 黑色', body: markRaw(XboxBodyBlackComp), defaultViewBox: '0 0 1543.24 956.31' },
    { id: 'xb1-white', name: 'Xbox One 白色', body: markRaw(XboxBodyWhiteComp), defaultViewBox: '0 0 1543.24 956.31' },
    { id: 'xb1s-blue', name: 'Xbox One S 蓝色', body: markRaw(XboxBodyBlueComp), defaultViewBox: '0 0 1543.24 956.31' },
    { id: 'xb1s-red', name: 'Xbox One S 红色', body: markRaw(XboxBodyRedComp), defaultViewBox: '0 0 1543.24 956.31' },
    { id: 'xsx-black', name: 'Xbox Series X 经典黑', body: markRaw(XboxSXBlackComp), defaultViewBox: '0 0 1543.24 956.31' },
    { id: 'xsx-white', name: 'Xbox Series X 冰雪白', body: markRaw(XboxSXWhiteComp), defaultViewBox: '0 0 1543.24 956.31' },
    { id: 'xsx-blue', name: 'Xbox Series X 极光蓝', body: markRaw(XboxSXBlueComp), defaultViewBox: '0 0 1543.24 956.31' },
    { id: 'xsx-red', name: 'Xbox Series X 脉冲红', body: markRaw(XboxSXRedComp), defaultViewBox: '0 0 1543.24 956.31' },
  ],
  ps: [
    { id: 'ps5-white', name: 'PS5 DualSense 经典白', body: markRaw(PS5BodyWhiteComp), defaultViewBox: '0 0 544.707 302.911' },
    { id: 'ps5-black', name: 'PS5 DualSense 午夜黑', body: markRaw(PS5BodyBlackComp), defaultViewBox: '0 0 544.707 302.911' },
    { id: 'ps5-red', name: 'PS5 DualSense 星云红', body: markRaw(PS5BodyRedComp), defaultViewBox: '0 0 544.707 302.911' },
    { id: 'ps5-purple', name: 'PS5 DualSense 星河紫', body: markRaw(PS5BodyPurpleComp), defaultViewBox: '0 0 544.707 302.911' },
    { id: 'ps5-pink', name: 'PS5 DualSense 新星粉', body: markRaw(PS5BodyPinkComp), defaultViewBox: '0 0 544.707 302.911' },
    { id: 'ps4-black', name: 'PS4 黑色', body: markRaw(PS4BodyBlackComp), defaultViewBox: '0 0 544.707 302.911' },
    { id: 'ps4-front', name: 'PS4 正面视图', body: markRaw(PS4BodyFrontComp), defaultViewBox: '0 0 544.707 302.911' },
    { id: 'ps4-v2-black', name: 'PS4 V2 黑色', body: markRaw(PS4V2BodyBlackComp), defaultViewBox: '0 0 544.707 302.911' },
    { id: 'ps4-v2-white', name: 'PS4 V2 冰川白', body: markRaw(PS4V2BodyWhiteComp), defaultViewBox: '0 0 544.707 302.911' },
    { id: 'ps4-v2-red', name: 'PS4 V2 熔岩红', body: markRaw(PS4V2BodyRedComp), defaultViewBox: '0 0 544.707 302.911' },
    { id: 'ps4-v2-blue', name: 'PS4 V2 午夜蓝', body: markRaw(PS4V2BodyBlueComp), defaultViewBox: '0 0 544.707 302.911' },
    { id: 'ps4-v2-gold', name: 'PS4 V2 金色', body: markRaw(PS4V2BodyGoldComp), defaultViewBox: '0 0 544.707 302.911' },
  ],
  nintendo: [
    { id: 'switch-pro', name: 'Switch Pro 经典黑', body: markRaw(SwitchProBodyComp), defaultViewBox: '0 0 1200 780' },
  ],
}

// --- 手柄按键与摇杆统一等比锚定布局配置 ---

export const gamepadConfigs: AllGamepadConfigs = {
  xbox: {
    name: 'Xbox Wireless Controller',
    bodySvg: markRaw(XboxBodyBlackComp),
    aspectRatio: '1543.24 / 956.31',
    defaultViewBox: '0 0 1543.24 956.31',
    components: [
      {
        type: 'stick',
        logicalButton: 'LEFT_STICK',
        pressLogicalButton: 'LEFT_STICK_PRESS',
        svg: markRaw(StickSvgComp),
        pressSvg: markRaw(StickClickSvgComp),
        position: { top: '39%', left: '26%', width: '13%' },
      },
      {
        type: 'stick',
        logicalButton: 'RIGHT_STICK',
        pressLogicalButton: 'RIGHT_STICK_PRESS',
        svg: markRaw(RightStickSvgComp),
        pressSvg: markRaw(RightStickClickSvgComp),
        position: { top: '54%', left: '59%', width: '13%' },
      },
      {
        type: 'button',
        logicalButton: 'ACTION_DOWN',
        name: 'A',
        svg: markRaw(XboxASvgComp),
        position: { top: '48%', left: '71.5%', width: '7%' },
      },
      {
        type: 'button',
        logicalButton: 'ACTION_RIGHT',
        name: 'B',
        svg: markRaw(XboxBSvgComp),
        position: { top: '39%', left: '78.5%', width: '7%' },
      },
      {
        type: 'button',
        logicalButton: 'ACTION_LEFT',
        name: 'X',
        svg: markRaw(XboxXSvgComp),
        position: { top: '39%', left: '64.5%', width: '7%' },
      },
      {
        type: 'button',
        logicalButton: 'ACTION_UP',
        name: 'Y',
        svg: markRaw(XboxYSvgComp),
        position: { top: '30%', left: '71.5%', width: '7%' },
      },
      {
        type: 'button',
        logicalButton: 'DPAD_UP',
        name: 'D-Up',
        svg: markRaw(XboxDpadUpSvgComp),
        position: { top: '50%', left: '39.5%', width: '6.5%' },
      },
      {
        type: 'button',
        logicalButton: 'DPAD_DOWN',
        name: 'D-Down',
        svg: markRaw(XboxDpadDownSvgComp),
        position: { top: '64%', left: '39.5%', width: '6.5%' },
      },
      {
        type: 'button',
        logicalButton: 'DPAD_LEFT',
        name: 'D-Left',
        svg: markRaw(XboxDpadLeftSvgComp),
        position: { top: '57%', left: '34%', width: '6.5%' },
      },
      {
        type: 'button',
        logicalButton: 'DPAD_RIGHT',
        name: 'D-Right',
        svg: markRaw(XboxDpadRightSvgComp),
        position: { top: '57%', left: '45%', width: '6.5%' },
      },
      {
        type: 'button',
        logicalButton: 'LEFT_SHOULDER_1',
        name: 'LB',
        svg: markRaw(SharedL1SvgComp),
        position: { top: '15%', left: '26%', width: '11%' },
      },
      {
        type: 'button',
        logicalButton: 'RIGHT_SHOULDER_1',
        name: 'RB',
        svg: markRaw(SharedR1SvgComp),
        position: { top: '15%', left: '63%', width: '11%' },
      },
      {
        type: 'button',
        logicalButton: 'LEFT_SHOULDER_2',
        name: 'LT',
        isTrigger: true,
        svg: markRaw(SharedL2SvgComp),
        position: { top: '4%', left: '26%', width: '11%' },
      },
      {
        type: 'button',
        logicalButton: 'RIGHT_SHOULDER_2',
        name: 'RT',
        isTrigger: true,
        svg: markRaw(SharedR2SvgComp),
        position: { top: '4%', left: '63%', width: '11%' },
      },
      {
        type: 'button',
        logicalButton: 'SELECT',
        name: 'View',
        svg: markRaw(XboxViewSvgComp),
        position: { top: '38%', left: '44%', width: '4.5%' },
      },
      {
        type: 'button',
        logicalButton: 'START',
        name: 'Menu',
        svg: markRaw(XboxMenuSvgComp),
        position: { top: '38%', left: '51.5%', width: '4.5%' },
      },
      {
        type: 'button',
        logicalButton: 'HOME',
        name: 'Guide',
        svg: markRaw(XboxGuideSvgComp),
        position: { top: '24%', left: '47%', width: '6%' },
      },
    ],
  },
  ps: {
    name: 'PlayStation Controller',
    bodySvg: markRaw(PS5BodyWhiteComp),
    aspectRatio: '544.707 / 302.911',
    defaultViewBox: '0 0 544.707 302.911',
    components: [
      {
        type: 'stick',
        logicalButton: 'LEFT_STICK',
        pressLogicalButton: 'LEFT_STICK_PRESS',
        svg: markRaw(StickSvgComp),
        pressSvg: markRaw(StickClickSvgComp),
        position: { top: '56%', left: '34%', width: '13%' },
      },
      {
        type: 'stick',
        logicalButton: 'RIGHT_STICK',
        pressLogicalButton: 'RIGHT_STICK_PRESS',
        svg: markRaw(RightStickSvgComp),
        pressSvg: markRaw(RightStickClickSvgComp),
        position: { top: '56%', left: '53%', width: '13%' },
      },
      {
        type: 'button',
        logicalButton: 'ACTION_DOWN',
        name: 'Cross',
        svg: markRaw(PsCrossSvgComp),
        position: { top: '52%', left: '76%', width: '7%' },
      },
      {
        type: 'button',
        logicalButton: 'ACTION_RIGHT',
        name: 'Circle',
        svg: markRaw(PsCircleSvgComp),
        position: { top: '41%', left: '83%', width: '7%' },
      },
      {
        type: 'button',
        logicalButton: 'ACTION_LEFT',
        name: 'Square',
        svg: markRaw(PsSquareSvgComp),
        position: { top: '41%', left: '69%', width: '7%' },
      },
      {
        type: 'button',
        logicalButton: 'ACTION_UP',
        name: 'Triangle',
        svg: markRaw(PsTriangleSvgComp),
        position: { top: '30%', left: '76%', width: '7%' },
      },
      {
        type: 'button',
        logicalButton: 'DPAD_UP',
        name: 'D-Up',
        svg: markRaw(PsDpadUpSvgComp),
        position: { top: '30%', left: '17%', width: '7%' },
      },
      {
        type: 'button',
        logicalButton: 'DPAD_DOWN',
        name: 'D-Down',
        svg: markRaw(PsDpadDownSvgComp),
        position: { top: '52%', left: '17%', width: '7%' },
      },
      {
        type: 'button',
        logicalButton: 'DPAD_LEFT',
        name: 'D-Left',
        svg: markRaw(PsDpadLeftSvgComp),
        position: { top: '41%', left: '10.5%', width: '7%' },
      },
      {
        type: 'button',
        logicalButton: 'DPAD_RIGHT',
        name: 'D-Right',
        svg: markRaw(PsDpadRightSvgComp),
        position: { top: '41%', left: '23.5%', width: '7%' },
      },
      {
        type: 'button',
        logicalButton: 'PS_TOUCHPAD',
        name: 'Touchpad',
        svg: markRaw(PsTouchpadSvgComp),
        position: { top: '23%', left: '37%', width: '26%', height: '22%' },
      },
      {
        type: 'button',
        logicalButton: 'LEFT_SHOULDER_1',
        name: 'L1',
        svg: markRaw(SharedL1SvgComp),
        position: { top: '16%', left: '17%', width: '10%' },
      },
      {
        type: 'button',
        logicalButton: 'RIGHT_SHOULDER_1',
        name: 'R1',
        svg: markRaw(SharedR1SvgComp),
        position: { top: '16%', left: '73%', width: '10%' },
      },
      {
        type: 'button',
        logicalButton: 'LEFT_SHOULDER_2',
        name: 'L2',
        isTrigger: true,
        svg: markRaw(SharedL2SvgComp),
        position: { top: '4%', left: '17%', width: '10%' },
      },
      {
        type: 'button',
        logicalButton: 'RIGHT_SHOULDER_2',
        name: 'R2',
        isTrigger: true,
        svg: markRaw(SharedR2SvgComp),
        position: { top: '4%', left: '73%', width: '10%' },
      },
      {
        type: 'button',
        logicalButton: 'SELECT',
        name: 'Create',
        svg: markRaw(PsCreateSvgComp),
        position: { top: '29%', left: '31%', width: '4%' },
      },
      {
        type: 'button',
        logicalButton: 'START',
        name: 'Options',
        svg: markRaw(PsOptionsSvgComp),
        position: { top: '29%', left: '65%', width: '4%' },
      },
      {
        type: 'button',
        logicalButton: 'HOME',
        name: 'PS Button',
        svg: markRaw(PsGuideSvgComp),
        position: { top: '56%', left: '47.5%', width: '5%' },
      },
    ],
  },
  nintendo: {
    name: 'Nintendo Switch Pro Controller',
    bodySvg: markRaw(SwitchProBodyComp),
    aspectRatio: '1200 / 780',
    defaultViewBox: '0 0 1200 780',
    components: [
      {
        type: 'stick',
        logicalButton: 'LEFT_STICK',
        pressLogicalButton: 'LEFT_STICK_PRESS',
        svg: markRaw(StickSvgComp),
        pressSvg: markRaw(StickClickSvgComp),
        position: { top: '35%', left: '24%', width: '14%' },
      },
      {
        type: 'stick',
        logicalButton: 'RIGHT_STICK',
        pressLogicalButton: 'RIGHT_STICK_PRESS',
        svg: markRaw(RightStickSvgComp),
        pressSvg: markRaw(RightStickClickSvgComp),
        position: { top: '52%', left: '57%', width: '14%' },
      },
      {
        type: 'button',
        logicalButton: 'ACTION_DOWN',
        name: 'B',
        svg: markRaw(NintendoBSvgComp),
        position: { top: '49%', left: '75%', width: '6.5%' },
      },
      {
        type: 'button',
        logicalButton: 'ACTION_RIGHT',
        name: 'A',
        svg: markRaw(NintendoASvgComp),
        position: { top: '40%', left: '81.5%', width: '6.5%' },
      },
      {
        type: 'button',
        logicalButton: 'ACTION_LEFT',
        name: 'Y',
        svg: markRaw(NintendoYSvgComp),
        position: { top: '40%', left: '68.5%', width: '6.5%' },
      },
      {
        type: 'button',
        logicalButton: 'ACTION_UP',
        name: 'X',
        svg: markRaw(NintendoXSvgComp),
        position: { top: '31%', left: '75%', width: '6.5%' },
      },
      {
        type: 'button',
        logicalButton: 'DPAD_UP',
        name: 'D-Up',
        svg: markRaw(NintendoDpadUpSvgComp),
        position: { top: '47%', left: '39%', width: '6%' },
      },
      {
        type: 'button',
        logicalButton: 'DPAD_DOWN',
        name: 'D-Down',
        svg: markRaw(NintendoDpadDownSvgComp),
        position: { top: '61%', left: '39%', width: '6%' },
      },
      {
        type: 'button',
        logicalButton: 'DPAD_LEFT',
        name: 'D-Left',
        svg: markRaw(NintendoDpadLeftSvgComp),
        position: { top: '54%', left: '33.5%', width: '6%' },
      },
      {
        type: 'button',
        logicalButton: 'DPAD_RIGHT',
        name: 'D-Right',
        svg: markRaw(NintendoDpadRightSvgComp),
        position: { top: '54%', left: '44.5%', width: '6%' },
      },
      {
        type: 'button',
        logicalButton: 'NINTENDO_CAPTURE',
        name: 'Capture',
        svg: markRaw(NintendoCaptureSvgComp),
        position: { top: '44%', left: '43%', width: '4%' },
      },
      {
        type: 'button',
        logicalButton: 'HOME',
        name: 'Home',
        svg: markRaw(NintendoGuideSvgComp),
        position: { top: '44%', left: '53%', width: '4%' },
      },
      {
        type: 'button',
        logicalButton: 'LEFT_SHOULDER_1',
        name: 'L',
        svg: markRaw(NintendoLSvgComp),
        position: { top: '15%', left: '26%', width: '10%' },
      },
      {
        type: 'button',
        logicalButton: 'RIGHT_SHOULDER_1',
        name: 'R',
        svg: markRaw(NintendoRSvgComp),
        position: { top: '15%', left: '64%', width: '10%' },
      },
      {
        type: 'button',
        logicalButton: 'LEFT_SHOULDER_2',
        name: 'ZL',
        isTrigger: true,
        svg: markRaw(NintendoZLSvgComp),
        position: { top: '5%', left: '26%', width: '10%' },
      },
      {
        type: 'button',
        logicalButton: 'RIGHT_SHOULDER_2',
        name: 'ZR',
        isTrigger: true,
        svg: markRaw(NintendoZRSvgComp),
        position: { top: '5%', left: '64%', width: '10%' },
      },
      {
        type: 'button',
        logicalButton: 'SELECT',
        name: '-',
        svg: markRaw(NintendoMinusSvgComp),
        position: { top: '35%', left: '41%', width: '4%' },
      },
      {
        type: 'button',
        logicalButton: 'START',
        name: '+',
        svg: markRaw(NintendoPlusSvgComp),
        position: { top: '35%', left: '55%', width: '4%' },
      },
    ],
  },
}
