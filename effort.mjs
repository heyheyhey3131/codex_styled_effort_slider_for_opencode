/**
 * Codex-style thinking-effort math for OpenCode.
 *
 * Color/energy curve follows the public design of dsh-codex-effort-slider
 * (blue → violet → deep purple, energy after the first third). The functions
 * are host-agnostic so they can be unit-tested without OpenCode.
 */

export const COLOR_BLUE = [77, 147, 248]
export const COLOR_VIOLET = [147, 51, 234]
export const COLOR_DEEP = [76, 29, 149]
export const COLOR_TEXT_VIOLET = [139, 92, 246]
export const ENERGY_START = 1 / 3
export const ENERGY_END = 2 / 3
export const DEFAULT_TRACK_WIDTH = 16

export const RANK = Object.freeze({
  default: -1,
  auto: -1,
  reset: -1,
  none: 0,
  off: 0,
  disable: 0,
  disabled: 0,
  minimal: 1,
  min: 1,
  low: 2,
  medium: 3,
  med: 3,
  high: 4,
  xhigh: 5,
  "x-high": 5,
  extra: 5,
  max: 6,
  maximum: 6,
  ultra: 6,
})

const OFF_NAMES = new Set(["off", "none", "disable", "disabled", "关闭", "無", "无"])
const DEFAULT_NAMES = new Set(["default", "auto", "reset"])

export function clamp01(value) {
  if (!(value > 0)) return 0
  return value > 1 ? 1 : value
}

export function lerp(a, b, t) {
  return a + (b - a) * t
}

export function mixRgb(a, b, t) {
  const u = clamp01(t)
  return [Math.round(lerp(a[0], b[0], u)), Math.round(lerp(a[1], b[1], u)), Math.round(lerp(a[2], b[2], u))]
}

export function rgbHex(rgb) {
  return `#${rgb.map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0")).join("")}`
}

export function fillColorFor(pct) {
  const p = clamp01(pct)
  if (p <= ENERGY_START) return rgbHex(COLOR_BLUE)
  if (p <= ENERGY_END) {
    const t = (p - ENERGY_START) / (ENERGY_END - ENERGY_START)
    return rgbHex(mixRgb(COLOR_BLUE, COLOR_VIOLET, t))
  }
  const t = (p - ENERGY_END) / (1 - ENERGY_END)
  return rgbHex(mixRgb(COLOR_VIOLET, COLOR_DEEP, t))
}

export function energyFor(pct) {
  const p = clamp01(pct)
  if (p <= ENERGY_START) return 0
  return (p - ENERGY_START) / (1 - ENERGY_START)
}

export function valueColorFor(pct, off = false) {
  if (off) return ""
  const p = clamp01(pct)
  if (p <= ENERGY_START) return rgbHex(COLOR_BLUE)
  if (p <= ENERGY_END) {
    const t = (p - ENERGY_START) / (ENERGY_END - ENERGY_START)
    return rgbHex(mixRgb(COLOR_BLUE, COLOR_TEXT_VIOLET, t))
  }
  return rgbHex(COLOR_TEXT_VIOLET)
}

export function colorForVariant(id, variants = []) {
  if (isOffLevel(id)) return ""
  const list = effortLadder(variants)
  if (isDefaultLevel(id)) return valueColorFor(pctFromIndex(0, Math.max(1, list.length)), false)
  const incoming = Array.isArray(variants) ? variants.filter((item) => item != null && item !== "" && !isOffLevel(item) && !isDefaultLevel(item)) : []
  let ladder = list.length ? list : orderVariants(incoming)
  if (currentIndex(ladder, id) < 0) ladder = effortLadder([...incoming, String(id)])
  if (ladder.length === 0) ladder = [String(id)]
  const index = currentIndex(ladder, id)
  return valueColorFor(pctFromIndex(index < 0 ? ladder.length - 1 : index, ladder.length), false)
}

export function particleCountFor(pct, max = 8) {
  const energy = energyFor(pct)
  if (energy <= 0) return 0
  return Math.max(1, Math.round(energy * max))
}

export function isOffLevel(id) {
  if (id == null) return false
  return OFF_NAMES.has(String(id).trim().toLowerCase())
}

export function isDefaultLevel(id) {
  if (id == null || id === "") return true
  return DEFAULT_NAMES.has(String(id).trim().toLowerCase())
}

export function normalizeEffortId(id) {
  if (isDefaultLevel(id)) return undefined
  return id == null ? undefined : String(id)
}

export function effortLadder(ids) {
  const ordered = orderVariants(
    (Array.isArray(ids) ? ids : []).filter((id) => id != null && id !== "" && !isDefaultLevel(id)),
  )
  if (ordered.length === 0) return []
  return ["default", ...ordered]
}

export function rankOf(id) {
  const key = String(id ?? "")
    .trim()
    .toLowerCase()
  if (Object.hasOwn(RANK, key)) return RANK[key]
  return 50
}

export function orderVariants(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return []
  return ids
    .map((id, index) => ({ id: String(id), index, rank: rankOf(id) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((item) => item.id)
}

export function currentIndex(variants, current) {
  if (!Array.isArray(variants) || variants.length === 0) return -1
  if (isDefaultLevel(current)) {
    const index = variants.findIndex((id) => isDefaultLevel(id))
    return index
  }
  const needle = String(current).toLowerCase()
  return variants.findIndex((id) => String(id).toLowerCase() === needle)
}

export function pctFromIndex(index, count) {
  if (count <= 0) return 0
  if (count === 1) return 1
  if (!(index >= 0)) return 0
  const safe = Math.max(0, Math.min(count - 1, index))
  return safe / (count - 1)
}

export function indexFromPct(pct, count) {
  if (count <= 1) return 0
  return Math.max(0, Math.min(count - 1, Math.round(clamp01(pct) * (count - 1))))
}

export function variantIndexAtCell(cell, width, count) {
  if (count <= 1) return 0
  const span = Math.max(1, width - 1)
  return indexFromPct(cell / span, count)
}

export function stepVariant(variants, current, delta) {
  if (!Array.isArray(variants) || variants.length === 0) return undefined
  const step = delta < 0 ? -1 : 1
  let index = currentIndex(variants, current)
  if (index < 0) index = step > 0 ? 0 : variants.length - 1
  else index = Math.max(0, Math.min(variants.length - 1, index + step))
  return variants[index]
}

export function parseEffortArg(input, variants = []) {
  const raw = String(input ?? "").trim()
  if (!raw) return { action: "pick" }
  const lower = raw.toLowerCase()
  if (["+", "next", "up", "inc", "increase"].includes(lower)) return { action: "step", delta: 1 }
  if (["-", "prev", "down", "dec", "decrease"].includes(lower)) return { action: "step", delta: -1 }
  if (["default", "auto", "reset"].includes(lower)) return { action: "set", id: undefined }
  const exact = variants.find((id) => String(id).toLowerCase() === lower)
  if (exact) return { action: "set", id: exact }
  const prefixed = variants.filter((id) => String(id).toLowerCase().startsWith(lower))
  if (prefixed.length === 1) return { action: "set", id: prefixed[0] }
  return { action: "unknown", raw }
}

export function displayLabel(id) {
  if (id == null || id === "") return "Default"
  const text = String(id)
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function detentTargetIndex(current, pct, count) {
  if (count <= 1) return 0
  const p = clamp01(pct)
  if (!(current >= 0) || current >= count) return indexFromPct(p, count)
  const step = 1 / (count - 1)
  const forward = 1 / 3
  let index = current
  const center = index * step
  if (p >= center) {
    while (index < count - 1 && p >= (index + forward) * step - 1e-9) index += 1
  } else {
    while (index > 0 && p <= (index - forward) * step + 1e-9) index -= 1
  }
  return index
}

const GOLDEN_RATIO = 0.6180339887498949
const STARFIELD_DURATION_MEAN = 1.5
const STARFIELD_DURATION_SPREAD = 0.08
const STARFIELD_MIN = 0.5
const MAX_SPEED_FACTOR = 2

function starHash01(index, salt) {
  const value = ((index + 1) * (salt || 1) * 2654435761) % 4294967296
  return ((value >>> 8) % 1000) / 1000
}

export const PARTICLES = Object.freeze(
  Array.from({ length: 22 }, (_, index) => {
    const brightness = STARFIELD_MIN + (1 - STARFIELD_MIN) * starHash01(index, 61)
    return Object.freeze({
      id: index,
      y: 8 + ((((index * 5) % 22) / 21) * 84),
      phase: ((index + 1) * GOLDEN_RATIO) % 1,
      brightness: Math.round(brightness * 1000) / 1000,
    })
  }),
)

export function speedFor(pct) {
  const energy = energyFor(pct)
  return Math.min(MAX_SPEED_FACTOR, Math.max(0.35, 2 * energy))
}

export function starDurationFor(index, speedFactor) {
  const speed = Math.min(MAX_SPEED_FACTOR, Math.max(0.35, Number(speedFactor) || MAX_SPEED_FACTOR))
  const spread = 1 - STARFIELD_DURATION_SPREAD + 2 * STARFIELD_DURATION_SPREAD * starHash01(index, 29)
  return ((STARFIELD_DURATION_MEAN * MAX_SPEED_FACTOR) / speed) * spread
}

export function starDelayFor(index, duration) {
  const particle = PARTICLES[index]
  const phase = particle?.phase ?? 0
  const dur = duration > 0 ? duration : starDurationFor(index, MAX_SPEED_FACTOR)
  return -(((phase + starHash01(index, 53) * 0.03) % 1) * dur)
}

export function starLayerOpacityFor(pct) {
  const energy = energyFor(pct)
  if (energy <= 0) return 0
  return Math.round((0.6 + 0.4 * energy) * 1000) / 1000
}

export function fillBackgroundFor(pct) {
  const p = clamp01(pct)
  if (p <= ENERGY_START) return rgbHex(COLOR_BLUE)
  const end = fillColorFor(p)
  if (p <= ENERGY_END) return `linear-gradient(90deg, ${rgbHex(COLOR_BLUE)} 0%, ${end} 100%)`
  const mid = Math.round((ENERGY_END / p) * 100)
  return `linear-gradient(90deg, ${rgbHex(COLOR_BLUE)} 0%, ${rgbHex(COLOR_VIOLET)} ${mid}%, ${end} 100%)`
}

export function trackCells(count, index, width = DEFAULT_TRACK_WIDTH) {
  const cells = []
  const w = Math.max(count > 0 ? count * 2 - 1 : 8, width)
  const knob = index < 0 ? -1 : Math.round(pctFromIndex(index, count) * Math.max(0, w - 1))
  const pct = pctFromIndex(index < 0 ? 0 : index, count)
  const fill = fillColorFor(pct)
  const energy = energyFor(pct)
  const notchAt = new Set()
  if (count > 0) {
    for (let i = 0; i < count; i++) {
      notchAt.add(Math.round(pctFromIndex(i, count) * Math.max(0, w - 1)))
    }
  }
  for (let x = 0; x < w; x++) {
    const variantIndex = variantIndexAtCell(x, w, count)
    const filled = knob >= 0 && x <= knob
    const isKnob = x === knob
    const isNotch = notchAt.has(x)
    let ch = "━"
    if (isKnob) ch = "●"
    else if (isNotch) ch = filled ? "●" : "○"
    else if (filled) ch = energy >= 0.5 ? "═" : "━"
    cells.push({
      x,
      ch,
      filled,
      knob: isKnob,
      notch: isNotch,
      variantIndex,
      fg: filled || isKnob ? fill : undefined,
    })
  }
  return { cells, width: w, pct, energy, fill, knob }
}

export function sparkleFrame(frame, energy) {
  if (!(energy > 0.45)) return ""
  const glyphs = energy >= 0.85 ? ["✦", "✧", "★", "✦"] : ["·", "✦", "·", "✧"]
  return glyphs[Math.abs(frame) % glyphs.length]
}
