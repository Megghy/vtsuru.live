import * as THREE from 'three'

import type { TypingCatAccessories, TypingCatShapeParams } from './types'

export interface TypingCatAccessoryRig {
  setAccessories(acc: Partial<TypingCatAccessories>): void
  setAccentColor(hex: string): void
  updateShape(params: TypingCatShapeParams, headR: readonly [number, number, number]): void
  updateCollarPose(headY: number, headZ: number, bodyW: number, neckW: number, loaf: number): void
}

const flat = (color: THREE.ColorRepresentation) => new THREE.MeshBasicMaterial({ color })
const back = (color: THREE.ColorRepresentation) => new THREE.MeshBasicMaterial({ color, side: THREE.BackSide })

export function createTypingCatAccessories(head: THREE.Group, upper: THREE.Group): TypingCatAccessoryRig {
  const accentMat = flat('#38bdf8')
  const darkMat = flat('#23252c')
  const padMat = flat('#3d424e')
  const rimDarkMat = back('#141519')
  const metalMat = flat('#2b2d34')
  const goldMat = flat('#f4c44e')
  const goldRimMat = back('#8a5a12')
  const gemMat = flat('#f43f5e')
  const ribbonMat = flat('#e5536b')
  const ribbonDarkMat = back('#7c2435')

  // 1. 头戴式耳机（挂在 head 上，随点头/歪头/摸头自然联动）
  const headphones = new THREE.Group()
  headphones.visible = false
  head.add(headphones)

  // 耳机头梁：优雅跨过双耳之间的头顶弧线
  const bandGeo = new THREE.TorusGeometry(0.9, 0.068, 12, 32, Math.PI * 0.94)
  const band = new THREE.Mesh(bandGeo, darkMat)
  band.rotation.z = Math.PI * 0.03
  band.position.set(0, 0.05, 0.02)
  band.scale.set(1.03, 0.85, 1)
  headphones.add(band)

  const bandAccent = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.024, 8, 28, Math.PI * 0.72), accentMat)
  bandAccent.rotation.z = Math.PI * 0.14
  bandAccent.position.set(0, 0.06, 0.04)
  bandAccent.scale.set(1.03, 0.85, 1)
  headphones.add(bandAccent)

  // 双侧耳罩
  for (const s of [-1, 1]) {
    const cup = new THREE.Group()
    cup.position.set(s * 0.89, -0.02, 0.04)
    cup.rotation.z = Math.PI / 2
    headphones.add(cup)

    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.16, 24), darkMat)
    shell.position.y = -s * 0.04
    cup.add(shell)

    const cushion = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.065, 12, 24), padMat)
    cushion.rotation.x = Math.PI / 2
    cushion.position.y = s * 0.03
    cup.add(cushion)

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.026, 10, 24), accentMat)
    ring.rotation.x = Math.PI / 2
    ring.position.y = -s * 0.12
    cup.add(ring)
  }

  // 主播麦克风弯杆（左侧向前弯曲）
  const micCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.92, -0.1, 0.08),
    new THREE.Vector3(-0.88, -0.28, 0.44),
    new THREE.Vector3(-0.46, -0.34, 0.74),
  ])
  const micArm = new THREE.Mesh(new THREE.TubeGeometry(micCurve, 14, 0.022, 8, false), darkMat)
  headphones.add(micArm)
  const micTip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 12), padMat)
  micTip.scale.set(1.25, 0.9, 0.9)
  micTip.position.set(-0.44, -0.34, 0.76)
  headphones.add(micTip)

  // 2. 圆框眼镜（挂在 head 上，随 eyeY / eyeSpread 实时贴合双眼）
  const glasses = new THREE.Group()
  glasses.visible = false
  head.add(glasses)

  const lensGeo = new THREE.TorusGeometry(0.245, 0.024, 12, 32)
  const leftLens = new THREE.Mesh(lensGeo, metalMat)
  const rightLens = new THREE.Mesh(lensGeo, metalMat)
  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 10), metalMat)
  bridge.rotation.z = Math.PI / 2
  const leftTemple = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.62, 8), metalMat)
  leftTemple.rotation.x = Math.PI / 2
  const rightTemple = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.62, 8), metalMat)
  rightTemple.rotation.x = Math.PI / 2
  glasses.add(leftLens, rightLens, bridge, leftTemple, rightTemple)

  // 3. 迷你皇冠（挂在 head 顶部）
  const crown = new THREE.Group()
  crown.visible = false
  crown.position.set(0, 0.66, 0.08)
  crown.rotation.x = 0.08
  head.add(crown)

  const crownBase = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.14, 24), goldMat)
  const crownBaseRim = new THREE.Mesh(new THREE.CylinderGeometry(0.255, 0.215, 0.15, 24), goldRimMat)
  crown.add(crownBaseRim, crownBase)

  const spikeCount = 5
  for (let i = 0; i < spikeCount; i++) {
    const a = (i / spikeCount) * Math.PI * 2 - Math.PI / 2
    const x = Math.cos(a) * 0.21
    const z = Math.sin(a) * 0.21
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.2, 6), goldMat)
    spike.position.set(x, 0.15, z)
    crown.add(spike)
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 10), i === 0 ? gemMat : goldMat)
    pearl.position.set(x, 0.26, z)
    crown.add(pearl)
  }
  const frontGem = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 10), gemMat)
  frontGem.position.set(0, 0.01, 0.225)
  crown.add(frontGem)

  // 4. 蝴蝶结铃铛项圈（挂在 upper 脖颈处，随身体缩放与点头联动）
  const collar = new THREE.Group()
  collar.visible = false
  upper.add(collar)

  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.062, 12, 32), ribbonMat)
  strap.rotation.x = Math.PI / 2
  const strapRim = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.074, 12, 32), ribbonDarkMat)
  strapRim.rotation.x = Math.PI / 2
  collar.add(strapRim, strap)

  const bow = new THREE.Group()
  bow.position.set(0, -0.02, 0.57)
  collar.add(bow)

  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.26, 14), ribbonMat)
    wing.rotation.z = s * (Math.PI / 2)
    wing.scale.set(0.85, 1, 0.55)
    wing.position.set(s * 0.12, 0, 0)
    bow.add(wing)

    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.03), ribbonMat)
    tail.position.set(s * 0.07, -0.13, -0.01)
    tail.rotation.z = -s * 0.28
    bow.add(tail)
  }
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.068, 14, 12), ribbonMat)
  knot.scale.set(1.1, 0.9, 0.8)
  bow.add(knot)

  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.092, 16, 14), goldMat)
  bell.position.set(0, -0.14, 0.04)
  const bellRim = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 14), rimDarkMat)
  bellRim.position.copy(bell.position)
  const bellSlot = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.012, 8, 20), goldRimMat)
  bellSlot.rotation.x = Math.PI / 2
  bellSlot.position.set(0, -0.155, 0.04)
  bow.add(bellRim, bell, bellSlot)

  return {
    setAccessories(acc) {
      if ('headphones' in acc) headphones.visible = Boolean(acc.headphones)
      if ('collar' in acc) collar.visible = Boolean(acc.collar)
      if ('glasses' in acc) glasses.visible = Boolean(acc.glasses)
      if ('crown' in acc) crown.visible = Boolean(acc.crown)
    },
    setAccentColor(hex) {
      accentMat.color.set(hex)
    },
    updateShape(params, headR) {
      const ex = 0.37 * params.eyeSpread
      const ey = params.eyeY
      const er = 0.205 * params.eyeSize
      const lensR = Math.max(0.18, er * 1.18)
      const lensScale = lensR / 0.245
      const zFace = headR[2] * Math.sqrt(Math.max(0.08, 1 - (ex / headR[0]) ** 2 - (ey / headR[1]) ** 2)) + 0.055

      leftLens.position.set(-ex, ey, zFace)
      rightLens.position.set(ex, ey, zFace)
      leftLens.scale.setScalar(lensScale)
      rightLens.scale.setScalar(lensScale)
      leftLens.rotation.y = -0.18
      rightLens.rotation.y = 0.18

      const bridgeW = Math.max(0.04, ex * 2 - lensR * 1.85)
      bridge.scale.set(1, bridgeW / 0.22, 1)
      bridge.position.set(0, ey + lensR * 0.12, zFace + 0.025)

      leftTemple.position.set(-(ex + lensR * 0.94), ey + lensR * 0.05, zFace - 0.31)
      rightTemple.position.set(ex + lensR * 0.94, ey + lensR * 0.05, zFace - 0.31)
      leftTemple.rotation.y = 0.16
      rightTemple.rotation.y = -0.16

      crown.position.y = headR[1] + 0.02
    },
    updateCollarPose(headY, _headZ, bodyW, neckW, loaf) {
      if (!collar.visible) return
      const rx = (0.54 + (neckW - 1) * 0.22) * (0.86 + bodyW * 0.24) * (1 + 0.14 * loaf)
      const rz = (0.56 + (neckW - 1) * 0.12) * (1 + 0.1 * loaf)
      collar.position.set(0, headY - 0.54 * (1 - 0.26 * loaf), -0.06 + 0.14 * loaf)
      collar.scale.set(rx / 0.54, 1, rz / 0.54)
    },
  }
}
