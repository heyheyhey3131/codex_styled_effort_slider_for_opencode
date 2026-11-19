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
export const COLOR_KNOB = [255, 255, 255]
export const COLOR_TRACK = [48, 48, 58]
export const ENERGY_START = 1 / 3
export const ENERGY_END = 2 / 3
export const DEFAULT_TRACK_WIDTH = 16
export const ENERGY_RGB = Object.freeze([
  [59, 17, 120],
  [109, 40, 217],
  [147, 51, 234],
  [192, 132, 252],
])
export const ENERGY_POS = Object.freeze([0, 0.3, 0.62, 1])

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

export function energyColorAt(t) {
  const u = clamp01(t)
  for (let i = 1; i < ENERGY_POS.length; i++) {
    if (u <= ENERGY_POS[i]) {
      const span = ENERGY_POS[i] - ENERGY_POS[i - 1]
      const local = span <= 0 ? 1 : (u - ENERGY_POS[i - 1]) / span
      return mixRgb(ENERGY_RGB[i - 1], ENERGY_RGB[i], local)
    }
  }
  return ENERGY_RGB[ENERGY_RGB.length - 1]
}

export function fillRgbAt(pct, along = 1) {
  const p = clamp01(pct)
  const u = clamp01(along)
  const energy = energyFor(p)
  if (energy <= 0) return COLOR_BLUE
  const cool = mixRgb(COLOR_BLUE, COLOR_VIOLET, u)
  const hot = energyColorAt(u)
  return mixRgb(cool, hot, energy)
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
  const incoming = Array.isArray(variants) ? variants.filter((item) => item != null && item !== "" && !isOffLevel(item) && !isDefaultLevel(item)) : []
  if (isDefaultLevel(id)) {
    // Without a real ladder, pctFromIndex(0, 1) would jump to the top of the
    // curve; Default always sits at the first position instead.
    if (list.length < 2) return valueColorFor(0, false)
    return valueColorFor(pctFromIndex(0, list.length), false)
  }
  if (incoming.length === 0) {
    // No known ladder (model unresolved): fall back to the canonical rank
    // curve so tiers keep their blue → violet gradient instead of all
    // collapsing onto the maximum color.
    const rank = rankOf(id)
    if (rank >= 2 && rank <= 6) return valueColorFor((rank - 2) / 4, false)
    return valueColorFor(1, false)
  }
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

const EFFORT_ALIAS = Object.freeze({
  default: ["default", "auto", "reset", "默认", "預設", "预设"],
  none: ["none"],
  off: ["off", "disable", "disabled", "关闭", "關閉", "无", "無"],
  minimal: ["minimal", "min", "最低"],
  low: ["low", "低"],
  medium: ["medium", "med", "中"],
  high: ["high", "高"],
  xhigh: ["xhigh", "x-high", "extra", "极高", "極高"],
  max: ["max", "maximum", "ultra", "最大"],
})

export function canonicalEffort(id) {
  if (isDefaultLevel(id)) return "default"
  const key = String(id ?? "").trim().toLowerCase()
  if (!key) return "default"
  for (const [name, aliases] of Object.entries(EFFORT_ALIAS)) {
    if (aliases.some((alias) => alias.toLowerCase() === key)) return name
  }
  return key
}

export function sameEffort(a, b) {
  return canonicalEffort(a) === canonicalEffort(b)
}

export function resolveEffortId(id, variants) {
  if (isDefaultLevel(id)) return undefined
  const list = effortLadder(variants)
  const hit = list.find((item) => !isDefaultLevel(item) && sameEffort(item, id))
  return hit ? String(hit) : undefined
}

export function effortAllowed(id, variants) {
  if (isDefaultLevel(id)) return true
  return resolveEffortId(id, variants) != null
}

export function clampEffort(id, variants) {
  if (isDefaultLevel(id)) return undefined
  return resolveEffortId(id, variants)
}

export function nativeEffortValue(id) {
  if (isDefaultLevel(id)) return "default"
  return String(normalizeEffortId(id) ?? canonicalEffort(id))
}

export function effortLadder(ids) {
  const ordered = orderVariants(
    (Array.isArray(ids) ? ids : []).filter((id) => id != null && id !== "" && !isDefaultLevel(id)),
  )
  if (ordered.length === 0) return []
  return ["default", ...ordered]
}

export function idsFromVariants(raw) {
  if (raw == null) return []
  if (Array.isArray(raw)) {
    return orderVariants(
      raw
        .map((item) => {
          if (item == null || item === "") return ""
          if (typeof item === "string") return item
          return String(item.id ?? item.variant ?? "")
        })
        .filter((id) => id && !isDefaultLevel(id)),
    )
  }
  if (typeof raw === "object") {
    return orderVariants(Object.keys(raw).filter((id) => id && !isDefaultLevel(id)))
  }
  return []
}

function identityIds(item, keys) {
  if (!item) return []
  return keys.map((key) => item[key]).filter((value) => value != null && value !== "").map(String)
}

export function modelMatches(item, selected) {
  if (!item || !selected) return false
  const modelIDs = identityIds(item, ["id", "modelID"])
  const selectedIDs = identityIds(selected, ["id", "modelID"])
  if (modelIDs.length === 0 || selectedIDs.length === 0) return false
  if (!modelIDs.some((id) => selectedIDs.includes(id))) return false
  const providers = identityIds(item, ["providerID", "canonical"])
  const selectedProviders = identityIds(selected, ["providerID", "canonical"])
  if (providers.length === 0 || selectedProviders.length === 0) return true
  return providers.some((id) => selectedProviders.includes(id))
}

export function pickListedModel(list, selected) {
  if (!Array.isArray(list) || !selected) return undefined
  return list.find((item) => modelMatches(item, selected))
}

function normalizeLabel(label) {
  return String(label ?? "")
    .trim()
    .toLowerCase()
    .replace(/…$|\.{2,}$/g, "")
}

function uniqueByStage(list, text, stage) {
  const hits = list.filter((item) => {
    const name = String(item?.name ?? "").toLowerCase()
    if (!name) return false
    if (stage === "exact") return name === text
    if (stage === "byId") return identityIds(item, ["id", "modelID"]).some((id) => id.toLowerCase() === text)
    if (stage === "prefixed") return name.startsWith(text) || (text.startsWith(name) && name.length >= 10)
    if (stage === "contained") return name.length >= 6 && text.includes(name)
    return false
  })
  return hits.length === 1 ? hits[0] : undefined
}

function labelParts(label) {
  const text = String(label ?? "").trim()
  if (!text.includes("/")) return undefined
  const parts = text.split("/")
  const provider = (parts.shift() || "").trim().toLowerCase()
  const model = parts.join("/").trim().toLowerCase()
  if (!provider || !model) return undefined
  return { provider, model }
}

function providerNamesLookup(providerNames) {
  if (!providerNames) return undefined
  if (typeof providerNames.get === "function" && typeof providerNames.has === "function") return providerNames
  const map = new Map()
  for (const [key, value] of Object.entries(providerNames || {})) map.set(String(key), String(value ?? ""))
  return map
}

function disambiguateByProvider(candidates, providerText, providerNames) {
  const lookup = providerNamesLookup(providerNames)
  if (lookup) {
    const byName = candidates.filter((item) => {
      const name = String(lookup.get(String(item?.providerID ?? "")) ?? "").trim().toLowerCase()
      return name !== "" && name === providerText
    })
    if (byName.length === 1) return byName[0]
  }
  const wantTokens = providerText.split(/[^a-z0-9]+/).filter((token) => token.length >= 3)
  const byId = candidates.filter((item) => {
    const pid = String(item?.providerID ?? "").toLowerCase()
    if (!pid) return false
    if (providerText.length >= 3 && pid.includes(providerText)) return true
    const pidTokens = pid.split(/[^a-z0-9]+/).filter(Boolean)
    return wantTokens.some((token) => pidTokens.includes(token))
  })
  if (byId.length === 1) return byId[0]
  return undefined
}

function candidatesForModelText(list, text) {
  const exact = list.filter((item) => String(item?.name ?? "").toLowerCase() === text)
  if (exact.length) return exact
  const byId = list.filter((item) => identityIds(item, ["id", "modelID"]).some((id) => id.toLowerCase() === text))
  if (byId.length) return byId
  const prefixed = list.filter((item) => {
    const name = String(item?.name ?? "").toLowerCase()
    if (!name) return false
    return name.startsWith(text) || (text.startsWith(name) && name.length >= 10)
  })
  if (prefixed.length) return prefixed
  return list.filter((item) => {
    const name = String(item?.name ?? "").toLowerCase()
    return name.length >= 6 && text.includes(name)
  })
}

export function matchModelByLabel(list, label, providerNames) {
  const text = normalizeLabel(label)
  if (!text || !Array.isArray(list)) return undefined
  const direct =
    uniqueByStage(list, text, "exact") ??
    uniqueByStage(list, text, "byId") ??
    uniqueByStage(list, text, "prefixed") ??
    uniqueByStage(list, text, "contained")
  if (direct) return direct
  const parts = labelParts(text)
  if (!parts) return undefined
  const candidates = candidatesForModelText(list, parts.model)
  if (candidates.length === 0) return undefined
  if (candidates.length === 1) return candidates[0]
  const byProvider = disambiguateByProvider(candidates, parts.provider, providerNames)
  if (byProvider) return byProvider
  // Prefer the longest unique name ("Qwen4 Max Preview" over "Qwen4 Max").
  const sorted = [...candidates].sort(
    (a, b) => String(b?.name ?? "").length - String(a?.name ?? "").length,
  )
  if (String(sorted[0]?.name ?? "").length !== String(sorted[1]?.name ?? "").length) return sorted[0]
  return undefined
}

export function matchModelFromLabels(list, labels, providerNames) {
  if (!Array.isArray(list) || !Array.isArray(labels)) return undefined
  const hits = []
  const seen = new Set()
  for (const label of labels) {
    const found = matchModelByLabel(list, label, providerNames)
    if (!found) continue
    const key = `${found.providerID || ""}::${found.id || found.modelID || ""}`
    if (seen.has(key)) continue
    seen.add(key)
    hits.push(found)
  }
  return hits.length === 1 ? hits[0] : undefined
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
  return variants.findIndex((id) => sameEffort(id, current))
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

export function evenTrackWidth(count, minWidth = DEFAULT_TRACK_WIDTH) {
  const floor = Math.max(1, minWidth)
  if (!(count > 1)) return floor
  const span = count - 1
  const gap = Math.max(1, Math.ceil((floor - 1) / span))
  return span * gap + 1
}

export function padEffortLabel(id, width = 8) {
  const text = displayLabel(id)
  if (text.length >= width) return text.slice(0, width)
  return text.padEnd(width, " ")
}

export const GRADIENT_BAR_WIDTH = 16

export function gradientCells(count, width = GRADIENT_BAR_WIDTH) {
  const w = Math.max(1, width)
  const levels = Math.max(1, count)
  const cells = []
  for (let x = 0; x < w; x++) {
    const pct = w === 1 ? 1 : x / (w - 1)
    cells.push({
      x,
      ch: "■",
      fg: fillColorFor(pct),
      variantIndex: variantIndexAtCell(x, w, levels),
    })
  }
  return cells
}

export function notchColumns(count, width = GRADIENT_BAR_WIDTH) {
  const w = evenTrackWidth(count, width)
  const span = Math.max(0, w - 1)
  const columns = []
  if (count > 0) {
    for (let i = 0; i < count; i++) columns.push(Math.round(pctFromIndex(i, count) * span))
  }
  return columns
}

export function nearestNotchIndex(columns, x) {
  if (!Array.isArray(columns) || columns.length === 0) return 0
  let best = 0
  let bestDistance = Infinity
  for (let i = 0; i < columns.length; i++) {
    const distance = Math.abs(columns[i] - x)
    if (distance < bestDistance) {
      bestDistance = distance
      best = i
    }
  }
  return best
}

export function barCells(count, index, width = GRADIENT_BAR_WIDTH) {
  const w = evenTrackWidth(count, width)
  const pct = pctFromIndex(index < 0 ? 0 : index, count)
  const fillEnd = index < 0 ? -1 : Math.round(pct * Math.max(0, w - 1))
  const columns = notchColumns(count, width)
  const notchAt = new Set(columns)
  const cells = []
  for (let x = 0; x < w; x++) {
    const inFill = x <= fillEnd
    const along = fillEnd <= 0 ? 0 : x / fillEnd
    const rgb = inFill ? fillRgbAt(pct, along) : COLOR_TRACK
    const hex = rgbHex(rgb)
    const isKnob = x === fillEnd && index >= 0
    const isNotch = notchAt.has(x)
    let ch = "█"
    let fg = hex
    if (isKnob) {
      ch = "●"
      fg = rgbHex(COLOR_KNOB)
    } else if (isNotch) {
      ch = "•"
      fg = rgbHex(COLOR_KNOB)
    }
    cells.push({
      x,
      ch,
      fg,
      bg: hex,
      knob: isKnob,
      notch: isNotch,
      filled: inFill,
      variantIndex: nearestNotchIndex(columns, x),
    })
  }
  return { cells, width: w, pct, fillEnd, columns }
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
  const w = evenTrackWidth(count, width)
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
