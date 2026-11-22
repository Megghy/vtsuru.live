import * as THREE from 'three'

import { createTypingCatAccessories } from './catAccessories'
import {
  DEFAULT_TYPING_CAT_SHAPE,
  resolveTypingCatColors,
  TYPING_CAT_COATS,
  TYPING_CAT_DESK_THEMES,
  TYPING_CAT_SHAPE_SPECS,
} from './types'
import type {
  TypingCatAccessories,
  TypingCatAutoMode,
  TypingCatCoatId,
  TypingCatCoatPreset,
  TypingCatCustomColors,
  TypingCatDeskTheme,
  TypingCatDeskThemeId,
  TypingCatIdleActivity,
  TypingCatShapeParams,
  TypingCatTurboSensitivity,
} from './types'

export interface TypingCatEngineOptions {
  coat?: TypingCatCoatId
  deskTheme?: TypingCatDeskThemeId
  showKeyboard?: boolean
  showMouse?: boolean
  leftMouse?: boolean
  followKeys?: boolean
  showKeyChips?: boolean
  showSpeedBadge?: boolean
  showOutline?: boolean
  cameraYaw?: number
  sleepMinutes?: number
  autoTyping?: TypingCatAutoMode
  idleActivity?: TypingCatIdleActivity
  loafOnIdle?: boolean
  allowPetting?: boolean
  turboTailTyping?: boolean
  turboSensitivity?: TypingCatTurboSensitivity
  accessories?: Partial<TypingCatAccessories>
  colors?: Partial<TypingCatCustomColors>
  shape?: Partial<TypingCatShapeParams>
}

export interface TypingCatEngine {
  readonly coats: readonly TypingCatCoatId[]
  setInput(keySet: ReadonlySet<string>, buttonSet: ReadonlySet<string>): void
  keyDown(code: string): void
  keyUp(code: string): void
  tapKey(code: string, durationMs?: number): void
  mouseDown(button?: string): void
  mouseUp(button?: string): void
  mouseMoved(dx?: number, dy?: number): void
  setOptions(options: TypingCatEngineOptions): void
  setShape(shape: Partial<TypingCatShapeParams>): void
  pet(durationMs?: number): void
  spin(): void
  sleep(): void
  wake(): void
  stretch(): void
  yawn(): void
  lick(): void
  pounce(): void
  loaf(): void
  burst(durationMs?: number): void
  clear(): void
  state(): 'sleeping' | 'petting' | 'typing' | 'mouse' | 'idle'
  destroy(): void
}

type PawSide = 'L' | 'R'

interface KeyEntry {
  code: string
  label: string
  mesh: THREE.Mesh<THREE.ExtrudeGeometry, THREE.MeshBasicMaterial>
  base: THREE.Color
  ox: number
  x: number
  z: number
  down: boolean
  glow: number
}

interface PawState {
  side: PawSide
  rim: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
  core: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>
  foot: THREE.Group
  root: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>
  pos: THREE.Vector3
  to: THREE.Vector3
  from: THREE.Vector3
  tapAt: number
  landed: boolean
  landedAt: number
  pending: KeyEntry | null
  held: number
  mode: 'rest' | 'up' | 'key' | 'mouse' | 'lick' | 'swat'
}

interface KeyChipItem {
  el: HTMLDivElement
  k: KeyEntry
  code: string
  born: number
  gone: number
}

const KEYBOARD_ROWS: readonly (readonly [string, number, string])[][] = [
  [
    ['Backquote', 1, '`'],
    ['Digit1', 1, '1'],
    ['Digit2', 1, '2'],
    ['Digit3', 1, '3'],
    ['Digit4', 1, '4'],
    ['Digit5', 1, '5'],
    ['Digit6', 1, '6'],
    ['Digit7', 1, '7'],
    ['Digit8', 1, '8'],
    ['Digit9', 1, '9'],
    ['Digit0', 1, '0'],
    ['Minus', 1, '-'],
    ['Equal', 1, '='],
    ['Backspace', 2, '⌫'],
  ],
  [
    ['Tab', 1.5, '⇥'],
    ['KeyQ', 1, 'Q'],
    ['KeyW', 1, 'W'],
    ['KeyE', 1, 'E'],
    ['KeyR', 1, 'R'],
    ['KeyT', 1, 'T'],
    ['KeyY', 1, 'Y'],
    ['KeyU', 1, 'U'],
    ['KeyI', 1, 'I'],
    ['KeyO', 1, 'O'],
    ['KeyP', 1, 'P'],
    ['BracketLeft', 1, '['],
    ['BracketRight', 1, ']'],
    ['Backslash', 1.5, '\\'],
  ],
  [
    ['CapsLock', 1.75, '⇪'],
    ['KeyA', 1, 'A'],
    ['KeyS', 1, 'S'],
    ['KeyD', 1, 'D'],
    ['KeyF', 1, 'F'],
    ['KeyG', 1, 'G'],
    ['KeyH', 1, 'H'],
    ['KeyJ', 1, 'J'],
    ['KeyK', 1, 'K'],
    ['KeyL', 1, 'L'],
    ['Semicolon', 1, ';'],
    ['Quote', 1, "'"],
    ['Enter', 2.25, '⏎'],
  ],
  [
    ['ShiftLeft', 2.25, '⇧'],
    ['KeyZ', 1, 'Z'],
    ['KeyX', 1, 'X'],
    ['KeyC', 1, 'C'],
    ['KeyV', 1, 'V'],
    ['KeyB', 1, 'B'],
    ['KeyN', 1, 'N'],
    ['KeyM', 1, 'M'],
    ['Comma', 1, ','],
    ['Period', 1, '.'],
    ['Slash', 1, '/'],
    ['ShiftRight', 2.75, '⇧'],
  ],
  [
    ['ControlLeft', 1.25, '⌃'],
    ['AltLeft', 1.25, '⌥'],
    ['MetaLeft', 1.25, '⌘'],
    ['Space', 7.5, 'space'],
    ['MetaRight', 1.25, '⌘'],
    ['AltRight', 1.25, '⌥'],
    ['ControlRight', 1.25, '⌃'],
  ],
]

// Touch-typing hands: these keys belong to the owner's left hand (paw on screen right because the keyboard faces the cat).
const LEFT_HAND_KEYS = new Set([
  'Escape',
  'F1',
  'F2',
  'F3',
  'F4',
  'F5',
  'Backquote',
  'Digit1',
  'Digit2',
  'Digit3',
  'Digit4',
  'Digit5',
  'Tab',
  'KeyQ',
  'KeyW',
  'KeyE',
  'KeyR',
  'KeyT',
  'CapsLock',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyF',
  'KeyG',
  'ShiftLeft',
  'KeyZ',
  'KeyX',
  'KeyC',
  'KeyV',
  'KeyB',
  'ControlLeft',
  'AltLeft',
  'MetaLeft',
])

const AUTO_TYPING_WORDS = [
  'meow ',
  'hello vtsuru ',
  'typing cat ',
  'good stream ',
  'nya nya ',
  'gg wp ',
]

const AUTO_PACE: Record<Exclude<TypingCatAutoMode, 'off'>, { hold: [number, number]; gap: [number, number]; rest: [number, number] }> = {
  chill: { hold: [85, 140], gap: [150, 290], rest: [2600, 4600] },
  normal: { hold: [65, 115], gap: [75, 175], rest: [1600, 3200] },
  fast: { hold: [35, 65], gap: [25, 65], rest: [600, 1100] },
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const rnd = (a: number, b: number) => a + Math.random() * (b - a)
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

function createParametricGeometry(
  func: (u: number, v: number, target: THREE.Vector3) => void,
  slices: number,
  stacks: number,
): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry()
  const vertices: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  const p = new THREE.Vector3()

  for (let i = 0; i <= stacks; i++) {
    const v = i / stacks
    for (let j = 0; j <= slices; j++) {
      const u = j / slices
      func(u, v, p)
      vertices.push(p.x, p.y, p.z)
      uvs.push(u, v)
    }
  }

  const sliceCount = slices + 1
  for (let i = 0; i < stacks; i++) {
    for (let j = 0; j < slices; j++) {
      const a = i * sliceCount + j
      const b = i * sliceCount + j + 1
      const c = (i + 1) * sliceCount + j + 1
      const d = (i + 1) * sliceCount + j
      indices.push(a, b, d, b, c, d)
    }
  }

  geo.setIndex(indices)
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.computeVertexNormals()
  return geo
}

function createRoundedSlab(w: number, d: number, r: number, hgt: number): THREE.ExtrudeGeometry {
  const sh = new THREE.Shape()
  const x = w / 2
  const y = d / 2
  sh.moveTo(-x + r, -y)
  sh.lineTo(x - r, -y)
  sh.quadraticCurveTo(x, -y, x, -y + r)
  sh.lineTo(x, y - r)
  sh.quadraticCurveTo(x, y, x - r, y)
  sh.lineTo(-x + r, y)
  sh.quadraticCurveTo(-x, y, -x, y - r)
  sh.lineTo(-x, -y + r)
  sh.quadraticCurveTo(-x, -y, -x + r, -y)
  const g = new THREE.ExtrudeGeometry(sh, { depth: hgt, bevelEnabled: false, curveSegments: 6 })
  g.rotateX(-Math.PI / 2)
  return g
}

function createSplineLookup(pts: readonly [number, number][]): (y: number) => number {
  const curve = new THREE.SplineCurve(pts.map(([a, b]) => new THREE.Vector2(a, b)))
  const table = curve.getPoints(120)
  return (y: number) => {
    let k = 0
    while (k < table.length - 2 && table[k + 1].x < y) k++
    const a = table[k]
    const b = table[k + 1]
    const f = clamp((y - a.x) / Math.max(1e-6, b.x - a.x), 0, 1)
    return a.y + (b.y - a.y) * f
  }
}

function charToCode(ch: string): string {
  if (ch === ' ') return 'Space'
  if (ch === '.') return 'Period'
  if (ch === ',') return 'Comma'
  return `Key${ch.toUpperCase()}`
}

export function createTypingCatEngine(
  stageEl: HTMLElement,
  initialOptions: TypingCatEngineOptions = {},
): TypingCatEngine | null {
  let renderer: THREE.WebGLRenderer
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  } catch {
    return null
  }

  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  stageEl.appendChild(renderer.domElement)

  const offs: (() => void)[] = []
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const on = <K extends keyof WindowEventMap>(
    type: K,
    fn: (event: WindowEventMap[K]) => void,
    opt?: boolean | AddEventListenerOptions,
  ) => {
    window.addEventListener(type, fn, opt)
    offs.push(() => window.removeEventListener(type, fn, opt))
  }

  let dead = false
  let raf = 0
  let followKeys = initialOptions.followKeys ?? true
  let showKeyChips = initialOptions.showKeyChips ?? true
  let showSpeedBadge = initialOptions.showSpeedBadge ?? false
  let showOutline = initialOptions.showOutline ?? true
  let allowPetting = initialOptions.allowPetting ?? true
  let turboTailTyping = initialOptions.turboTailTyping ?? true
  let turboSensitivity: TypingCatTurboSensitivity = initialOptions.turboSensitivity ?? 'normal'
  let autoTyping: TypingCatAutoMode = initialOptions.autoTyping ?? 'off'
  let idleActivity: TypingCatIdleActivity = initialOptions.idleActivity ?? 'normal'
  let loafOnIdle = initialOptions.loafOnIdle ?? true
  let cameraYawRad = ((initialOptions.cameraYaw ?? 0) * Math.PI) / 180
  let currentCoat: TypingCatCoatPreset = TYPING_CAT_COATS[0]
  let currentDeskTheme: TypingCatDeskTheme = TYPING_CAT_DESK_THEMES[0]
  let customColors: Partial<TypingCatCustomColors> = initialOptions.colors ? { ...initialOptions.colors } : {}
  let resolvedColors: TypingCatCustomColors = resolveTypingCatColors(initialOptions.coat, customColors)
  let halfRate = false

  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(29, 1, 0.1, 100)
  const CAM = V(0, 5.0, 10.2)
  const LOOK = V(0, 1.35, 0.45)

  const flat = (color: THREE.ColorRepresentation) => new THREE.MeshBasicMaterial({ color })
  const back = (color: THREE.ColorRepresentation) =>
    new THREE.MeshBasicMaterial({ color, side: THREE.BackSide })
  const onFace = (color: THREE.ColorRepresentation, k: number) =>
    new THREE.MeshBasicMaterial({
      color,
      polygonOffset: true,
      polygonOffsetFactor: -4 * k,
      polygonOffsetUnits: -4 * k,
    })

  // Materials recoloured by coat presets
  const M = {
    lid: onFace('#101010', 3),
    blush: flat('#f08f9c'),
    shut: onFace('#8b8f86', 1),
    fur: flat('#101010'),
    patch: flat('#101010'),
    line: back('#8b8f86'),
    eyeL: onFace('#b9d36b', 1),
    eyeR: onFace('#b9d36b', 1),
    pupil: onFace('#0b0b0b', 2),
    whisker: flat('#f4f4ee'),
    whiskerOut: flat('#101010'),
    stripe: onFace('#101010', 1),
    inner: flat('#101010'),
    body: new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
    head: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    ear: new THREE.MeshBasicMaterial({ color: 0x101010, side: THREE.DoubleSide }),
    tail: flat('#101010'),
    mouth: onFace('#d8667c', 2),
  }
  M.eyeL.side = THREE.DoubleSide
  M.eyeR.side = THREE.DoubleSide
  M.pupil.side = THREE.DoubleSide
  M.stripe.side = THREE.DoubleSide
  M.inner.side = THREE.DoubleSide

  // ---------- keyboard & mouse ----------
  const KB = { unit: 0.18, z0: 0.92 }
  const KEY_TOP = 0.2
  const DESK_DX = 0.2825
  const board = new THREE.Group()
  scene.add(board)

  const boardBaseMat = flat('#22231f')
  const boardBase = new THREE.Mesh(
    createRoundedSlab(15 * KB.unit + 0.2, 5 * KB.unit + 0.2, 0.11, 0.1),
    boardBaseMat,
  )
  boardBase.position.set(DESK_DX, 0, KB.z0 + 2.5 * KB.unit)
  board.add(boardBase)

  const KEYCAP = {
    plain: new THREE.Color('#fbfbf3'),
    mod: new THREE.Color('#e3dfce'),
    accent: new THREE.Color('#f2b25c'),
  }
  const keys = new Map<string, KeyEntry>()
  const capColor = new THREE.Color('#fbfbf3')
  const hitColor = new THREE.Color('#b9d36b')

  KEYBOARD_ROWS.forEach((row, r) => {
    let x = 0
    row.forEach(([code, w, label]) => {
      const wx = DESK_DX + (7.5 - (x + w / 2)) * KB.unit
      const wz = KB.z0 + (4 - r + 0.5) * KB.unit
      const base =
        code === 'Enter' || code === 'Backquote'
          ? KEYCAP.accent
          : (w > 1 && code !== 'Space') || /^(Alt|Meta|Control)/.test(code)
            ? KEYCAP.mod
            : KEYCAP.plain
      const mesh = new THREE.Mesh(
        createRoundedSlab(w * KB.unit - 0.03, KB.unit - 0.03, 0.035, 0.09),
        flat('#fbfbf3'),
      )
      mesh.geometry.translate(0, -0.045, 0)
      mesh.position.set(wx, 0.145, wz)
      board.add(mesh)
      keys.set(code, { code, label, mesh, base, ox: wx - DESK_DX, x: wx, z: wz, down: false, glow: 0 })
      x += w
    })
  })

  const MOUSE_AT = V(-1.795 + DESK_DX, 0, 1.08)
  const mouseGroup = new THREE.Group()
  mouseGroup.position.copy(MOUSE_AT)
  scene.add(mouseGroup)

  let mousePaw: PawSide = 'L'
  let deskDir = 1
  function setHanded(leftMouse: boolean) {
    deskDir = leftMouse ? -1 : 1
    mousePaw = leftMouse ? 'R' : 'L'
    boardBase.position.x = DESK_DX * deskDir
    keys.forEach((k) => {
      k.x = DESK_DX * deskDir + k.ox
      k.mesh.position.x = k.x
    })
    MOUSE_AT.x = (-1.795 + DESK_DX) * deskDir
  }

  const pawFor = (code: string): PawSide => (LEFT_HAND_KEYS.has(code) ? 'R' : 'L')

  const mouseBodyMat = flat('#fbfbf3')
  const mouseBody = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), mouseBodyMat)
  mouseBody.scale.set(0.7, 0.42, 1.2)
  mouseBody.position.y = 0.1
  mouseGroup.add(mouseBody)

  const mouseRim = new THREE.Mesh(mouseBody.geometry, back('#1c1d1a'))
  mouseRim.scale.set(0.77, 0.47, 1.27)
  mouseRim.position.y = 0.1
  mouseGroup.add(mouseRim)

  const mouseBtn = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.02, 0.16), flat('#1c1d1a'))
  mouseBtn.position.set(0, 0.215, 0.24)
  mouseGroup.add(mouseBtn)

  const mouseWheel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.09), flat('#f2b25c'))
  mouseWheel.position.set(0, 0.222, 0.16)
  mouseGroup.add(mouseWheel)

  // ---------- the cat ----------
  const cat = new THREE.Group()
  cat.position.set(0, 0, 0.08)
  scene.add(cat)

  const ball = <TMat extends THREE.Material>(r: number, mat: TMat, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 28), mat)
    m.scale.set(sx, sy, sz)
    return m
  }
  const addMesh = <T extends THREE.Object3D>(parent: THREE.Object3D, mesh: T, x: number, y: number, z: number): T => {
    mesh.position.set(x, y, z)
    parent.add(mesh)
    return mesh
  }

  const BODY_H = 2.5
  const halfW = createSplineLookup([
    [0, 0.86],
    [0.07, 0.9],
    [0.3, 1.0],
    [0.62, 1.03],
    [0.95, 0.93],
    [1.3, 0.75],
    [1.6, 0.58],
    [1.85, 0.47],
    [2.02, 0.41],
    [BODY_H, 0.37],
  ])
  const frontZ = createSplineLookup([
    [0, 0.4],
    [0.07, 0.43],
    [0.3, 0.5],
    [0.6, 0.54],
    [0.95, 0.52],
    [1.3, 0.48],
    [1.6, 0.46],
    [1.9, 0.42],
    [2.02, 0.4],
    [BODY_H, 0.36],
  ])
  const backZ = createSplineLookup([
    [0, -1.14],
    [0.07, -1.19],
    [0.3, -1.32],
    [0.6, -1.38],
    [0.95, -1.24],
    [1.3, -1.0],
    [1.6, -0.76],
    [1.9, -0.56],
    [2.02, -0.5],
    [BODY_H, -0.44],
  ])
  const halfD = (y: number) => (frontZ(y) - backZ(y)) / 2
  const midZ = (y: number) => (frontZ(y) + backZ(y)) / 2

  const upper = new THREE.Group()
  cat.add(upper)
  const torso = new THREE.Group()
  upper.add(torso)

  let neckW = 1
  let shoulderWidth = 1
  let builtNeck = -1
  const bodyMesh = new THREE.Mesh(new THREE.BufferGeometry(), M.body)
  torso.add(bodyMesh)

  function buildBody() {
    const sig = neckW + shoulderWidth * 100
    if (builtNeck === sig) return
    builtNeck = sig
    bodyMesh.geometry.dispose()
    bodyMesh.geometry = createParametricGeometry(
      (u, v, out) => {
        const y = v * BODY_H
        const a = u * Math.PI * 2
        const close = Math.sqrt(1 - (1 - Math.min(1, y / 0.12)) ** 2)
        const neckBoost = 1 + 0.34 * smooth(1.72, 2.2, y)
        const f =
          (1 + (neckW - 1) * smooth(1.15, 1.95, y)) *
          (1 + (shoulderWidth - 1) * smooth(0.55, 1.4, y) * (1 - smooth(1.6, 2.25, y))) *
          neckBoost
        const g = 1 + (f / neckBoost - 1) * 0.3
        const top = 1 - 0.8 * smooth(2.17, 2.46, y)
        out.set(
          Math.cos(a) * halfW(y) * f * close * top,
          y,
          midZ(y) + 0.1 * (1 - top) + Math.sin(a) * halfD(y) * g * close * top,
        )
      },
      56,
      44,
    )
  }

  const hindFeet = [-1, 1].map((s) => {
    const g = new THREE.Group()
    g.position.set(s * 0.6, 0.1, 0.25)
    cat.add(g)
    const rim = addMesh(g, ball(1, M.line, 0.216, 0.118, 0.325), 0, -0.012, 0.022)
    const foot = addMesh(g, ball(1, M.patch, 0.2, 0.11, 0.31), 0, 0, 0)
    foot.renderOrder = 1
    rim.renderOrder = 0
    return g
  })

  const HEAD_R = [0.86, 0.66, 0.7] as const
  upper.matrixAutoUpdate = false
  const headFix = new THREE.Group()
  headFix.matrixAutoUpdate = false
  upper.add(headFix)
  const head = new THREE.Group()
  head.position.set(0, 2.3, 0.1)
  headFix.add(head)

  const TEX = 256
  const mkTex = () => {
    const c = document.createElement('canvas')
    c.width = c.height = TEX
    const t = new THREE.CanvasTexture(c)
    // Match sRGB color interpretation of solid MeshBasicMaterial hex colors in Three.js r152+.
    t.colorSpace = THREE.SRGBColorSpace
    return { g: c.getContext('2d')!, t }
  }
  const bodyTex = mkTex()
  const headTex = mkTex()
  M.body.map = bodyTex.t
  M.head.map = headTex.t

  const paintBlob = (
    g: CanvasRenderingContext2D,
    u: number,
    v: number,
    ru: number,
    rv: number,
    color: string,
    rot = 0,
  ) => {
    g.fillStyle = color
    for (const du of [-1, 0, 1]) {
      g.beginPath()
      g.ellipse((u + du) * TEX, (1 - v) * TEX, ru * TEX, rv * TEX, rot, 0, Math.PI * 2 + 0.2)
      g.fill()
    }
  }

  function paintCoat(c: TypingCatCoatPreset, colors: TypingCatCustomColors) {
    const b = bodyTex.g
    const h = headTex.g
    const pat = c.pattern || ''
    b.fillStyle = colors.body
    b.fillRect(0, 0, TEX, TEX)
    h.fillStyle = colors.head
    h.fillRect(0, 0, TEX, TEX)
    if (pat.includes('tabby')) {
      const leaf = (
        g: CanvasRenderingContext2D,
        u0: number,
        v0: number,
        u1: number,
        v1: number,
        th: number,
      ) => {
        g.fillStyle = colors.stripe
        for (const du of [-1, 0, 1]) {
          const x0 = (u0 + du) * TEX
          const y0 = (1 - v0) * TEX
          const x1 = (u1 + du) * TEX
          const y1 = (1 - v1) * TEX
          const mx = (x0 + x1) / 2
          const my = (y0 + y1) / 2
          const len = Math.hypot(x1 - x0, y1 - y0)
          const nx = (-(y1 - y0) / len) * th * TEX
          const ny = ((x1 - x0) / len) * th * TEX
          g.beginPath()
          g.moveTo(x0, y0)
          g.quadraticCurveTo(mx + nx, my + ny, x1, y1)
          g.quadraticCurveTo(mx - nx * 0.9, my - ny * 0.9, x0, y0)
          g.fill()
        }
      }
      const marks: readonly [number, number, number][] = [
        [0.2, 0.17, 0.05],
        [0.285, 0.1, 0.03],
        [0.37, 0.19, 0.06],
        [0.455, 0.12, 0.035],
        [0.54, 0.16, 0.05],
        [0.62, 0.09, 0.03],
      ]
      for (const [v, len, droop] of marks) {
        leaf(b, 0.86, v + 0.02, 0.86 + len + 0.12, v - droop, 0.02)
        leaf(b, 0.64, v + 0.02, 0.64 - len - 0.12, v - droop, 0.02)
      }
      leaf(b, 0.75, 0.12, 0.75, 0.7, 0.02)
      leaf(h, 0.75, 0.35, 0.75, 0.85, 0.022)
      leaf(h, 0.68, 0.45, 0.62, 0.72, 0.016)
      leaf(h, 0.82, 0.45, 0.88, 0.72, 0.016)
    }
    if (pat.includes('calico')) {
      paintBlob(b, 0.04, 0.42, 0.15, 0.2, colors.patchA)
      paintBlob(b, 0.56, 0.22, 0.13, 0.13, colors.patchB)
      paintBlob(b, 0.78, 0.5, 0.16, 0.22, colors.patchB)
      paintBlob(b, 0.5, 0.56, 0.1, 0.12, colors.patchA)
      paintBlob(h, 0.11, 0.7, 0.13, 0.24, colors.patchA, 0.3)
      paintBlob(h, 0.42, 0.72, 0.11, 0.22, colors.patchB, -0.3)
      paintBlob(h, 0.75, 0.5, 0.2, 0.3, colors.patchB)
    }
    bodyTex.t.needsUpdate = true
    headTex.t.needsUpdate = true
    M.tail.color.set(colors.tail)
  }

  addMesh(head, ball(1, M.head, HEAD_R[0], HEAD_R[1], HEAD_R[2]), 0, 0, 0)
  const tongue = addMesh(
    head,
    ball(1, new THREE.MeshBasicMaterial({ color: '#f08a98' }), 0.06, 0.085, 0.04),
    0.02,
    -0.36,
    0.6,
  )
  tongue.visible = false

  // Ears
  const earR = createSplineLookup([
    [0, 0.3],
    [0.12, 0.285],
    [0.32, 0.22],
    [0.48, 0.13],
    [0.56, 0.062],
    [0.588, 0],
  ])
  const EAR_H = 0.588
  const EAR_T = 0.5
  const earGeo = new THREE.LatheGeometry(
    Array.from({ length: 29 }, (_, i) => new THREE.Vector2(Math.max(0, earR((i / 28) * EAR_H)), (i / 28) * EAR_H)),
    32,
  )
  const earInnerGeo = createParametricGeometry(
    (u, v, out) => {
      const y = mix(0.1, 0.47, v)
      const r = earR(y)
      const a = (u - 0.5) * 2 * 0.72 * Math.sqrt(Math.max(0, 1 - v ** 5)) * (0.72 + 0.28 * Math.min(1, v * 6))
      out.set(r * Math.sin(a), y, r * Math.cos(a) * EAR_T + 0.007)
    },
    20,
    28,
  )
  const ears = [-1, 1].map((s) => {
    const g = new THREE.Group()
    g.position.set(s * 0.46, 0.3, -0.04)
    g.rotation.z = -s * 0.24
    head.add(g)
    const ear = new THREE.Mesh(earGeo, M.ear)
    ear.scale.z = EAR_T
    g.add(ear)
    const inner = new THREE.Mesh(earInnerGeo, M.inner)
    inner.renderOrder = 3
    g.add(inner)
    return g
  })

  // Surface-wrapped patches for eyes, eyelids, blush, stripes, mouth
  const PR = 6
  const PS = 32
  function makePatch(mat: THREE.MeshBasicMaterial, order: number) {
    const geo = new THREE.BufferGeometry()
    const index: number[] = []
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array((1 + PR * PS) * 3), 3))
    for (let k = 0; k < PS; k++) index.push(0, 1 + k, 1 + ((k + 1) % PS))
    for (let r = 0; r < PR - 1; r++) {
      for (let k = 0; k < PS; k++) {
        const a = 1 + r * PS + k
        const b = 1 + r * PS + ((k + 1) % PS)
        const c = a + PS
        const d = b + PS
        index.push(a, c, b, b, c, d)
      }
    }
    geo.setIndex(index)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.renderOrder = order
    mesh.frustumCulled = false
    head.add(mesh)
    return mesh
  }

  const onHead = (
    x: number,
    y: number,
    z: number,
    lift: number,
    out: THREE.BufferAttribute,
    n: number,
  ) => {
    const k = 1 / Math.sqrt((x / HEAD_R[0]) ** 2 + (y / HEAD_R[1]) ** 2 + (z / HEAD_R[2]) ** 2)
    x *= k
    y *= k
    z *= k
    const nx = x / HEAD_R[0] ** 2
    const ny = y / HEAD_R[1] ** 2
    const nz = z / HEAD_R[2] ** 2
    const nl = Math.hypot(nx, ny, nz)
    out.setXYZ(n, x + (nx / nl) * lift, y + (ny / nl) * lift, z + (nz / nl) * lift)
  }

  function fillPatch(
    mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    turn: number,
    lift: number,
  ) {
    cx = clamp(cx, -0.78, 0.78)
    cy = clamp(cy, -0.58, 0.58)
    const pos = mesh.geometry.attributes.position as THREE.BufferAttribute
    const inside = Math.max(0.03, 1 - (cx / HEAD_R[0]) ** 2 - (cy / HEAD_R[1]) ** 2)
    const cz = HEAD_R[2] * Math.sqrt(inside)
    let ax = 1
    let az = -(cx / HEAD_R[0] ** 2) / (cz / HEAD_R[2] ** 2)
    const al = Math.hypot(ax, az)
    ax /= al
    az /= al
    let by = 1
    let bz = -(cy / HEAD_R[1] ** 2) / (cz / HEAD_R[2] ** 2)
    const bl = Math.hypot(by, bz)
    by /= bl
    bz /= bl
    const co = Math.cos(turn)
    const si = Math.sin(turn)
    onHead(cx, cy, cz, lift, pos, 0)
    for (let r = 1; r <= PR; r++) {
      for (let k = 0; k < PS; k++) {
        const a = (k / PS) * Math.PI * 2
        const u = (Math.cos(a) * rx * r) / PR
        const v = (Math.sin(a) * ry * r) / PR
        const lx = u * co - v * si
        const ly = u * si + v * co
        onHead(cx + ax * lx, cy + by * ly, cz + az * lx + bz * ly, lift, pos, 1 + (r - 1) * PS + k)
      }
    }
    pos.needsUpdate = true
  }

  const mouth = makePatch(M.mouth, 4)
  mouth.visible = false
  const eyes = [-1, 1].map((s) => ({
    s,
    iris: makePatch(s < 0 ? M.eyeL : M.eyeR, 3),
    pupil: makePatch(M.pupil, 4),
    lid: makePatch(M.lid, 5),
    blush: makePatch(M.blush, 2),
  }))
  const stripes = [-0.2, 0, 0.2].map((x) => ({ x, mesh: makePatch(M.stripe, 3) }))
  const accessoriesRig = createTypingCatAccessories(head, upper)

  const whiskers: { s: number; i: number; pivot: THREE.Group }[] = []
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const pivot = new THREE.Group()
      head.add(pivot)
      const pts = new THREE.QuadraticBezierCurve3(
        V(0, 0, 0),
        V(s * 0.24, 0.005, 0),
        V(s * 0.44, -0.075, 0),
      ).getPoints(14)
      pivot.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.slice(0, 7)), 8, 0.008, 5), M.whisker))
      pivot.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.slice(6)), 10, 0.008, 5), M.whiskerOut))
      whiskers.push({ s, i, pivot })
    }
  }

  // Sausage tubes for tail & forelimbs
  const SEG = 48
  const SIDES = 14
  const CAP = 5
  const RINGS = SEG + 1 + CAP
  function makeSausage(mat: THREE.MeshBasicMaterial, order: number) {
    const geo = new THREE.BufferGeometry()
    const index: number[] = []
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RINGS * SIDES * 3), 3))
    for (let r = 0; r < RINGS - 1; r++) {
      for (let k = 0; k < SIDES; k++) {
        const a = r * SIDES + k
        const b = r * SIDES + ((k + 1) % SIDES)
        const c = a + SIDES
        const d = b + SIDES
        index.push(a, b, c, b, d, c)
      }
    }
    geo.setIndex(index)
    const mesh = new THREE.Mesh(geo, mat)
    mesh.frustumCulled = false
    mesh.renderOrder = order
    return mesh
  }

  const sP = V(0, 0, 0)
  const sT = V(0, 0, 0)
  const sN = V(0, 0, 0)
  const sB = V(0, 0, 0)
  const sPrevN = V(0, 0, 0)
  function shapeSausage(
    mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>,
    path: THREE.Curve<THREE.Vector3>,
    radius: (t: number) => number,
    ref: THREE.Vector3,
    parallelTransport = false,
  ) {
    const pos = mesh.geometry.attributes.position as THREE.BufferAttribute
    let n = 0
    let endR = 0
    for (let r = 0; r < RINGS; r++) {
      let rad: number
      if (r <= SEG) {
        const t = r / SEG
        path.getPoint(t, sP)
        path.getTangent(t, sT)
        rad = radius(t)
        if (r === SEG) endR = rad
      } else {
        const a = ((r - SEG) / CAP) * (Math.PI / 2)
        path.getPoint(1, sP)
        path.getTangent(1, sT)
        sP.addScaledVector(sT, endR * Math.sin(a))
        rad = endR * Math.cos(a)
      }
      const basisRef = parallelTransport && r > 0 ? sPrevN : ref
      sN.copy(basisRef).addScaledVector(sT, -basisRef.dot(sT))
      if (sN.lengthSq() < 1e-6) {
        sN.set(0, 1, 0).addScaledVector(sT, -sT.y)
        if (sN.lengthSq() < 1e-6) sN.set(1, 0, 0).addScaledVector(sT, -sT.x)
      }
      sN.normalize()
      if (parallelTransport) sPrevN.copy(sN)
      sB.crossVectors(sT, sN)
      for (let k = 0; k < SIDES; k++) {
        const a = (k / SIDES) * Math.PI * 2
        const c = Math.cos(a) * rad
        const d = Math.sin(a) * rad
        pos.setXYZ(n++, sP.x + sN.x * c + sB.x * d, sP.y + sN.y * c + sB.y * d, sP.z + sN.z * c + sB.z * d)
      }
    }
    pos.needsUpdate = true
  }

  const AX = V(1, 0, 0)
  const AZ = V(0, 0, 1)

  const tailCurve = new THREE.CatmullRomCurve3(
    [
      V(0.3, 0.36, -0.75),
      V(0.82, 0.2, -0.64),
      V(1.16, 0.3, -0.5),
      V(1.3, 0.58, -0.42),
      V(1.46, 0.8, -0.37),
      V(1.66, 0.87, -0.35),
    ],
    false,
    'catmullrom',
    0.5,
  )
  const tailRim = makeSausage(M.line, 1)
  tailRim.visible = false
  const tail = makeSausage(M.tail, 2)
  cat.add(tailRim, tail)
  let tailK = 1
  let tailTypeMix = 0
  const tailRadius = (t: number) => 0.16 * tailK * (1 + 0.7 * (1 - smooth(0, 0.16, t)) ** 2)
  const TAIL_RIM_W = 0.022
  const buildTail = (k: number) => {
    tailK = k
    shapeSausage(tail, tailCurve, tailRadius, AZ, true)
    const rimScale = clamp(tailTypeMix * 1.4, 0, 1)
    tailRim.visible = rimScale > 0.02
    if (tailRim.visible) {
      shapeSausage(
        tailRim,
        tailCurve,
        (t) => tailRadius(t) + TAIL_RIM_W * smooth(0.15, 0.45, t) * rimScale,
        AZ,
        true,
      )
    }
  }
  buildTail(1)

  const TAIL_UP = tailCurve.points.map((q) => q.clone())
  const TAIL_DOWN = [
    V(0.3, 0.36, -0.75),
    V(0.84, 0.15, -0.62),
    V(1.22, 0.12, -0.42),
    V(1.44, 0.12, -0.1),
    V(1.46, 0.12, 0.26),
    V(1.3, 0.12, 0.52),
  ]
  const TAIL_TYPE_HOVER = V(1.16, 1.04, 1.22)
  const tailPaw = {
    pos: TAIL_TYPE_HOVER.clone(),
    from: TAIL_TYPE_HOVER.clone(),
    to: TAIL_TYPE_HOVER.clone(),
    tapAt: -1e9,
    landed: true,
    pending: null as KeyEntry | null,
    held: 0,
    strikeCount: 0,
  }
  const tailTypePts = Array.from({ length: 6 }, () => V(0, 0, 0))
  let tailDown = 0
  let tailWag = 0
  const lastTailTip = V(0, 0, 0)

  function poseTail(k: number, wag = 0, typeMix = 0, tip: THREE.Vector3 = TAIL_TYPE_HOVER) {
    const tipMoved = typeMix > 0.002 && tip.distanceToSquared(lastTailTip) > 1e-5
    if (
      Math.abs(k - tailDown) < 0.002 &&
      Math.abs(wag - tailWag) < 0.002 &&
      Math.abs(typeMix - tailTypeMix) < 0.002 &&
      !tipMoved
    ) {
      return
    }
    tailDown = k
    tailWag = wag
    tailTypeMix = typeMix
    lastTailTip.copy(tip)
    const e = k * k * (3 - 2 * k)
    const te = typeMix * typeMix * (3 - 2 * typeMix)
    const n = tailCurve.points.length

    if (te > 0.001) {
      const lift = clamp((tip.y - KEY_TOP) / 0.85, 0, 1)
      tailTypePts[0].set(0.3, 0.36, -0.75)
      tailTypePts[1].set(1.05, 0.36, -0.52)
      tailTypePts[2].set(1.62, 0.72, -0.1)
      tailTypePts[3].set(
        mix(1.7, tip.x + 0.62, 0.32),
        1.12 + lift * 0.22,
        mix(0.45, tip.z - 0.35, 0.42),
      )
      tailTypePts[4].set(
        mix(1.48, tip.x + 0.34, 0.58),
        Math.max(tip.y + 0.48, 0.82 + lift * 0.3),
        mix(0.95, tip.z - 0.06, 0.65),
      )
      tailTypePts[5].copy(tip)
    }

    tailCurve.points.forEach((q, i) => {
      q.lerpVectors(TAIL_UP[i], TAIL_DOWN[i], e)
      if (te > 0.001) {
        q.lerp(tailTypePts[i], te * (1 - e))
      }
      const tipWeight = Math.max(0, (i - (n - 3)) / 2)
      q.x += wag * 0.22 * tipWeight * tipWeight * (1 - te * 0.75)
      q.y += Math.abs(wag) * 0.05 * tipWeight * (1 - te * 0.75)
    })
    buildTail(tailK)
  }

  // Forelimbs
  const SHOULDER: Record<PawSide, THREE.Vector3> = { L: V(-0.25, 1.5, 0.19), R: V(0.25, 1.5, 0.19) }
  let legR = 0.16
  let footScale = 1
  const REST: Record<PawSide, THREE.Vector3> = { L: V(-0.23, 0.11, 0.76), R: V(0.23, 0.11, 0.76) }
  const UP: Record<PawSide, THREE.Vector3> = { L: V(-0.46, 1.1, 0.9), R: V(0.46, 1.1, 0.9) }
  const paws = {} as Record<PawSide, PawState>

  for (const side of ['L', 'R'] as const) {
    const rim = makeSausage(M.line, 1)
    const core = makeSausage(M.fur, 2)
    scene.add(rim, core)
    const root = ball(1, M.fur)
    scene.add(root)
    const foot = new THREE.Group()
    scene.add(foot)
    const fr = addMesh(foot, ball(1, M.line, 0.216, 0.118, 0.325), 0, -0.012, 0.022)
    const ff = addMesh(foot, ball(1, M.patch, 0.2, 0.11, 0.31), 0, 0, 0)
    fr.renderOrder = 2
    ff.renderOrder = 3
    paws[side] = {
      side,
      rim,
      core,
      foot,
      root,
      pos: REST[side].clone(),
      to: REST[side].clone(),
      from: V(0, 0, 0),
      tapAt: -1e9,
      landed: true,
      landedAt: -1e9,
      pending: null,
      held: 0,
      mode: 'rest',
    }
  }

  const tmpC = V(0, 0, 0)
  const limbCurve = new THREE.QuadraticBezierCurve3(V(0, 0, 0), V(0, 0, 0), V(0, 0, 0))
  let rimW = 0.03
  const legRadius = (t: number) => legR * mix(1.6, 0.8, smooth(0, 0.8, t))
  const rimRadius = (t: number) => legRadius(t) + rimW * smooth(0.3, 0.6, t)

  function drawLimb(p: PawState, shoulder: THREE.Vector3) {
    const s = p.side === 'L' ? -1 : 1
    const tip = tmpC.copy(p.pos)
    p.foot.position.copy(p.pos)
    tip.y += 0.05 * footScale
    tip.z -= 0.1 * footScale
    const dx = tip.x - shoulder.x
    const dz = tip.z - shoulder.z
    const drop = shoulder.y - tip.y
    const slack = clamp(1 - drop / 1.25, 0, 1)
    const far = Math.hypot(dx, dz)
    limbCurve.v0.copy(shoulder)
    limbCurve.v2.copy(tip)
    limbCurve.v1.set(
      shoulder.x + dx * 0.5 + s * (0.1 * slack + 0.04 * far),
      tip.y + drop * (0.5 - 0.35 * slack) + 0.16 * far,
      shoulder.z + dz * 0.5 + 0.08 + 0.45 * slack + 0.1 * far,
    )
    const out = smooth(0.6, 1.0, far)
    const lifted = smooth(0.25, 0.7, p.pos.y)
    const fr = p.foot.children[0]
    fr.position.set(0, -0.012 - 0.024 * lifted, 0.022 * (1 - lifted))
    fr.scale.set(0.216 - 0.01 * lifted, 0.118, 0.325 - 0.01 * lifted)
    limbCurve.v1.z = mix(Math.max(limbCurve.v1.z, tip.z + 0.32), limbCurve.v1.z, Math.max(out, lifted))
    rimW = mix(0.03, 0.013, Math.max(out, lifted))
    shapeSausage(p.core, limbCurve, legRadius, AX)
    shapeSausage(p.rim, limbCurve, rimRadius, AX)
    p.root.position.copy(shoulder)
    p.root.scale.setScalar(legRadius(0) * 1.02)
  }

  // ---------- coat & outline ----------
  const lumColor = new THREE.Color()
  function colorLuminance(hex: string) {
    lumColor.set(hex)
    return 0.2126 * lumColor.r + 0.7152 * lumColor.g + 0.0722 * lumColor.b
  }

  function applyOutlineFilter() {
    if (!showOutline) {
      renderer.domElement.style.filter = 'none'
      return
    }
    const pale = colorLuminance(resolvedColors.body) > 0.72
    const o = pale ? '#b5b1a2' : '#f1eee2'
    const w = pale ? 0.7 : 1
    renderer.domElement.style.filter = [
      [w, 0],
      [-w, 0],
      [0, w],
      [0, -w],
    ]
      .map(([x, y]) => `drop-shadow(${x}px ${y}px 0 ${o})`)
      .join(' ')
  }

  function applyDeskTheme(themeId?: TypingCatDeskThemeId) {
    const theme = TYPING_CAT_DESK_THEMES.find((item) => item.id === themeId) ?? TYPING_CAT_DESK_THEMES[0]
    currentDeskTheme = theme
    boardBaseMat.color.set(theme.base)
    KEYCAP.plain.set(theme.plain)
    KEYCAP.mod.set(theme.mod)
    KEYCAP.accent.set(theme.accent)
    capColor.set(theme.mouse)
    hitColor.set(theme.hit ?? resolvedColors.eye)
  }

  function applyCoat(coatId?: TypingCatCoatId, nextColors?: Partial<TypingCatCustomColors>) {
    const preset = TYPING_CAT_COATS.find((c) => c.id === coatId) ?? TYPING_CAT_COATS[0]
    currentCoat = preset
    if (nextColors !== undefined) {
      customColors = { ...nextColors }
    }
    const colors = resolveTypingCatColors(preset.id, customColors)
    resolvedColors = colors
    M.fur.color.set(colors.limbs)
    M.patch.color.set(colors.paws)
    M.line.color.set(colors.line)
    M.eyeL.color.set(colors.eye)
    M.eyeR.color.set(colors.eyeRight)
    M.pupil.color.set(colors.pupil)
    M.blush.color.set(colors.blush)
    M.whisker.color.set(colors.whisker)
    M.stripe.color.set(colors.stripe)
    M.inner.color.set(colors.inner)
    M.body.color.set('#ffffff')
    M.ear.color.set(colors.ear)
    M.lid.color.set(colors.head)
    paintCoat(preset, colors)
    whiskers.forEach((w) => w.pivot.scale.setScalar(0.78))
    applyOutlineFilter()
    M.shut.color.set(colorLuminance(colors.head) < 0.05 ? colors.eye : colors.line)
    M.whiskerOut.color.set(customColors.whisker ? colors.whisker : (preset.whiskerOut || colors.line))
    hitColor.set(currentDeskTheme.hit ?? colors.eye)
    accessoriesRig.setAccentColor(colors.eye)
  }

  // ---------- shape ----------
  const P: TypingCatShapeParams = { ...DEFAULT_TYPING_CAT_SHAPE }
  function applyShape() {
    head.scale.set(P.headSize * P.headW, P.headSize * P.headH, P.headSize)
    ears.forEach((g, i) => {
      const s = i ? 1 : -1
      g.position.x = s * 0.46 * P.earSpread
      g.scale.setScalar(P.earSize)
    })
    neckW = P.neckW
    shoulderWidth = P.shoulderW
    buildBody()
    stripes.forEach((st) =>
      fillPatch(st.mesh, st.x * 0.8, clamp(P.eyeY + 0.3, 0.34, 0.5) - Math.abs(st.x) * 0.25, 0.04, 0.09, 0, 0.006),
    )
    accessoriesRig.updateShape(P, HEAD_R)
    whiskers.forEach((w) => {
      const x = w.s * 0.4
      const y = P.eyeY * 0.35 - 0.2 + P.whiskY - w.i * 0.085
      const z = HEAD_R[2] * Math.sqrt(Math.max(0.03, 1 - (x / HEAD_R[0]) ** 2 - (y / HEAD_R[1]) ** 2))
      w.pivot.position.set(x, y, z + 0.008)
      w.pivot.rotation.set(0, -w.s * 0.52, w.s * (0.2 - w.i * 0.2))
    })
    hindFeet.forEach((g, i) => {
      g.position.x = (i ? 1 : -1) * 0.6 * P.bodyW
      g.scale.setScalar(P.footSize)
    })
    legR = 0.16 * P.legThick
    footScale = P.footSize
    paws.L.foot.scale.setScalar(P.footSize)
    paws.R.foot.scale.setScalar(P.footSize)
    for (const side of ['L', 'R'] as const) {
      const s = side === 'L' ? -1 : 1
      SHOULDER[side].x = s * Math.min(0.25 * P.legGap, 0.42 * P.bodyW)
      SHOULDER[side].y = 1.5 * P.bodyH
      REST[side].x = s * 0.23 * P.legGap
      UP[side].x = s * 0.46 * P.legGap
      UP[side].y = 1.1 * P.bodyH
    }
    buildTail(P.tailThick)
  }

  // ---------- state ----------
  const RISE = 30
  const FALL = 46
  const STRIKE = RISE + FALL
  const now0 = performance.now()
  const S = {
    last: now0,
    lastKey: -1e9,
    lastMouse: -1e9,
    lastInput: now0,
    wokeAt: -1e9,
    sleepAt: 0,
    down: new Map<string, PawSide | 'TAIL'>(),
    thump: 0,
    thumpSide: 0,
    jolt: -1e9,
    rate: 0,
    fast: 0,
    tailType: 0,
    burstUntil: 0,
    burstNext: 0,
    burstHeld: null as string | null,
    turn: 0,
    nod: 0,
    tilt: 0,
    lid: 0,
    blinkAt: now0 + 2500,
    blinkUntil: 0,
    happyUntil: 0,
    bounceAt: -1e9,
    act: null as string | null,
    actUntil: 0,
    nextAct: now0 + 6000,
    gazeX: 0,
    gazeY: 0,
    pointer: null as { x: number; y: number } | null,
    phase: 0,
    tailPhase: 0,
    lastSide: 'L' as PawSide,
    spin: 0,
    spinning: false,
    mouseDown: false,
    wigX: 0,
    wigZ: 0,
    lidDir: 1,
    mouseLean: 0,
    sx: 0,
    fwd: 0,
    fwdGoal: 0,
    demoMouse: 0,
    pet: false,
    petSide: -1,
    wantStretch: false,
    manualAct: false,
    wantLoaf: false,
    pounced: false,
    loaf: 0,
    low: 0,
    tailDown: 0,
    shake: 0,
    keyTimes: [] as number[],
    totalKeys: 0,
    lastSpeedHud: 0,
    chips: [] as KeyChipItem[],
  }

  const isSleeping = (t: number) => Boolean(S.sleepAt && t > S.sleepAt)
  let sleepAfterMs =
    initialOptions.sleepMinutes === 0 ? 0 : clamp(initialOptions.sleepMinutes ?? 5, 1, 120) * 60_000

  const zzz = document.createElement('div')
  zzz.className = 'typing-cat-zzz'
  zzz.innerHTML = '<span>Z</span><span>Z</span><span>Z</span>'
  stageEl.appendChild(zzz)

  const speedHud = document.createElement('div')
  speedHud.className = 'typing-cat-speed'
  speedHud.style.display = 'none'
  stageEl.appendChild(speedHud)

  const wake = (t = performance.now()) => {
    if (S.sleepAt) {
      S.sleepAt = 0
      S.blinkUntil = t + 320
      S.blinkAt = t + 620
      S.wokeAt = t
      S.bounceAt = t + 150
    }
    S.wantLoaf = false
    S.lastInput = t
  }

  function recordKeystroke(t: number) {
    S.totalKeys++
    S.keyTimes.push(t)
    if (S.keyTimes.length > 160) S.keyTimes.splice(0, S.keyTimes.length - 160)
  }

  function triggerIdleAction(name: 'stretch' | 'yawn' | 'lick' | 'pounce', durationMs: number) {
    const t = performance.now()
    wake(t)
    if (reduceMotion) return
    S.lastKey = -1e9
    S.lastMouse = -1e9
    S.act = name
    S.actUntil = t + durationMs
    S.manualAct = true
    S.nextAct = t + rnd(6000, 12000)
  }

  function scheduleTimeout(fn: () => void, ms: number) {
    const id = setTimeout(() => {
      timers.delete(id)
      if (!dead) fn()
    }, ms)
    timers.add(id)
    return id
  }

  function addChip(k: KeyEntry) {
    if (!showKeyChips || !followKeys) return
    const el = document.createElement('div')
    el.className = 'typing-cat-chip'
    el.textContent = k.label
    stageEl.appendChild(el)
    S.chips.push({ el, k, code: k.code, born: performance.now(), gone: 0 })
  }

  function land(p: PawState, t: number) {
    p.landed = true
    p.landedAt = t
    S.thump = 1
    S.thumpSide = p.side === 'L' ? -1 : 1
    S.jolt = t
    const k = p.pending
    p.pending = null
    if (!k) return
    k.glow = 1
    k.down = S.down.has(k.code)
    addChip(k)
    if (!k.down && showKeyChips && followKeys && S.chips.length > 0) {
      const c = S.chips[S.chips.length - 1]
      scheduleTimeout(() => {
        c.gone = performance.now()
      }, 160)
    }
  }

  function strike(side: PawSide, x: number, z: number, t: number, key: KeyEntry | null) {
    const p = paws[side]
    if (!p.landed) land(p, t)
    if (p.mode === 'up') p.pos.copy(UP[side])
    p.from.copy(p.pos)
    p.to.set(x, KEY_TOP + 0.09, z)
    p.tapAt = p.mode === 'up' ? t - RISE : t
    p.landed = false
    p.pending = key
    p.mode = 'key'
    S.lastKey = t
    S.rate = Math.min(12, S.rate + 1)
    S.lastSide = side
    recordKeystroke(t)
  }

  function landTail(t: number) {
    tailPaw.landed = true
    S.thump = 1
    S.thumpSide = 1
    S.jolt = t
    const k = tailPaw.pending
    tailPaw.pending = null
    if (!k) return
    k.glow = 1
    k.down = S.down.has(k.code)
    addChip(k)
    if (!k.down && showKeyChips && followKeys && S.chips.length > 0) {
      const c = S.chips[S.chips.length - 1]
      scheduleTimeout(() => {
        c.gone = performance.now()
      }, 160)
    }
  }

  function strikeTail(x: number, z: number, t: number, key: KeyEntry | null) {
    if (!tailPaw.landed) landTail(t)
    tailPaw.from.copy(tailPaw.pos)
    tailPaw.to.set(x, KEY_TOP + 0.04, z - 0.08)
    tailPaw.tapAt = t
    tailPaw.landed = false
    tailPaw.pending = key
    S.lastKey = t
    S.rate = Math.min(12, S.rate + 1)
    S.lastSide = 'R'
    recordKeystroke(t)
  }

  function keyDownInternal(code: string, t = performance.now()) {
    if (S.down.has(code)) return
    wake(t)
    const side: PawSide =
      code === 'Space' && t - S.lastMouse < 1600 ? (mousePaw === 'L' ? 'R' : 'L') : pawFor(code)

    if (!followKeys) {
      if (turboTailTyping && board.visible && S.fast > 0.22 && t - tailPaw.tapAt > 95 && ++tailPaw.strikeCount % 3 === 0) {
        S.down.set(code, 'TAIL')
        strikeTail(boardBase.position.x + rnd(0.55, 1.18), KB.z0 + rnd(0.28, 0.74), t, null)
        tailPaw.held = 1
        return
      }
      S.down.set(code, side)
      strike(side, (side === 'L' ? -1 : 1) * rnd(0.45, 1.0), KB.z0 + rnd(0.35, 0.7), t, null)
      paws[side].held = 1
      return
    }

    const k = keys.get(code) ?? null
    let x: number
    let z: number
    if (k) {
      x = k.x
      z = k.z
      if (code === 'Space') x += (side === 'L' ? -1 : 1) * 0.3
    } else {
      x = (side === 'L' ? -1 : 1) * 0.8
      z = KB.z0 + 0.55
    }

    // When hammering keys fast, let the tail swing in over the right side of the keyboard
    if (turboTailTyping && board.visible && S.fast > 0.22) {
      const relX = x - boardBase.position.x
      if (relX >= 0.35 && t - tailPaw.tapAt > 85 && (++tailPaw.strikeCount % 2 === 0 || relX >= 0.78)) {
        S.down.set(code, 'TAIL')
        strikeTail(x, z, t, k)
        tailPaw.held = 1
        return
      }
      if (S.fast > 0.38 && t - tailPaw.tapAt > 125) {
        strikeTail(boardBase.position.x + rnd(0.58, 1.22), KB.z0 + rnd(0.26, 0.74), t, null)
      }
    }

    S.down.set(code, side)
    strike(side, x, z, t, k)
    paws[side].held = 1
  }

  function keyUpInternal(code: string) {
    const side = S.down.get(code)
    if (!side) return
    S.down.delete(code)
    const k = keys.get(code)
    if (k) k.down = false
    if (side === 'TAIL') {
      if (![...S.down.values()].includes('TAIL')) tailPaw.held = 0
    } else if (![...S.down.values()].includes(side)) {
      paws[side].held = 0
    }
    const c = S.chips.find((item) => item.code === code && !item.gone)
    if (c) c.gone = performance.now()
  }

  // Pointer & petting interaction
  let lastPointer: { x: number; y: number } | null = null
  const petRay = new THREE.Raycaster()
  const petAt = new THREE.Vector2()
  const proj = V(0, 0, 0)

  const onHeadAt = (e: PointerEvent) => {
    if (!allowPetting) return 0
    const target = e.target as HTMLElement | null
    if (!target || !stageEl.contains(target) || target.closest('button, input, a')) return 0
    const r = renderer.domElement.getBoundingClientRect()
    if (!r.width || !r.height) return 0
    petAt.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1))
    petRay.setFromCamera(petAt, camera)
    if (!petRay.intersectObject(head, true).length) return 0
    proj.setFromMatrixPosition(head.matrixWorld).project(camera)
    return petAt.x > proj.x ? -1 : 1
  }

  on('pointermove', (e) => {
    const r = stageEl.getBoundingClientRect()
    if (!r.width || !r.height) return
    S.pointer = {
      x: ((e.clientX - r.left) / r.width) * 2 - 1,
      y: ((e.clientY - r.top) / r.height) * 2 - 1,
    }
    if (e.pointerType === 'touch') return
    if (lastPointer && stageEl.contains(e.target as Node | null)) {
      const dx = e.clientX - lastPointer.x
      const dy = e.clientY - lastPointer.y
      if (Math.abs(dx) + Math.abs(dy) > 2) {
        const t = performance.now()
        wake(t)
        S.lastMouse = t
        S.wigX = clamp(S.wigX + dx * 0.004, -0.16, 0.16)
        S.wigZ = clamp(S.wigZ + dy * 0.004, -0.12, 0.12)
      }
    }
    lastPointer = { x: e.clientX, y: e.clientY }
  })

  on('pointerdown', (e) => {
    const side = onHeadAt(e)
    if (side) {
      const t = performance.now()
      wake(t)
      S.pet = true
      S.petSide = side
      S.happyUntil = 1e15
    }
  })

  on('pointerout', (e) => {
    if (!e.relatedTarget) S.pointer = null
  })

  const endPet = () => {
    if (S.pet) {
      S.pet = false
      S.happyUntil = performance.now() + 900
    }
  }
  on('pointerup', endPet)
  on('pointercancel', endPet)

  // Auto-typing engine (for OBS autonomous mode)
  let autoWordIdx = 0
  let autoCharIdx = 0
  let autoNext = performance.now() + 800
  let autoHeldCode: string | null = null
  let autoRest = false
  let lastManualInputAt = -1e9

  function releaseAutoKey() {
    if (autoHeldCode) {
      keyUpInternal(autoHeldCode)
      autoHeldCode = null
    }
  }

  function runAutoTyping(t: number) {
    if (autoTyping === 'off' || reduceMotion) {
      releaseAutoKey()
      return
    }
    // Pause briefly if manual input occurred recently
    if (t - lastManualInputAt < 2500) {
      releaseAutoKey()
      return
    }
    if (t < autoNext) return

    const pace = AUTO_PACE[autoTyping]
    if (autoHeldCode) {
      keyUpInternal(autoHeldCode)
      autoHeldCode = null
      if (autoRest) {
        autoRest = false
        const restMs = rnd(pace.rest[0], pace.rest[1])
        autoNext = t + restMs
        if (mouseGroup.visible && Math.random() < 0.55) {
          S.demoMouse = t + Math.min(restMs * 0.75, 2400)
          S.lastMouse = t
        }
      } else {
        autoNext = t + rnd(pace.gap[0], pace.gap[1])
      }
      return
    }

    const word = AUTO_TYPING_WORDS[autoWordIdx % AUTO_TYPING_WORDS.length]
    const ch = word[autoCharIdx++]
    const code = charToCode(ch)
    keyDownInternal(code, t)
    autoHeldCode = code
    autoNext = t + rnd(pace.hold[0], pace.hold[1])
    if (autoCharIdx >= word.length) {
      autoCharIdx = 0
      autoWordIdx = (autoWordIdx + 1) % AUTO_TYPING_WORDS.length
      autoRest = true
    }
  }

  const BURST_KEYS = [
    'KeyQ',
    'KeyJ',
    'KeyA',
    'KeyK',
    'KeyD',
    'KeyW',
    'KeyL',
    'KeyS',
    'KeyF',
    'KeyZ',
    'KeyP',
    'KeyE',
    'Digit2',
    'KeyN',
    'Space',
    'KeyM',
    'KeyR',
  ]
  let burstIdx = 0

  function runBurst(t: number) {
    if (t >= S.burstUntil) {
      if (S.burstHeld) {
        keyUpInternal(S.burstHeld)
        S.burstHeld = null
      }
      return
    }
    if (t < S.burstNext) return
    if (S.burstHeld) {
      keyUpInternal(S.burstHeld)
      S.burstHeld = null
    }
    const code = BURST_KEYS[burstIdx++ % BURST_KEYS.length]
    keyDownInternal(code, t)
    S.burstHeld = code
    S.burstNext = t + rnd(55, 82)
  }

  // ---------- main animation loop ----------
  const shoulderW = V(0, 0, 0)
  const tmpGoal = V(0, 0, 0)

  function frame() {
    if (dead) return
    const t = performance.now()
    const realDt = Math.min(1, (t - S.last) / 1000)
    const dt = Math.min(0.05, realDt)
    S.last = t
    const ease = (k: number) => 1 - Math.exp(-dt * k)

    runBurst(t)
    runAutoTyping(t)
    if (!S.sleepAt && autoTyping === 'off' && t >= S.burstUntil && sleepAfterMs > 0 && t - S.lastInput > sleepAfterMs) {
      S.sleepAt = t
    }

    const typing = t - S.lastKey < 3000
    const hover = t - S.lastKey < 900
    const asleep = isSleeping(t)
    const happy = t < S.happyUntil

    if (autoTyping !== 'off' && t < S.demoMouse) {
      S.lastMouse = t
      S.wigX = Math.sin(t / 170) * 0.12
      S.wigZ = Math.cos(t / 230) * 0.08
      S.mouseDown = S.demoMouse - t < 750 && S.demoMouse - t > 520
    }

    const mouseOn = mouseGroup.visible && t - S.lastMouse < 1600 && !asleep
    const mousing = mouseGroup.visible && t - S.lastMouse < 2200 && S.lastMouse > S.lastKey && !asleep
    S.wigX *= Math.exp(-dt * 5)
    S.wigZ *= Math.exp(-dt * 5)
    S.mouseLean += ((mousing ? 1 : 0) - S.mouseLean) * ease(6)
    mouseGroup.position.set(
      MOUSE_AT.x + (deskDir > 0 ? Math.min(S.wigX, 0.05) : Math.max(S.wigX, -0.05)),
      0,
      MOUSE_AT.z + S.wigZ,
    )
    mouseBodyMat.color.copy(capColor).lerp(hitColor, S.mouseDown && mouseOn ? 1 : 0)
    S.rate *= Math.exp(-dt * 1.2)
    const [fastLo, fastHi] =
      turboSensitivity === 'easy' ? [2.0, 4.2] : turboSensitivity === 'hard' ? [4.2, 7.6] : [2.8, 5.6]
    const fastTarget = turboTailTyping && !asleep && !happy ? smooth(fastLo, fastHi, S.rate) : 0
    S.fast += (fastTarget - S.fast) * ease(fastTarget > S.fast ? 10 : 3.2)
    const fast = S.fast
    S.thump *= Math.exp(-dt * 13)

    // Power saving: drop to 30fps while completely idle
    if (
      t - Math.max(S.lastKey, S.lastMouse, S.wokeAt || 0) > 2500 &&
      !S.pet &&
      !S.act &&
      t >= S.happyUntil &&
      !S.spinning &&
      (halfRate = !halfRate)
    ) {
      raf = requestAnimationFrame(frame)
      return
    }

    const w = stageEl.clientWidth
    const h = stageEl.clientHeight
    if (!w || !h) {
      raf = requestAnimationFrame(frame)
      return
    }
    zzz.style.fontSize = `${w * 0.063}px`
    const dpr = renderer.getPixelRatio()
    if (renderer.domElement.width !== Math.round(w * dpr) || renderer.domElement.height !== Math.round(h * dpr)) {
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.fov = w / h < 1 ? 38 : 31
      camera.updateProjectionMatrix()
    }

    if (S.spinning) {
      S.spin += dt * 2.4
      if (S.spin >= Math.PI * 2) {
        S.spin = 0
        S.spinning = false
      }
    }
    const camAngle = cameraYawRad + S.spin
    camera.position.set(
      Math.sin(camAngle) * CAM.z,
      CAM.y,
      Math.cos(camAngle) * CAM.z + (1 - Math.cos(camAngle)) * LOOK.z,
    )
    camera.lookAt(LOOK)

    // keys
    const jolt = 0.03 * Math.exp(-(t - S.jolt) / 55)
    board.position.y = -jolt
    keys.forEach((k) => {
      if (!k.down && k.glow > 0) k.glow = Math.max(0, k.glow - dt * 5)
      k.mesh.position.y = 0.145 - (k.down ? 0.045 : 0)
      k.mesh.material.color.copy(k.base).lerp(hitColor, k.glow)
    })

    // body
    S.phase += dt * (asleep ? 0.9 : 1.7 + Math.min(1.4, S.rate * 0.14))
    const breath = reduceMotion ? 0 : Math.sin(S.phase)
    const bounceE = (t - S.bounceAt) / 420
    const bounce = bounceE > 0 && bounceE < 1 ? Math.sin(Math.PI * bounceE) : 0
    const reach =
      (paws.L.pos.z > 0.86 ? paws.L.pos.x - REST.L.x : 0) +
      (paws.R.pos.z > 0.86 ? paws.R.pos.x - REST.R.x : 0)
    const act0 = S.act
    const stretching = act0 === 'stretch'
    const licking = act0 === 'lick'
    const yawning = act0 === 'yawn'
    const flicking = act0 === 'tail'
    const pouncing = act0 === 'pounce'
    const actLeft = S.actUntil - t
    const yawn = yawning ? Math.sin(clamp(1 - actLeft / 1900, 0, 1) * Math.PI) ** 0.7 : 0
    const crouch = pouncing && actLeft > 520
    const swat = pouncing && actLeft <= 520 && actLeft > 120
    if (pouncing && actLeft <= 520 && !S.pounced) {
      S.pounced = true
      S.bounceAt = t
    }
    if (!pouncing) S.pounced = false
    const idleForLoaf =
      !typing &&
      !mousing &&
      !asleep &&
      !happy &&
      !S.pet &&
      !S.act &&
      autoTyping === 'off' &&
      t >= S.burstUntil &&
      (S.wantLoaf || (loafOnIdle && t - S.lastInput > 15_000))
    S.loaf += ((idleForLoaf ? 1 : 0) - S.loaf) * ease(idleForLoaf ? 2.4 : 7.5)
    S.low += ((stretching ? 1 : crouch ? 0.55 : 0) - S.low) * ease(crouch ? 9 : 5)
    const loaf = S.loaf
    const squat = 1 - 0.4 * loaf - 0.16 * S.low
    torso.scale.set(
      P.bodyW * (1 + 0.14 * loaf + breath * (0.012 + 0.012 * loaf) - bounce * 0.03),
      P.bodyH * squat * (1 + breath * 0.012 + bounce * 0.05 - S.thump * (0.012 + 0.02 * fast)),
      1 + 0.1 * loaf + breath * 0.02,
    )

    let farZ = 0
    for (const sd of ['L', 'R'] as const) {
      const q = paws[sd]
      if (q.held || t - q.tapAt < 260) farZ = Math.max(farZ, q.to.z)
    }
    if (farZ) S.fwdGoal = clamp(0.14 + (farZ - KB.z0) * 0.32, 0.14, 0.42)
    S.fwd += ((asleep ? 0 : mousing ? 0.2 : hover ? S.fwdGoal : 0) - S.fwd) * ease(7)
    S.sx += (clamp(reach * 0.13, -0.2, 0.2) - deskDir * S.mouseLean * 0.24 - S.sx) * ease(9)
    const sx = S.sx + S.thump * S.thumpSide * 0.012 + (crouch ? Math.sin(t / 55) * 0.02 : 0)
    const fwd = S.fwd
    upper.matrix.set(1, sx, 0, 0, 0, 1 - fwd * fwd * 0.35, 0, 0, 0, fwd, 1, 0, 0, 0, 0, 1)

    S.tailDown += ((asleep ? 1 : 0) - S.tailDown) * ease(2.6)
    const tailTypingActive = turboTailTyping && board.visible && !asleep && fast > 0.12
    S.tailType += ((tailTypingActive ? smooth(0.12, 0.42, fast) : 0) - S.tailType) * ease(tailTypingActive ? 11 : 4.2)

    // Animate tail tip when participating in rapid typing
    const tailSince = t - tailPaw.tapAt
    if (tailSince < STRIKE) {
      const k = 1 - Math.pow(1 - Math.min(1, tailSince / 60), 3)
      tailPaw.pos.lerpVectors(tailPaw.from, tailPaw.to, k)
      tailPaw.pos.y =
        tailSince < RISE
          ? mix(tailPaw.from.y, Math.max(tailPaw.from.y, tailPaw.to.y + 0.78), tailSince / RISE)
          : mix(Math.max(tailPaw.from.y, tailPaw.to.y + 0.78), tailPaw.to.y - 0.02, Math.pow((tailSince - RISE) / FALL, 2))
    } else {
      if (!tailPaw.landed) landTail(t)
      if (tailPaw.held || tailSince < STRIKE + 65) {
        tailPaw.pos.x += (tailPaw.to.x - tailPaw.pos.x) * ease(28)
        tailPaw.pos.z += (tailPaw.to.z - tailPaw.pos.z) * ease(28)
        tailPaw.pos.y += (tailPaw.to.y - 0.02 - tailPaw.pos.y) * ease(28)
      } else {
        const hoverSway = tailTypingActive ? S.tailType : 0
        tmpGoal.set(
          boardBase.position.x + 0.88 + Math.cos(t / 160) * 0.1 * hoverSway,
          1.04 + Math.sin(t / 120) * 0.09 * hoverSway,
          1.22,
        )
        tailPaw.pos.lerp(tmpGoal, ease(16))
      }
    }

    poseTail(
      S.tailDown < 0.003 ? 0 : S.tailDown > 0.997 ? 1 : S.tailDown,
      flicking
        ? Math.sin(t / 85) * Math.sin(clamp(1 - actLeft / 1400, 0, 1) * Math.PI)
        : crouch
          ? Math.sin(t / 60) * 0.5
          : 0,
      S.tailType < 0.003 ? 0 : S.tailType,
      tailPaw.pos,
    )
    S.tailPhase += dt * (6.25 + 4.8 * fast)
    tail.rotation.z =
      (Math.sin(t / 900) * 0.05 * (1 - S.tailDown) +
        (typing ? Math.sin(S.tailPhase) * (0.02 + 0.05 * fast) : 0)) *
      (1 - S.tailType * 0.94)
    tailRim.rotation.z = tail.rotation.z

    // head
    const calm = !typing && !asleep && !happy && !mousing
    if (S.wantStretch) {
      S.wantStretch = false
      if (!asleep && !reduceMotion) {
        S.act = 'stretch'
        S.actUntil = t + 1700
        S.manualAct = true
        S.nextAct = t + rnd(6000, 12000)
      }
    }
    if (calm && !reduceMotion && idleActivity !== 'off' && t > S.nextAct && !S.act) {
      const pool = ['lookL', 'lookR', 'tilt', 'ear', 'ear', 'lick', 'lick', 'yawn', 'yawn', 'tail', 'pounce']
      const picked = pool[Math.floor(Math.random() * pool.length)]
      S.act = picked
      S.manualAct = false
      S.actUntil =
        t +
        (picked === 'ear'
          ? 420
          : picked === 'lick'
            ? 3200
            : picked === 'yawn'
              ? 1900
              : picked === 'tail'
                ? 1400
                : picked === 'pounce'
                  ? 1150
                  : 1700)
      const [gapMin, gapMax] =
        idleActivity === 'quiet' ? [14_000, 26_000] : idleActivity === 'lively' ? [2500, 6000] : [6000, 14_000]
      S.nextAct = t + rnd(gapMin, gapMax)
    }
    if (S.act && (t > S.actUntil || (!calm && !S.manualAct) || asleep || typing)) {
      S.act = null
      S.manualAct = false
    }

    const looking = typing && t - S.lastKey < 1000
    const follow = mousing && S.pointer && !(autoTyping !== 'off' && t < S.demoMouse)
    let pdx = 0
    let pdy = 0
    if (follow && S.pointer) {
      proj.setFromMatrixPosition(head.matrixWorld).project(camera)
      pdx = S.pointer.x - proj.x
      pdy = S.pointer.y + proj.y
    }
    const turnT = asleep
      ? 0
      : follow
        ? clamp(pdx * 0.5, -0.4, 0.4)
        : mousing
          ? -0.36 * deskDir
          : looking
            ? S.lastSide === 'L'
              ? -0.3
              : 0.3
            : S.act === 'lookL'
              ? -0.45
              : S.act === 'lookR'
                ? 0.45
                : S.pointer && !typing
                  ? clamp(S.pointer.x, -1, 1) * 0.22
                  : 0
    const nodT = asleep
      ? 0.5
      : yawning
        ? -0.3 * yawn
        : crouch
          ? 0.16
          : happy
            ? -0.12
            : licking
              ? 0.34 + Math.sin(t / 140) * 0.09
              : stretching
                ? -0.18
                : looking
                  ? 0.3
                  : follow
                    ? clamp(pdy * 0.5, -0.28, 0.4)
                    : mousing
                      ? 0.22
                      : S.pointer && !typing
                        ? clamp(S.pointer.y * 0.2, -0.16, 0.2)
                        : 0
    const tiltT = asleep
      ? 0.16
      : licking
        ? -0.12
        : S.act === 'tilt'
          ? 0.2
          : happy
            ? (S.petSide || -1) * 0.1 + Math.sin(t / 330) * 0.06
            : 0
    S.turn += (turnT - S.turn) * ease(7)
    S.nod += (nodT - S.nod) * ease(6)
    S.tilt += (tiltT - S.tilt) * ease(5)
    const wakeW = (t - S.wokeAt) / 750
    S.shake = wakeW > 0.15 && wakeW < 1 ? Math.sin(wakeW * 26) * 0.16 * (1 - wakeW) : 0

    head.rotation.set(S.nod + S.thump * (0.05 + 0.05 * fast), S.turn + S.shake, S.tilt)
    head.position.z = 0.1 - fwd * 0.5 + 0.3 * loaf
    head.position.y =
      (2.3 * P.bodyH + P.neck) * (1 - 0.43 * loaf - 0.16 * S.low) +
      breath * 0.018 +
      bounce * 0.09 -
      (asleep ? 0.14 : 0) -
      S.thump * 0.02
    const py = head.position.y
    headFix.matrix.set(1, -sx, 0, sx * py, 0, 1, 0, 0, 0, -fwd, 1, fwd * py, 0, 0, 0, 1)
    accessoriesRig.updateCollarPose(head.position.y, head.position.z, P.bodyW, P.neckW, loaf)

    const flick = S.act === 'ear' ? Math.sin(((S.actUntil - t) / 420) * Math.PI * 2) * 0.28 : 0
    const relax = S.lidDir < 0 ? 0.2 * smooth(0.5, 1, S.lid) : 0
    ears[0].rotation.z = 0.24 + relax + flick
    ears[1].rotation.z = -0.24 - relax - flick * 0.5
    ears[0].rotation.x = ears[1].rotation.x = -0.32 * fast

    // eyes
    if (t > S.blinkAt) {
      S.blinkUntil = t + 130
      S.blinkAt = t + rnd(2600, 5600)
    }
    S.lidDir = happy ? -1 : 1
    const lidT = asleep || t < S.blinkUntil || happy || licking || stretching || yawn > 0.25 ? 1 : 0
    S.lid += (lidT - S.lid) * (1 - Math.exp(-realDt * (lidT > S.lid ? 34 : 16)))
    const gx = follow
      ? clamp(pdx * 2.2, -1, 1)
      : mousing
        ? -0.8 * deskDir
        : looking
          ? S.lastSide === 'L'
            ? -0.5
            : 0.5
          : S.pointer
            ? clamp(S.pointer.x * 1.2, -1, 1)
            : 0
    const gy = follow
      ? clamp(pdy * 2.2, -1, 1)
      : looking || mousing
        ? 1
        : S.pointer
          ? clamp(S.pointer.y * 1.3, -1, 1)
          : 0
    S.gazeX += (gx - S.gazeX) * ease(9)
    S.gazeY += (gy - S.gazeY) * ease(9)
    const widen = (looking ? 1.25 : pouncing ? 1.9 : 1) * (1 - 0.3 * fast)
    const ex = 0.37 * P.eyeSpread
    const ey = P.eyeY
    const er = 0.205 * P.eyeSize
    const iry = er * 0.74
    const lidProgress = S.lid
    const dir = S.lidDir

    const squint = fast * (asleep || happy ? 0 : 1)
    for (const e of eyes) {
      const pet = dir < 0
      const shut = lidProgress > 0.7
      const baseHEye = iry * mix(1, pet ? 0.7 : 0.3, smooth(0, 0.8, lidProgress))
      const hEye = shut ? baseHEye : baseHEye * (1 - 0.64 * squint)
      const eyc =
        ey +
        (dir * baseHEye * (pet ? 0.84 : 0.7) - iry) * smooth(0.35, 0.7, lidProgress) +
        (shut ? 0 : 0.015 * squint)
      const eyeTilt = e.s * (P.eyeTilt - (shut ? 0 : 0.22 * squint))
      e.iris.material = shut ? M.shut : e.s < 0 ? M.eyeL : M.eyeR
      fillPatch(e.iris, e.s * ex, eyc, er * (shut ? (pet ? 0.8 : 0.92) : 1 + 0.06 * squint), hEye, eyeTilt, 0.008)
      const prx = er * 0.3 * widen
      const dx = clamp(S.gazeX * er * 0.42, -(er * 0.9 - prx), er * 0.9 - prx)
      const room = hEye * Math.sqrt(Math.max(0, 1 - ((Math.abs(dx) + prx * 0.7) / er) ** 2))
      const pry = Math.min(er * 0.62, room * 0.72)
      const dy = clamp(-S.gazeY * iry * 0.34, -(room - pry), room - pry)
      fillPatch(e.pupil, e.s * ex + dx, eyc + dy, prx, pry, eyeTilt * 0.5, 0.013)
      e.pupil.visible = lidProgress < 0.45 && pry > 0.008
      e.lid.visible = shut
      if (shut) {
        fillPatch(
          e.lid,
          e.s * ex,
          eyc + dir * baseHEye * (pet ? 0.32 : 0.6),
          er * (pet ? 0.8 : 1.08),
          baseHEye,
          e.s * P.eyeTilt,
          0.018,
        )
      }
      const joy = pet ? smooth(0.5, 1, lidProgress) : 0
      e.blush.visible = joy > 0.02
      if (e.blush.visible) {
        fillPatch(e.blush, e.s * ex * 1.42, ey - er * 1.3, er * 0.46 * joy, er * 0.25 * joy, 0, 0.007)
      }
    }

    // paws
    for (const side of ['L', 'R'] as const) {
      const p = paws[side]
      const since = t - p.tapAt
      if (since < STRIKE) {
        const k = 1 - Math.pow(1 - Math.min(1, since / 60), 3)
        p.pos.lerpVectors(p.from, p.to, k)
        p.pos.y =
          since < RISE
            ? mix(p.from.y, Math.max(p.from.y, p.to.y + 0.7), since / RISE)
            : mix(Math.max(p.from.y, p.to.y + 0.7), p.to.y - 0.03, Math.pow((since - RISE) / FALL, 2))
      } else {
        if (!p.landed) land(p, t)
        if (p.held) {
          p.pos.x += (p.to.x - p.pos.x) * ease(30)
          p.pos.z += (p.to.z - p.pos.z) * ease(30)
          p.pos.y += (p.to.y - 0.04 - p.pos.y) * ease(30)
        } else if (side === mousePaw && mouseOn && since > STRIKE + 110) {
          p.mode = 'mouse'
          tmpGoal.copy(mouseGroup.position)
          tmpGoal.y = 0.3 - (S.mouseDown ? 0.05 : 0)
          tmpGoal.z += 0.02
          p.pos.lerp(tmpGoal, ease(16))
        } else if (licking && side === 'R' && since > STRIKE + 110) {
          p.mode = 'lick'
          head.getWorldPosition(tmpGoal)
          tmpGoal.x += 0.06
          tmpGoal.y += -0.5 * P.headSize - Math.sin(t / 140) * 0.06
          tmpGoal.z += 0.66 * P.headSize
          p.pos.lerp(tmpGoal, ease(12))
        } else if (swat && side === (S.pointer && S.pointer.x > 0 ? 'R' : 'L') && since > STRIKE + 110) {
          p.mode = 'swat'
          tmpGoal.set((side === 'L' ? -1 : 1) * 0.62, 1.25, 1.05)
          p.pos.lerp(tmpGoal, ease(26))
        } else if ((stretching || loaf > 0.05) && since > STRIKE + 110) {
          p.mode = 'rest'
          tmpGoal.copy(REST[side])
          if (stretching) {
            tmpGoal.z += 0.85
          } else {
            tmpGoal.x *= 1 - 0.35 * loaf
            tmpGoal.z += 0.14 * loaf
          }
          p.pos.lerp(tmpGoal, ease(8))
        } else if (since > STRIKE + 110) {
          p.mode = hover ? 'up' : 'rest'
          const goal = hover ? tmpGoal.copy(UP[side]) : REST[side]
          if (hover) goal.z += fwd * 0.6
          p.pos.lerp(goal, ease(hover ? 20 : 9))
          if (hover) p.pos.y += Math.sin(t / 240 + (side === 'L' ? 0 : 1.8)) * 0.004
        }
      }
      shoulderW.copy(SHOULDER[side])
      shoulderW.x += sx * shoulderW.y
      shoulderW.z += fwd * shoulderW.y
      shoulderW.y = shoulderW.y * (1 - fwd * fwd * 0.35) * squat + breath * 0.02 + bounce * 0.06
      drawLimb(p, shoulderW)
    }

    renderer.render(scene, camera)

    tongue.visible = licking && paws.R.mode === 'lick'
    if (tongue.visible) {
      const k = Math.sin(t / 140)
      tongue.position.y = -0.38 - 0.05 * k
      tongue.scale.set(0.06, 0.085 + 0.03 * k, 0.04)
    }
    mouth.visible = yawn > 0.04
    if (mouth.visible) fillPatch(mouth, 0, -0.29 - 0.05 * yawn, 0.03 + 0.085 * yawn, 0.01 + 0.14 * yawn, 0, 0.012)

    zzz.style.display = asleep ? 'block' : 'none'
    if (asleep) {
      head.getWorldPosition(proj)
      proj.x += 0.5
      proj.y += 0.5
      proj.project(camera)
      zzz.style.left = `${((proj.x + 1) / 2) * w}px`
      zzz.style.top = `${((1 - proj.y) / 2) * h}px`
    }

    speedHud.style.display = showSpeedBadge ? 'inline-flex' : 'none'
    if (showSpeedBadge && t - S.lastSpeedHud >= 220) {
      S.lastSpeedHud = t
      const cutoff = t - 5000
      while (S.keyTimes.length > 0 && S.keyTimes[0] < cutoff) S.keyTimes.shift()
      const kpm = Math.round((S.keyTimes.length / 5) * 60)
      speedHud.textContent = `${kpm} KPM · ${S.totalKeys} 键`
    }

    S.chips = S.chips.filter((c) => {
      const out = c.gone ? (t - c.gone) / 240 : 0
      if (out >= 1) {
        c.el.remove()
        return false
      }
      proj.set(c.k.x, 0.75, c.k.z).project(camera)
      c.el.style.left = `${((proj.x + 1) / 2) * w}px`
      c.el.style.top = `${((1 - proj.y) / 2) * h - out * 8}px`
      c.el.style.opacity = String(Math.min(1, (t - c.born) / 80) * (1 - out))
      return true
    })

    raf = requestAnimationFrame(frame)
  }

  // Stuck-key guard
  let shownKeys = new Set<string>()
  const activeButtons = new Set<string>()
  let buttonsAt = 0
  const HOLD_MAX = 1400
  const downAt = new Map<string, number>()

  const letGo = setInterval(() => {
    const t = performance.now()
    for (const [code, at] of downAt) {
      if (t - at > HOLD_MAX) {
        keyUpInternal(code)
        downAt.delete(code)
        shownKeys.delete(code)
      }
    }
    if (S.mouseDown && buttonsAt && t - buttonsAt > HOLD_MAX) {
      S.mouseDown = false
      activeButtons.clear()
      buttonsAt = 0
    }
  }, 200)

  function setOptions(o: TypingCatEngineOptions) {
    if ('showKeyboard' in o) board.visible = Boolean(o.showKeyboard)
    if ('showMouse' in o) mouseGroup.visible = Boolean(o.showMouse)
    if ('followKeys' in o) {
      followKeys = Boolean(o.followKeys)
      if (!followKeys) {
        ;[...S.down.keys()].forEach(keyUpInternal)
        shownKeys = new Set()
        downAt.clear()
      }
    }
    if ('showKeyChips' in o) {
      showKeyChips = Boolean(o.showKeyChips)
      if (!showKeyChips) {
        S.chips.forEach((c) => c.el.remove())
        S.chips = []
      }
    }
    if ('showOutline' in o) {
      showOutline = Boolean(o.showOutline)
      applyOutlineFilter()
    }
    if ('showSpeedBadge' in o) {
      showSpeedBadge = Boolean(o.showSpeedBadge)
      speedHud.style.display = showSpeedBadge ? 'inline-flex' : 'none'
    }
    if ('cameraYaw' in o) {
      cameraYawRad = (clamp(Number(o.cameraYaw) || 0, -30, 30) * Math.PI) / 180
    }
    if ('allowPetting' in o) allowPetting = Boolean(o.allowPetting)
    if ('turboTailTyping' in o) turboTailTyping = Boolean(o.turboTailTyping)
    if ('turboSensitivity' in o && o.turboSensitivity) turboSensitivity = o.turboSensitivity
    if ('idleActivity' in o && o.idleActivity) {
      idleActivity = o.idleActivity
      if (idleActivity === 'off' && !S.manualAct) S.act = null
    }
    if ('loafOnIdle' in o) {
      loafOnIdle = Boolean(o.loafOnIdle)
      if (!loafOnIdle) S.wantLoaf = false
    }
    if ('leftMouse' in o) setHanded(Boolean(o.leftMouse))
    if ('deskTheme' in o && o.deskTheme) applyDeskTheme(o.deskTheme)
    if ('accessories' in o && o.accessories) accessoriesRig.setAccessories(o.accessories)
    if ('coat' in o || 'colors' in o) {
      applyCoat(o.coat ?? currentCoat.id, 'colors' in o ? (o.colors ?? {}) : undefined)
    }
    if ('sleepMinutes' in o) {
      sleepAfterMs = o.sleepMinutes === 0 ? 0 : clamp(Number(o.sleepMinutes) || 5, 1, 120) * 60_000
    }
    if ('autoTyping' in o && o.autoTyping) {
      const prev = autoTyping
      autoTyping = o.autoTyping
      if (autoTyping === 'off') {
        releaseAutoKey()
      } else if (prev === 'off') {
        wake()
        autoNext = performance.now() + 260
      }
    }
    if ('shape' in o && o.shape) {
      setShape(o.shape)
    }
  }

  function setShape(nextShape: Partial<TypingCatShapeParams>) {
    for (const spec of TYPING_CAT_SHAPE_SPECS) {
      const val = nextShape[spec.key]
      P[spec.key] = typeof val === 'number' && Number.isFinite(val) ? clamp(val, spec.min, spec.max) : spec.defaultValue
    }
    applyShape()
  }

  // Initial setup
  applyDeskTheme(initialOptions.deskTheme)
  applyCoat(initialOptions.coat, initialOptions.colors)
  if (initialOptions.accessories) accessoriesRig.setAccessories(initialOptions.accessories)
  if (initialOptions.shape) setShape(initialOptions.shape)
  else applyShape()
  setOptions(initialOptions)
  raf = requestAnimationFrame(frame)

  return {
    coats: TYPING_CAT_COATS.map((c) => c.id),
    setInput(keySet, buttonSet) {
      const t = performance.now()
      lastManualInputAt = t
      for (const code of shownKeys) {
        if (!keySet.has(code)) {
          keyUpInternal(code)
          downAt.delete(code)
        }
      }
      for (const code of keySet) {
        if (!shownKeys.has(code)) {
          keyDownInternal(code, t)
          downAt.set(code, t)
        }
      }
      shownKeys = new Set(keySet)
      const prevDown = S.mouseDown
      const nextDown = buttonSet.size > 0
      if (nextDown !== prevDown) {
        wake(t)
        S.lastMouse = t
        S.mouseDown = nextDown
        buttonsAt = nextDown ? t : 0
      }
    },
    keyDown(code) {
      const t = performance.now()
      lastManualInputAt = t
      shownKeys.add(code)
      downAt.set(code, t)
      keyDownInternal(code, t)
    },
    keyUp(code) {
      shownKeys.delete(code)
      downAt.delete(code)
      keyUpInternal(code)
    },
    tapKey(code, durationMs = 130) {
      const t = performance.now()
      lastManualInputAt = t
      keyDownInternal(code, t)
      downAt.set(code, t)
      scheduleTimeout(() => {
        keyUpInternal(code)
        downAt.delete(code)
        shownKeys.delete(code)
      }, durationMs)
    },
    mouseDown(button = 'left') {
      const t = performance.now()
      lastManualInputAt = t
      activeButtons.add(button)
      wake(t)
      S.lastMouse = t
      S.mouseDown = true
      buttonsAt = t
    },
    mouseUp(button = 'left') {
      activeButtons.delete(button)
      if (activeButtons.size === 0) {
        S.mouseDown = false
        buttonsAt = 0
      }
    },
    mouseMoved(dx, dy) {
      const t = performance.now()
      lastManualInputAt = t
      wake(t)
      S.lastMouse = t
      const stepX = typeof dx === 'number' ? clamp(dx * 0.004, -0.09, 0.09) : rnd(-0.07, 0.07)
      const stepZ = typeof dy === 'number' ? clamp(dy * 0.004, -0.08, 0.08) : rnd(-0.06, 0.06)
      S.wigX = clamp(S.wigX + stepX, -0.16, 0.16)
      S.wigZ = clamp(S.wigZ + stepZ, -0.12, 0.12)
    },
    setOptions,
    setShape,
    pet(durationMs = 1500) {
      const t = performance.now()
      wake(t)
      S.petSide = Math.random() < 0.5 ? -1 : 1
      S.happyUntil = t + durationMs
    },
    spin() {
      wake()
      S.spinning = true
      S.spin = 0
    },
    sleep() {
      releaseAutoKey()
      S.sleepAt = performance.now() + 80
      S.lastKey = -1e9
      S.lastMouse = -1e9
    },
    wake() {
      wake()
    },
    stretch() {
      triggerIdleAction('stretch', 1700)
    },
    yawn() {
      triggerIdleAction('yawn', 1900)
    },
    lick() {
      triggerIdleAction('lick', 3200)
    },
    pounce() {
      triggerIdleAction('pounce', 1150)
    },
    loaf() {
      const t = performance.now()
      wake(t)
      S.act = null
      S.manualAct = false
      S.lastKey = -1e9
      S.lastMouse = -1e9
      S.wantLoaf = true
    },
    burst(durationMs = 3000) {
      const t = performance.now()
      wake(t)
      S.burstUntil = t + durationMs
      S.burstNext = t
      S.rate = Math.max(S.rate, 6.8)
      S.fast = Math.max(S.fast, 0.45)
    },
    clear() {
      S.burstUntil = 0
      if (S.burstHeld) {
        keyUpInternal(S.burstHeld)
        S.burstHeld = null
      }
      releaseAutoKey()
      ;[...S.down.keys()].forEach(keyUpInternal)
      shownKeys = new Set()
      downAt.clear()
      activeButtons.clear()
      buttonsAt = 0
      S.mouseDown = false
    },
    state() {
      const t = performance.now()
      if (isSleeping(t)) return 'sleeping'
      if (S.pet || t < S.happyUntil) return 'petting'
      if (t - S.lastKey < 3000) return 'typing'
      if (mouseGroup.visible && t - S.lastMouse < 2200) return 'mouse'
      return 'idle'
    },
    destroy() {
      dead = true
      clearInterval(letGo)
      timers.forEach((id) => clearTimeout(id))
      timers.clear()
      cancelAnimationFrame(raf)
      offs.forEach((f) => f())
      S.chips.forEach((c) => c.el.remove())
      S.chips = []
      zzz.remove()
      speedHud.remove()

      const disposedGeos = new Set<THREE.BufferGeometry>()
      const disposedMats = new Set<THREE.Material>()
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          if (obj.geometry && !disposedGeos.has(obj.geometry)) {
            disposedGeos.add(obj.geometry)
            obj.geometry.dispose()
          }
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
          for (const mat of mats) {
            if (mat && !disposedMats.has(mat)) {
              disposedMats.add(mat)
              mat.dispose()
            }
          }
        }
      })
      bodyTex.t.dispose()
      headTex.t.dispose()
      renderer.domElement.remove()
      renderer.dispose()
    },
  }
}
