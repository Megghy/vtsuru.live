<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    fragmentCode: string
    speed?: number
    intensity?: number
    color1?: string
    color2?: string
    params?: [number, number, number, number]
    paused?: boolean
  }>(),
  {
    speed: 1,
    intensity: 0.8,
    color1: '#38bdf8',
    color2: '#c084fc',
    params: () => [0.5, 0.5, 0.5, 0.5],
    paused: false,
  },
)

const emit = defineEmits<{
  compileError: [message: string | null]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const compileErrorMsg = ref<string | null>(null)

const VERTEX_SHADER_SRC = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`

function buildFragmentSource(userCode: string): string {
  const trimmed = userCode.trim()
  const hasMain = /\bvoid\s+main\s*\(/.test(trimmed)
  const header = `precision highp float;
uniform float iTime;
uniform vec2 iResolution;
uniform vec4 iMouse;
uniform float uSpeed;
uniform float uIntensity;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform float uParam1;
uniform float uParam2;
uniform float uParam3;
uniform float uParam4;
`
  if (hasMain) {
    return `${header}\n${trimmed}\n`
  }
  return `${header}
${trimmed}

void main() {
  vec4 outCol = vec4(0.0);
  mainImage(outCol, gl_FragCoord.xy);
  gl_FragColor = outCol;
}
`
}

function hexToRgbVec3(hex: string): [number, number, number] {
  const clean = hex.trim().replace(/^#/, '')
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) / 255
    const g = parseInt(clean[1] + clean[1], 16) / 255
    const b = parseInt(clean[2] + clean[2], 16) / 255
    return [Number.isFinite(r) ? r : 1, Number.isFinite(g) ? g : 1, Number.isFinite(b) ? b : 1]
  }
  if (clean.length >= 6) {
    const r = parseInt(clean.slice(0, 2), 16) / 255
    const g = parseInt(clean.slice(2, 4), 16) / 255
    const b = parseInt(clean.slice(4, 6), 16) / 255
    return [Number.isFinite(r) ? r : 1, Number.isFinite(g) ? g : 1, Number.isFinite(b) ? b : 1]
  }
  return [1, 1, 1]
}

let gl: WebGLRenderingContext | null = null
let program: WebGLProgram | null = null
let quadBuffer: WebGLBuffer | null = null
let rafId = 0
let resizeObserver: ResizeObserver | null = null
let startTime = performance.now()
let uniforms: Record<string, WebGLUniformLocation | null> = {}

function compileShader(ctx: WebGLRenderingContext, type: number, source: string): { shader: WebGLShader | null; error?: string } {
  const shader = ctx.createShader(type)
  if (!shader) return { shader: null, error: '无法创建 WebGL Shader 对象' }
  ctx.shaderSource(shader, source)
  ctx.compileShader(shader)
  if (!ctx.getShaderParameter(shader, ctx.COMPILE_STATUS)) {
    const log = ctx.getShaderInfoLog(shader) || '着色器编译失败'
    ctx.deleteShader(shader)
    return { shader: null, error: log }
  }
  return { shader }
}

function rebuildProgram() {
  if (!gl) return
  if (program) {
    gl.deleteProgram(program)
    program = null
  }
  uniforms = {}

  const vsRes = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC)
  if (!vsRes.shader) {
    compileErrorMsg.value = vsRes.error || '顶点着色器编译失败'
    emit('compileError', compileErrorMsg.value)
    return
  }
  const fsRes = compileShader(gl, gl.FRAGMENT_SHADER, buildFragmentSource(props.fragmentCode))
  if (!fsRes.shader) {
    gl.deleteShader(vsRes.shader)
    compileErrorMsg.value = fsRes.error || '片元着色器编译失败'
    emit('compileError', compileErrorMsg.value)
    return
  }

  const prog = gl.createProgram()
  if (!prog) {
    gl.deleteShader(vsRes.shader)
    gl.deleteShader(fsRes.shader)
    return
  }
  gl.attachShader(prog, vsRes.shader)
  gl.attachShader(prog, fsRes.shader)
  gl.linkProgram(prog)
  gl.deleteShader(vsRes.shader)
  gl.deleteShader(fsRes.shader)

  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog) || '着色器程序链接失败'
    gl.deleteProgram(prog)
    compileErrorMsg.value = log
    emit('compileError', compileErrorMsg.value)
    return
  }

  program = prog
  gl.useProgram(program)
  const posLoc = gl.getAttribLocation(program, 'aPos')
  if (quadBuffer && posLoc >= 0) {
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)
  }

  const names = ['iTime', 'iResolution', 'iMouse', 'uSpeed', 'uIntensity', 'uColor1', 'uColor2', 'uParam1', 'uParam2', 'uParam3', 'uParam4']
  for (const name of names) {
    uniforms[name] = gl.getUniformLocation(program, name)
  }

  compileErrorMsg.value = null
  emit('compileError', null)
}

function syncCanvasSize() {
  const canvas = canvasRef.value
  if (!canvas || !gl) return
  const rect = canvas.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = Math.max(2, Math.round(rect.width * dpr))
  const h = Math.max(2, Math.round(rect.height * dpr))
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  gl.viewport(0, 0, w, h)
}

function renderFrame(now: number) {
  if (!gl || !program || !canvasRef.value) return
  if (!props.paused) {
    const elapsed = (now - startTime) / 1000
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(program)

    const c1 = hexToRgbVec3(props.color1)
    const c2 = hexToRgbVec3(props.color2)
    const p = props.params

    if (uniforms.iTime) gl.uniform1f(uniforms.iTime, elapsed)
    if (uniforms.iResolution) gl.uniform2f(uniforms.iResolution, canvasRef.value.width, canvasRef.value.height)
    if (uniforms.iMouse) gl.uniform4f(uniforms.iMouse, 0, 0, 0, 0)
    if (uniforms.uSpeed) gl.uniform1f(uniforms.uSpeed, props.speed)
    if (uniforms.uIntensity) gl.uniform1f(uniforms.uIntensity, props.intensity)
    if (uniforms.uColor1) gl.uniform3f(uniforms.uColor1, c1[0], c1[1], c1[2])
    if (uniforms.uColor2) gl.uniform3f(uniforms.uColor2, c2[0], c2[1], c2[2])
    if (uniforms.uParam1) gl.uniform1f(uniforms.uParam1, p[0] ?? 0.5)
    if (uniforms.uParam2) gl.uniform1f(uniforms.uParam2, p[1] ?? 0.5)
    if (uniforms.uParam3) gl.uniform1f(uniforms.uParam3, p[2] ?? 0.5)
    if (uniforms.uParam4) gl.uniform1f(uniforms.uParam4, p[3] ?? 0.5)

    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }
  rafId = requestAnimationFrame(renderFrame)
}

function initWebGl() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: false,
    antialias: false,
    preserveDrawingBuffer: false,
  })
  if (!ctx) {
    compileErrorMsg.value = '当前浏览器环境不支持 WebGL'
    emit('compileError', compileErrorMsg.value)
    return
  }
  gl = ctx
  quadBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)
  syncCanvasSize()
  rebuildProgram()
  startTime = performance.now()
  rafId = requestAnimationFrame(renderFrame)
}

watch(
  () => props.fragmentCode,
  () => {
    rebuildProgram()
  },
)

onMounted(() => {
  initWebGl()
  if (canvasRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => syncCanvasSize())
    resizeObserver.observe(canvasRef.value)
  }
})

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId)
  resizeObserver?.disconnect()
  resizeObserver = null
  if (gl) {
    if (program) gl.deleteProgram(program)
    if (quadBuffer) gl.deleteBuffer(quadBuffer)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    gl = null
  }
  program = null
  quadBuffer = null
})
</script>

<template>
  <div class="relative w-full h-full pointer-events-none">
    <canvas ref="canvasRef" class="block w-full h-full" />
    <div
      v-if="compileErrorMsg"
      class="absolute inset-2 rounded bg-destructive/85 text-destructive-foreground p-2 text-xs font-mono overflow-auto whitespace-pre-wrap"
    >
      Shader 编译错误: {{ compileErrorMsg }}
    </div>
  </div>
</template>
