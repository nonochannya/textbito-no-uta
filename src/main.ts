const textCanvas = document.getElementById('text-canvas') as HTMLCanvasElement
const ctx = textCanvas.getContext('2d')!

const video = document.getElementById('video') as HTMLVideoElement
const frameCanvas = document.getElementById('frame-canvas') as HTMLCanvasElement
const frameCtx = frameCanvas.getContext('2d', { willReadFrequently: true })!

const overlay = document.getElementById('overlay') as HTMLDivElement
const playBtn = document.getElementById('play-btn') as HTMLButtonElement

const GRID_W = 96
const GRID_H = 54
const N = GRID_W * GRID_H

export const config = {
  algorithm: 'fluid' as 'fluid' | 'swarm',
  fluid: {
    force: 12.0,
    radius: 20,
    spring: 0.22,
    damping: 0.65,
    drift: 8
  },
  swarm: {
    spring: 0.85,
    damping: 0.40,
    colorBlend: 0.45,
    minParticles: 800,
  },
  baseSpeed: 0.8,
  fontSize: 28,
  fontFamily: '"Yu Gothic", "Meiryo", "MS Gothic", sans-serif'
}

export let activeFont = `bold ${config.fontSize}px ${config.fontFamily}`

let charPool = '読込中...'.split('')
let isNovelLoaded = false

fetch('/novel.txt')
  .then(res => res.text())
  .then(text => {
    if (text && text.trim().length > 0) {
      charPool = text.split('')
      isNovelLoaded = true
      console.log(`Loaded novel.txt (${charPool.length} characters)`)
    }
  })
  .catch(console.error)

const pX = new Float32Array(N)
const pY = new Float32Array(N)
const pVX = new Float32Array(N)
const pVY = new Float32Array(N)
const pR = new Float32Array(N)
const pG = new Float32Array(N)
const pB = new Float32Array(N)
const pAlpha = new Float32Array(N)

const originX = new Float32Array(N)
const originY = new Float32Array(N)
const textOffset = new Int32Array(N)

const pActive = new Uint8Array(N)
const pKey = new Int32Array(N)
const pTargetX = new Float32Array(N)
const pTargetY = new Float32Array(N)
const pTargetR = new Float32Array(N)
const pTargetG = new Float32Array(N)
const pTargetB = new Float32Array(N)

const jitterX = new Float32Array(N)
const jitterY = new Float32Array(N)

const tX = new Float32Array(N)
const tY = new Float32Array(N)
const tR = new Float32Array(N)
const tG = new Float32Array(N)
const tB = new Float32Array(N)
const tKey = new Int32Array(N)

const availKeysBuffer = new Float64Array(N)
const targetKeysBuffer = new Float64Array(N)

let globalTextOffset = 0
let canvasW = 0
let canvasH = 0
let animId = 0
let cellW = 0
let cellH = 0

let fluidSmoothedThresh = 40
let swarmSmoothedThresh = 18

function initCanvas() {
  const winW = window.innerWidth
  const winH = window.innerHeight
  const videoRatio = 16 / 9

  if (winW / winH > videoRatio) {
    canvasH = winH
    canvasW = winH * videoRatio
  } else {
    canvasW = winW
    canvasH = winW / videoRatio
  }

  textCanvas.width = canvasW
  textCanvas.height = canvasH
  frameCanvas.width = GRID_W
  frameCanvas.height = GRID_H

  cellW = canvasW / GRID_W
  cellH = canvasH / GRID_H

  let cellIdx = 0
  for (let row = 0; row < GRID_H; row++) {
    for (let col = 0; col < GRID_W; col++) {

      const jX = (Math.random() - 0.5) * cellW * 0.05
      const jY = (Math.random() - 0.5) * cellH * 0.05

      const ox = (col + 0.5) * cellW + jX
      const oy = (row + 0.5) * cellH + jY

      originX[cellIdx] = ox
      originY[cellIdx] = oy
      textOffset[cellIdx] = cellIdx

      pTargetX[cellIdx] = ox
      pTargetY[cellIdx] = oy
      pTargetR[cellIdx] = Math.random() * 255
      pTargetG[cellIdx] = Math.random() * 255
      pTargetB[cellIdx] = Math.random() * 255
      jitterX[cellIdx] = jX
      jitterY[cellIdx] = jY
      pKey[cellIdx] = 0
      pActive[cellIdx] = 0

      pX[cellIdx] = ox
      pY[cellIdx] = oy
      pVX[cellIdx] = 0
      pVY[cellIdx] = 0
      pR[cellIdx] = pTargetR[cellIdx]
      pG[cellIdx] = pTargetG[cellIdx]
      pB[cellIdx] = pTargetB[cellIdx]

      cellIdx++
    }
  }
}

function bindSettings() {
  const btnFluid = document.getElementById('algo-fluid')!
  const btnSwarm = document.getElementById('algo-swarm')!
  const ctrlFluid = document.getElementById('controls-fluid')!
  const ctrlSwarm = document.getElementById('controls-swarm')!

  const switchToFluid = () => {
    config.algorithm = 'fluid'
    btnFluid.classList.add('active')
    btnSwarm.classList.remove('active')
    ctrlFluid.classList.remove('hide')
    ctrlSwarm.classList.add('hide')
  }

  const switchToSwarm = () => {
    config.algorithm = 'swarm'
    btnSwarm.classList.add('active')
    btnFluid.classList.remove('active')
    ctrlSwarm.classList.remove('hide')
    ctrlFluid.classList.add('hide')

    for (let i = 0; i < N; i++) {
      pActive[i] = 1;
      pKey[i] = 0;
    }
  }

  btnFluid.addEventListener('click', switchToFluid)
  btnSwarm.addEventListener('click', switchToSwarm)

  const bindSlider = (id: string, obj: any, key: string, callback?: (v: number) => void) => {
    const el = document.getElementById(id) as HTMLInputElement
    if (!el) return;
    const valEl = document.getElementById(id + '-val')!
    el.addEventListener('input', () => {
      obj[key] = parseFloat(el.value)
      valEl.textContent = Number(el.value).toFixed(2)
      if(callback) callback(obj[key])
    })
  }

  const fontFamilyInput = document.getElementById('global-font-family') as HTMLInputElement;
  if (fontFamilyInput) {
    fontFamilyInput.addEventListener('input', () => {
      config.fontFamily = fontFamilyInput.value;
      activeFont = `bold ${config.fontSize}px ${config.fontFamily}`;
    });
  }

  bindSlider('global-font', config, 'fontSize', (v) => {
    activeFont = `bold ${v}px ${config.fontFamily}`
  })
  bindSlider('global-speed', config, 'baseSpeed')

  bindSlider('fluid-force', config.fluid, 'force')
  bindSlider('fluid-radius', config.fluid, 'radius')
  bindSlider('fluid-spring', config.fluid, 'spring')
  bindSlider('fluid-damping', config.fluid, 'damping')
  bindSlider('fluid-drift', config.fluid, 'drift')

  bindSlider('swarm-spring', config.swarm, 'spring')
  bindSlider('swarm-damping', config.swarm, 'damping')
  bindSlider('swarm-color', config.swarm, 'colorBlend')
  bindSlider('swarm-min', config.swarm, 'minParticles')

  const langJA = document.getElementById('lang-ja')!
  const langEN = document.getElementById('lang-en')!
  const langAR = document.getElementById('lang-ar')!

  const loadLanguage = (langCode: string, btn: HTMLElement, fontFam: string) => {
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    
    config.fontFamily = fontFam
    activeFont = `bold ${config.fontSize}px ${config.fontFamily}`
    
    const fontFamilyInput = document.getElementById('global-font-family') as HTMLInputElement;
    if (fontFamilyInput) fontFamilyInput.value = fontFam;
    
    let file = '/novel.txt'
    if (langCode === 'en') file = '/novel-en.txt'
    if (langCode === 'ar') file = '/novel-ar.txt'
    
    charPool = '読込中...'.split('')
    isNovelLoaded = false
    globalTextOffset = 0
    
    fetch(file)
      .then(res => res.text())
      .then(text => {
        if (text && text.trim().length > 0) {
          charPool = text.split('')
          isNovelLoaded = true
        }
      })
  }

  langJA.addEventListener('click', () => loadLanguage('ja', langJA, '"Yu Gothic", "Meiryo", "MS Gothic", sans-serif'))
  langEN.addEventListener('click', () => loadLanguage('en', langEN, '"Cinzel", serif'))
  langAR.addEventListener('click', () => loadLanguage('ar', langAR, 'Arial, sans-serif'))

  const bottomZone = document.getElementById('bottom-hover-zone')!
  bottomZone.addEventListener('click', () => {
    document.body.classList.toggle('show-settings')
  })
}
bindSettings()

window.addEventListener('resize', initCanvas)

let lastVideoTime = -1

function renderFrame() {
  animId = requestAnimationFrame(renderFrame)

  if (video.ended) return
  if (video.paused && video.currentTime === lastVideoTime) return
  lastVideoTime = video.currentTime

  frameCtx.drawImage(video, 0, 0, GRID_W, GRID_H)
  const { data } = frameCtx.getImageData(0, 0, GRID_W, GRID_H)

  if (config.algorithm === 'fluid') {
    renderFluidFrame(data)
  } else {
    renderSwarmFrame(data)
  }

  if (isNovelLoaded && video.duration > 0) {
    const pct = Math.max(0, Math.min(1, video.currentTime / video.duration));
    const maxScroll = Math.max(0, charPool.length - N);
    globalTextOffset = pct * maxScroll;
  } else {
    globalTextOffset = (globalTextOffset + config.baseSpeed) % charPool.length
  }
}

function renderFluidFrame(data: Uint8ClampedArray) {
  ctx.fillStyle = '#06050a'
  ctx.fillRect(0, 0, canvasW, canvasH)

  const hist = new Uint16Array(256)
  for (let i = 0; i < N * 4; i += 4) {
    const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
    hist[lum]++
  }

  let cum = 0, rawThresh = 0
  const targetPixels = Math.floor(N * 0.94)
  for (let l = 255; l >= 0; l--) {
    cum += hist[l]
    if (cum >= targetPixels) { rawThresh = l; break }
  }
  rawThresh = Math.max(rawThresh, 8)
  fluidSmoothedThresh = fluidSmoothedThresh * 0.85 + rawThresh * 0.15
  const THRESH = Math.floor(fluidSmoothedThresh)

  for (let i = 0; i < N; i++) {
    const currCol = Math.max(0, Math.min(GRID_W - 1, Math.floor(pX[i] / cellW)))
    const currRow = Math.max(0, Math.min(GRID_H - 1, Math.floor(pY[i] / cellH)))
    const di = (currRow * GRID_W + currCol) * 4

    const r = data[di], g = data[di + 1], b = data[di + 2]
    const lum = 0.299 * r + 0.587 * g + 0.114 * b

    if (lum < THRESH) {
      let scanDist = 1
      let gradX = 0, gradY = 0

      while (scanDist <= config.fluid.radius && Math.abs(gradX) < 10 && Math.abs(gradY) < 10) {
        const cL = Math.max(0, currCol - scanDist)
        const cR = Math.min(GRID_W - 1, currCol + scanDist)
        const cU = Math.max(0, currRow - scanDist)
        const cD = Math.min(GRID_H - 1, currRow + scanDist)

        const idxL = (currRow * GRID_W + cL) * 4
        const idxR = (currRow * GRID_W + cR) * 4
        const idxU = (cU * GRID_W + currCol) * 4
        const idxD = (cD * GRID_W + currCol) * 4

        const lumL = 0.299 * data[idxL] + 0.587 * data[idxL + 1] + 0.114 * data[idxL + 2]
        const lumR = 0.299 * data[idxR] + 0.587 * data[idxR + 1] + 0.114 * data[idxR + 2]
        const lumU = 0.299 * data[idxU] + 0.587 * data[idxU + 1] + 0.114 * data[idxU + 2]
        const lumD = 0.299 * data[idxD] + 0.587 * data[idxD + 1] + 0.114 * data[idxD + 2]

        gradX = lumR - lumL
        gradY = lumD - lumU
        scanDist += 2
      }

      if (Math.abs(gradX) < 10 && Math.abs(gradY) < 10) {

        gradX = (Math.random() - 0.5) * config.fluid.drift
        gradY = (Math.random() - 0.5) * config.fluid.drift
      }

      const len = Math.sqrt(gradX * gradX + gradY * gradY)
      pVX[i] += (gradX / len) * config.fluid.force
      pVY[i] += (gradY / len) * config.fluid.force
    }

    pVX[i] += (originX[i] - pX[i]) * config.fluid.spring
    pVY[i] += (originY[i] - pY[i]) * config.fluid.spring

    pVX[i] *= config.fluid.damping
    pVY[i] *= config.fluid.damping

    pX[i] += pVX[i]
    pY[i] += pVY[i]
  }

  ctx.font = activeFont
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'

  for (let i = 0; i < N; i++) {
    const currCol = Math.max(0, Math.min(GRID_W - 1, Math.floor(pX[i] / cellW)))
    const currRow = Math.max(0, Math.min(GRID_H - 1, Math.floor(pY[i] / cellH)))
    const di = (currRow * GRID_W + currCol) * 4

    const sr = data[di], sg = data[di + 1], sb = data[di + 2]
    const lum = 0.299 * sr + 0.587 * sg + 0.114 * sb
    const targetAlpha = Math.max(0, Math.min(1, (lum - THRESH + 15) / 25))

    pAlpha[i] += (targetAlpha - pAlpha[i]) * 0.15

    if (pAlpha[i] > 0.02) {
      const alpha = pAlpha[i]
      const cr = Math.min(255, sr + (sr - lum) * 1.5)
      const cg = Math.min(255, sg + (sg - lum) * 1.5)
      const cb = Math.min(255, sb + (sb - lum) * 1.5)

      const charIndex = (Math.floor(globalTextOffset) + textOffset[i]) % charPool.length
      const char = charPool[charIndex] || ' '

      ctx.globalAlpha = alpha

      ctx.fillStyle = "rgb(" + Math.round(cr) + "," + Math.round(cg) + "," + Math.round(cb) + ")"

      ctx.fillText(char, Math.round(pX[i]), Math.round(pY[i]))
    }
  }
}

const colorGroups = new Map<number, { r: number; g: number; b: number; count: number; pixels: number[] }>()

function assignTarget(p: number, t: number) {
  pTargetX[p] = tX[t] + jitterX[p]
  pTargetY[p] = tY[t] + jitterY[p]
  pTargetR[p] = tR[t]
  pTargetG[p] = tG[t]
  pTargetB[p] = tB[t]
}

function renderSwarmFrame(data: Uint8ClampedArray) {
  ctx.fillStyle = 'rgba(12, 10, 20, 0.45)'
  ctx.fillRect(0, 0, canvasW, canvasH)

  const hist = new Uint16Array(256)
  for (let i = 0; i < N * 4; i += 4) {
    const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
    hist[lum]++
  }

  let cum = 0, rawThresh = 0
  const targetPixels = Math.floor(N * 0.94)
  for (let l = 255; l >= 0; l--) {
    cum += hist[l]
    if (cum >= targetPixels) { rawThresh = l; break }
  }
  rawThresh = Math.max(rawThresh, 8)

  swarmSmoothedThresh = swarmSmoothedThresh * 0.82 + rawThresh * 0.18
  let adaptThresh = Math.floor(swarmSmoothedThresh)

  let minCum = 0, minThresh = 255
  for (let l = 255; l >= 0; l--) {
    minCum += hist[l]
    if (minCum >= config.swarm.minParticles) { minThresh = l; break }
  }
  if (adaptThresh > minThresh) {
    adaptThresh = minThresh
    swarmSmoothedThresh = adaptThresh
  }

  colorGroups.clear()
  for (let i = 0; i < N; i++) {
    const di = i * 4
    const r = data[di], g = data[di + 1], b = data[di + 2]
    const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
    if (lum < adaptThresh) continue

    const qr = (r >> 5) << 5, qg = (g >> 5) << 5, qb = (b >> 5) << 5
    const key = (qr << 16) | (qg << 8) | qb

    let group = colorGroups.get(key)
    if (!group) {
      group = { r: 0, g: 0, b: 0, count: 0, pixels: [] }
      colorGroups.set(key, group)
    }
    group.r += r; group.g += g; group.b += b
    group.count++
    group.pixels.push(i)
  }

  let targetCount = 0
  const targetsLeft = new Map<number, number[]>()

  for (const [key, group] of colorGroups) {
    if (group.count === 0) continue
    const tArr: number[] = []
    targetsLeft.set(key, tArr)

    for (let j = 0; j < group.count; j++) {
      const pxIdx = group.pixels[j]
      const col = pxIdx % GRID_W
      const row = Math.floor(pxIdx / GRID_W)
      const di = pxIdx * 4

      tX[targetCount] = (col + 0.5) * cellW
      tY[targetCount] = (row + 0.5) * cellH
      tR[targetCount] = data[di]
      tG[targetCount] = data[di + 1]
      tB[targetCount] = data[di + 2]
      tKey[targetCount] = key

      tArr.push(targetCount)
      targetCount++
    }
  }

  const particlesLeft = new Map<number, number[]>()
  const idleParticles: number[] = []

  for (let p = 0; p < N; p++) {
    if (!pActive[p]) idleParticles.push(p)
    else {
      const key = pKey[p]
      let arr = particlesLeft.get(key)
      if (!arr) { arr = []; particlesLeft.set(key, arr) }
      arr.push(p)
    }
  }

  const leftoverP: number[] = []
  const leftoverT: number[] = []

  for (const [key, pArr] of particlesLeft) {
    const tArr = targetsLeft.get(key)
    if (tArr && tArr.length > 0) {
      const matches = Math.min(pArr.length, tArr.length)
      for (let i = 0; i < matches; i++) assignTarget(pArr[i], tArr[i])
      for (let i = matches; i < pArr.length; i++) leftoverP.push(pArr[i])
      for (let i = matches; i < tArr.length; i++) leftoverT.push(tArr[i])
      targetsLeft.delete(key)
    } else {
      for (let i = 0; i < pArr.length; i++) leftoverP.push(pArr[i])
    }
  }

  for (const tArr of targetsLeft.values()) leftoverT.push(...tArr)

  const allAvailable = leftoverP.concat(idleParticles)

  const availKeys = availKeysBuffer.subarray(0, allAvailable.length)
  for (let i = 0; i < allAvailable.length; i++) {
    const p = allAvailable[i]
    let ix = Math.max(0, Math.min(1023, Math.floor((pX[p] / canvasW) * 1023)))
    let iy = Math.max(0, Math.min(1023, Math.floor((pY[p] / canvasH) * 1023)))
    let m = 0
    for (let bit = 0; bit < 10; bit++) {
      m |= ((ix & (1 << bit)) << bit) | ((iy & (1 << bit)) << (bit + 1))
    }
    availKeys[i] = (m * 65536) + p
  }
  availKeys.sort()

  const targetKeys = targetKeysBuffer.subarray(0, leftoverT.length)
  for (let i = 0; i < leftoverT.length; i++) {
    const t = leftoverT[i]
    let ix = Math.max(0, Math.min(1023, Math.floor((tX[t] / canvasW) * 1023)))
    let iy = Math.max(0, Math.min(1023, Math.floor((tY[t] / canvasH) * 1023)))
    let m = 0
    for (let bit = 0; bit < 10; bit++) {
      m |= ((ix & (1 << bit)) << bit) | ((iy & (1 << bit)) << (bit + 1))
    }
    targetKeys[i] = (m * 65536) + t
  }
  targetKeys.sort()

  for (let i = 0; i < leftoverT.length && i < allAvailable.length; i++) {
    const p = availKeys[i] % 65536
    const t = targetKeys[i] % 65536
    const wasIdle = !pActive[p]

    assignTarget(p, t)
    pActive[p] = 1
    pKey[p] = tKey[t]

    if (wasIdle) {
      pX[p] = pTargetX[p]
      pY[p] = pTargetY[p]
      pR[p] = pTargetR[p]
      pG[p] = pTargetG[p]
      pB[p] = pTargetB[p]
    }
  }

  for (let i = leftoverT.length; i < allAvailable.length; i++) {
    const p = availKeys[i] % 65536
    pActive[p] = 0
  }

  ctx.font = activeFont
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'

  for (let p = 0; p < N; p++) {
    if (!pActive[p]) continue

    pVX[p] += (pTargetX[p] - pX[p]) * config.swarm.spring
    pVY[p] += (pTargetY[p] - pY[p]) * config.swarm.spring
    pVX[p] *= config.swarm.damping
    pVY[p] *= config.swarm.damping
    pX[p] += pVX[p]
    pY[p] += pVY[p]

    pR[p] += (pTargetR[p] - pR[p]) * config.swarm.colorBlend
    pG[p] += (pTargetG[p] - pG[p]) * config.swarm.colorBlend
    pB[p] += (pTargetB[p] - pB[p]) * config.swarm.colorBlend

    const sr = pR[p], sg = pG[p], sb = pB[p]
    const grey = 0.299 * sr + 0.587 * sg + 0.114 * sb
    const cr = Math.max(0, Math.min(255, Math.round(grey + 2.1 * (sr - grey))))
    const cg = Math.max(0, Math.min(255, Math.round(grey + 2.1 * (sg - grey))))
    const cb = Math.max(0, Math.min(255, Math.round(grey + 2.1 * (sb - grey))))

    const alpha = Math.max(0.85, Math.min(1, Math.pow(grey / 255, 0.65) * 2.8))

    const charIndex = (Math.floor(globalTextOffset) + p) % charPool.length
    const char = charPool[charIndex] || ' '

    ctx.globalAlpha = alpha
    ctx.fillStyle = "rgb(" + cr + "," + cg + "," + cb + ")"

    ctx.fillText(char, Math.round(pX[p]), Math.round(pY[p]))
  }
}

playBtn.addEventListener('click', () => {
  initCanvas()
  video.play()
  overlay.classList.add('hidden')
  renderFrame()
})

video.addEventListener('ended', () => {
  cancelAnimationFrame(animId)
  overlay.classList.remove('hidden')
})

window.addEventListener('resize', () => {
  if (!video.paused) initCanvas()
})

initCanvas()