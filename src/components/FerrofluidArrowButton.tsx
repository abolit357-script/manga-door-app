import { useEffect, useRef } from 'react'

type FerrofluidArrowButtonProps = {
  disabled?: boolean
  onClick: () => void
}

const STAGE_W = 104
const STAGE_H = 84
const BX = 52
const BY = 42
const BW = 64
const BH = 44
const BR = 22
const LOOP = 8
const WAKE = 14
const WAKE_STEP = 0.075
const WAKE_LIFE = 1.1
const WAKE_GAP = 2.5
const CLICK_LEN = 1.6

const VS = `#version 300 es
in vec2 a;
void main(){gl_Position=vec4(a,0.,1.);}`

const FS = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uDpr, uT, uLoop;
uniform vec4 uBtn;
uniform float uRad;
uniform vec3 uCur;
uniform vec3 uTr[14];
uniform vec4 uPulse;
uniform sampler2D uTex;
out vec4 o;
const float TAU = 6.2831853;
float sq(float x){ return x * x; }
float h21(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float sdBox(vec2 p, vec2 b, float r){
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.)) + min(max(q.x, q.y), 0.) - r;
}
float H(vec2 p){
  vec2 c = uBtn.xy, hb = uBtn.zw * .5;
  float d = sdBox(p - c, hb, uRad);
  float m = max(-d, 0.);
  float h = 5.2 * (1. - exp(-m / 5.5));
  float ph = TAU * uT / uLoop;
  float inner = smoothstep(1.2, 11., m);
  h += .35 * sin(p.x * .12 + ph) * sin(p.y * .14 - ph * 2.) * inner;
  vec2 b = p - uCur.xy;
  h += uCur.z * 5.2 * exp(-dot(b, b) / (2. * 13. * 13.)) * inner;
  for(int i = 0; i < 14; i++){
    vec3 w = uTr[i];
    if(w.z < 0.) continue;
    float r = length(p - w.xy), fr = r - 64. * w.z;
    h += 1.25 * exp(-w.z * 2.6) * exp(-fr * fr / (2. * 8. * 8.)) * cos(fr * .36) * inner;
  }
  vec2 k = p - uPulse.xy;
  float rc = length(k);
  h += uPulse.w * 10. * exp(-rc * rc / (2. * 15. * 15.)) * inner;
  float a = uPulse.z - .14;
  if(a > 0.){
    for(int j = 0; j < 3; j++){
      float aj = a - float(j) * .11;
      if(aj < 0.) break;
      float rr = 92. * aj;
      h += (3.1 - float(j) * .8) * exp(-aj * 1.6) * exp(-sq((rc - rr) / 14.)) * cos((rc - rr) * .32) * inner;
    }
  }
  return h;
}
vec3 env(vec3 r){
  float a = length(r.xy);
  float room = mix(.015, 1., pow(smoothstep(.35, 1., a), 1.6)) * (.6 + .4 * clamp(-r.y / max(a, 1e-3), -1., 1.));
  float sb = smoothstep(.05, 0., sdBox(r.xy - vec2(-.18, -.4), vec2(.3, .07), .05)) * 1.45;
  float st = smoothstep(.035, 0., sdBox(r.xy - vec2(.44, .06), vec2(.015, .22), .01)) * .85;
  return vec3(room + sb + st) * vec3(1., .95, .86);
}
void main(){
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  vec2 c = uBtn.xy, hb = uBtn.zw * .5;
  float d = sdBox(p - c, hb, uRad);
  float sd = sdBox(p - c - vec2(0., 6.), hb - vec2(2.), uRad - 2.);
  float shadowAlpha = clamp(.42 * exp(-max(sd, 0.) / 9.) + .28 * exp(-max(d, 0.) / 2.2), 0., 1.);
  vec3 shadowCol = vec3(.01, .01, .02);

  float liqAlpha = 0.;
  vec3 liqCol = vec3(0.);
  if(sdBox(p - c + vec2(0., 10.), hb + vec2(0., 10.), uRad) < 2.){
    float e = .45;
    float zh = 28., zl = 0.;
    bool hit = false;
    for(int i = 1; i <= 20; i++){
      float z = 28. * (1. - float(i) / 20.);
      vec2 qq = p + vec2(0., z * .65);
      if(H(qq) >= z){ zl = z; hit = true; break; }
      zh = z;
    }
    if(hit){
      for(int j = 0; j < 5; j++){
        float zm = .5 * (zh + zl);
        if(H(p + vec2(0., zm * .65)) >= zm) zl = zm; else zh = zm;
      }
    }
    vec2 q = p + vec2(0., zl * .65);
    float dq = sdBox(q - c, hb, uRad);
    float h0 = H(q), hx = H(q + vec2(e, 0.)), hy = H(q + vec2(0., e));
    vec3 n = normalize(vec3(-(hx - h0) / e, -(hy - h0) / e, 1.));
    vec3 r = reflect(vec3(0., 0., -1.), n);
    r.z = -r.z;
    float F = .06 + .94 * pow(1. - n.z, 4.);
    vec3 f = vec3(.014, .014, .018) + env(r) * mix(.34, 1., F);
    f *= .8 + .2 * smoothstep(0., 5.2, h0);
    vec3 L = normalize(vec3(-.35, -.6, .7));
    f += vec3(1., .94, .82) * pow(max(dot(reflect(-L, n), vec3(0., .42, .9)), 0.), 54.) * .95;
    vec4 tx = textureLod(uTex, (q + n.xy * 6.5) / vec2(${STAGE_W}.0, ${STAGE_H}.0), .15);
    float ta = tx.r * (1. - smoothstep(10., 22., h0 - 5.2));
    f = mix(f, vec3(.96, .94, .9), ta * .94);
    liqCol = f;
    liqAlpha = smoothstep(1., -1., dq);
  }

  float outA = max(shadowAlpha, liqAlpha);
  vec3 outC = mix(shadowCol, liqCol, liqAlpha);
  outC += (h21(p + fract(uT * 7.)) - .5) / 255. * outA;
  o = vec4(outC * outA, outA);
}`

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const eOut = (u: number) => 1 - Math.pow(1 - clamp(u), 5)
const eIO = (u: number) => {
  const c = clamp(u)
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2
}

const inPill = (x: number, y: number) => {
  const dx = Math.max(Math.abs(x - BX) - (BW / 2 - BR), 0)
  const dy = Math.max(Math.abs(y - BY) - (BH / 2 - BR), 0)
  return Math.hypot(dx, dy) <= BR + 8
}

function compileShader(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)
  if (!s) throw new Error('createShader failed')
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(s) || 'shader compile error')
  }
  return s
}

function createArrowTexture(gl: WebGL2RenderingContext) {
  const scale = 2
  const c = document.createElement('canvas')
  c.width = STAGE_W * scale
  c.height = STAGE_H * scale
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('no 2d context')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.scale(scale, scale)
  ctx.strokeStyle = '#f00'
  ctx.lineWidth = 2.4
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  // Clean left arrow centered at (BX, BY)
  ctx.beginPath()
  ctx.moveTo(BX + 9, BY)
  ctx.lineTo(BX - 9, BY)
  ctx.moveTo(BX - 2, BY - 7)
  ctx.lineTo(BX - 9, BY)
  ctx.lineTo(BX - 2, BY + 7)
  ctx.stroke()

  const tex = gl.createTexture()
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c)
  gl.generateMipmap(gl.TEXTURE_2D)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  return tex
}

export default function FerrofluidArrowButton({
  disabled = false,
  onClick,
}: FerrofluidArrowButtonProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const onClickRef = useRef(onClick)
  onClickRef.current = onClick

  useEffect(() => {
    const cv = canvasRef.current
    const st = stageRef.current
    const bt = buttonRef.current
    if (!cv || !st || !bt) return

    const gl = cv.getContext('webgl2', { alpha: true, antialias: false })
    if (!gl) return

    let disposed = false
    let raf = 0
    let pendingTimer: number | null = null

    const DPR = Math.min(2, window.devicePixelRatio || 1)
    cv.width = Math.round(STAGE_W * DPR)
    cv.height = Math.round(STAGE_H * DPR)

    const vs = compileShader(gl, gl.VERTEX_SHADER, VS)
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FS)
    const pr = gl.createProgram()!
    gl.attachShader(pr, vs)
    gl.attachShader(pr, fs)
    gl.linkProgram(pr)
    gl.useProgram(pr)

    const vb = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vb)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const al = gl.getAttribLocation(pr, 'a')
    gl.enableVertexAttribArray(al)
    gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0)

    const uRes = gl.getUniformLocation(pr, 'uRes')
    const uDpr = gl.getUniformLocation(pr, 'uDpr')
    const uT = gl.getUniformLocation(pr, 'uT')
    const uLoop = gl.getUniformLocation(pr, 'uLoop')
    const uBtn = gl.getUniformLocation(pr, 'uBtn')
    const uRad = gl.getUniformLocation(pr, 'uRad')
    const uCur = gl.getUniformLocation(pr, 'uCur')
    const uTr = gl.getUniformLocation(pr, 'uTr')
    const uPulse = gl.getUniformLocation(pr, 'uPulse')
    const uTex = gl.getUniformLocation(pr, 'uTex')
    const tex = createArrowTexture(gl)

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let lp = { x: BX, y: BY }
    let ls = { x: BX, y: BY }
    let lhv = 0
    let clickT: number | null = null
    let cpos = { x: BX, y: BY }
    const trail: { x: number; y: number; t: number }[] = []
    let lastTr = 0
    let lastNow: number | null = null
    const t0 = performance.now() / 1000

    const drawFrame = (now: number) => {
      const t = ((now - t0) % LOOP + LOOP) % LOOP
      const dt = lastNow === null ? 1 / 60 : clamp(now - lastNow, 0, 0.05)
      const over = inPill(lp.x, lp.y)
      lhv += ((over ? 1 : 0) - lhv) * (1 - Math.exp(-dt * 6))
      ls.x += (lp.x - ls.x) * (1 - Math.exp(-dt * 7))
      ls.y += (lp.y - ls.y) * (1 - Math.exp(-dt * 7))

      const a = clickT === null ? -1 : now - clickT
      if (a > CLICK_LEN) clickT = null
      const glob =
        a < 0 || a > CLICK_LEN
          ? 0
          : a < 0.14
            ? eOut(a / 0.14)
            : 1 - eIO((a - 0.14) / 0.45)

      if (now - lastTr > WAKE_STEP) {
        lastTr = now
        if (over && (!trail.length || Math.hypot(lp.x - trail[0].x, lp.y - trail[0].y) > WAKE_GAP)) {
          trail.unshift({ x: lp.x, y: lp.y, t: now })
        }
        if (trail.length > WAKE) trail.pop()
      }

      const tr = new Float32Array(WAKE * 3).fill(-1)
      trail.forEach((q, k) => {
        tr[k * 3] = q.x
        tr[k * 3 + 1] = q.y
        tr[k * 3 + 2] = now - q.t < WAKE_LIFE ? now - q.t : -1
      })

      gl.viewport(0, 0, cv.width, cv.height)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.uniform2f(uRes, cv.width, cv.height)
      gl.uniform1f(uDpr, DPR)
      gl.uniform1f(uT, t)
      gl.uniform1f(uLoop, LOOP)
      gl.uniform4f(uBtn, BX, BY, BW, BH)
      gl.uniform1f(uRad, BR)
      gl.uniform3f(uCur, ls.x, ls.y, lhv * (1 - glob))
      gl.uniform3fv(uTr, tr)
      gl.uniform4f(uPulse, cpos.x, cpos.y, a, glob)
      gl.uniform1i(uTex, 0)
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      lastNow = now
    }

    const loop = () => {
      if (disposed) return
      drawFrame(performance.now() / 1000)
      raf = requestAnimationFrame(loop)
    }

    const toStage = (e: PointerEvent) => {
      const r = st.getBoundingClientRect()
      return {
        x: ((e.clientX - r.left) * STAGE_W) / Math.max(r.width, 1),
        y: ((e.clientY - r.top) * STAGE_H) / Math.max(r.height, 1),
      }
    }

    const onMove = (e: PointerEvent) => {
      lp = toStage(e)
      if (reduce && !raf) raf = requestAnimationFrame(loop)
    }

    const onButtonClick = (e: MouseEvent) => {
      clickT = performance.now() / 1000
      cpos = e.detail === 0 ? { x: BX, y: BY } : { ...lp }
      if (reduce) {
        onClickRef.current()
        return
      }
      if (!raf) raf = requestAnimationFrame(loop)
      if (pendingTimer !== null) window.clearTimeout(pendingTimer)
      // Brief pause so the ferrofluid click surge & ripple burst visibly fire before returning
      pendingTimer = window.setTimeout(() => {
        pendingTimer = null
        if (!disposed) onClickRef.current()
      }, 280)
    }

    window.addEventListener('pointermove', onMove)
    bt.addEventListener('click', onButtonClick)

    if (reduce) {
      drawFrame(t0)
    } else {
      raf = requestAnimationFrame(loop)
    }

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      if (pendingTimer !== null) window.clearTimeout(pendingTimer)
      window.removeEventListener('pointermove', onMove)
      bt.removeEventListener('click', onButtonClick)
      gl.deleteTexture(tex)
      gl.deleteBuffer(vb)
      gl.deleteProgram(pr)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
    }
  }, [])

  return (
    <div ref={stageRef} className="ferro-arrow-stage">
      <canvas ref={canvasRef} className="ferro-arrow-gl" aria-hidden="true" />
      <button
        ref={buttonRef}
        type="button"
        className="ferro-arrow-btn"
        disabled={disabled}
        aria-label="Retour à la porte"
        title="Retour à la porte"
      >
        ←
      </button>
    </div>
  )
}
