import assert from "node:assert/strict"
import test from "node:test"
import {
  COLOR_BLUE,
  COLOR_DEEP,
  COLOR_TEXT_VIOLET,
  COLOR_VIOLET,
  colorForVariant,
  currentIndex,
  detentTargetIndex,
  displayLabel,
  effortLadder,
  idsFromVariants,
  matchModelByLabel,
  matchModelFromLabels,
  modelMatches,
  pickListedModel,
  energyFor,
  fillColorFor,
  indexFromPct,
  isDefaultLevel,
  isOffLevel,
  normalizeEffortId,
  orderVariants,
  parseEffortArg,
  particleCountFor,
  pctFromIndex,
  rgbHex,
  sparkleFrame,
  stepVariant,
  trackCells,
  valueColorFor,
  variantIndexAtCell,
} from "./effort.mjs"

test("orders known effort names low-to-max and keeps unknown stable", () => {
  assert.deepEqual(orderVariants(["high", "low", "max", "medium"]), ["low", "medium", "high", "max"])
  assert.deepEqual(orderVariants(["custom", "low", "custom-2"]), ["low", "custom", "custom-2"])
  assert.deepEqual(orderVariants(["high", "default", "low"]), ["default", "low", "high"])
})

test("pct/index round-trip and single-level max", () => {
  assert.equal(pctFromIndex(0, 0), 0)
  assert.equal(pctFromIndex(0, 1), 1)
  assert.equal(pctFromIndex(0, 4), 0)
  assert.equal(pctFromIndex(3, 4), 1)
  assert.equal(indexFromPct(0, 4), 0)
  assert.equal(indexFromPct(1, 4), 3)
  assert.equal(indexFromPct(2 / 3, 4), 2)
  for (let i = 0; i < 5; i++) {
    assert.equal(indexFromPct(pctFromIndex(i, 5), 5), i)
  }
})

test("fill is blue through the first third, then violet, then deep", () => {
  assert.equal(fillColorFor(0), rgbHex(COLOR_BLUE))
  assert.equal(fillColorFor(1 / 3), rgbHex(COLOR_BLUE))
  assert.equal(fillColorFor(2 / 3), rgbHex(COLOR_VIOLET))
  assert.equal(fillColorFor(1), rgbHex(COLOR_DEEP))
  assert.equal(energyFor(0), 0)
  assert.equal(energyFor(1 / 3), 0)
  assert.equal(energyFor(1), 1)
  assert.ok(energyFor(2 / 3) > 0.4)
  assert.equal(particleCountFor(0), 0)
  assert.equal(particleCountFor(1, 8), 8)
})

test("off levels stay uncolored", () => {
  assert.equal(isOffLevel("off"), true)
  assert.equal(isOffLevel("None"), true)
  assert.equal(isOffLevel("关闭"), true)
  assert.equal(isOffLevel("high"), false)
  assert.equal(valueColorFor(1, true), "")
  assert.equal(valueColorFor(1, false), rgbHex(COLOR_TEXT_VIOLET))
})

test("click cells snap to nearest notch", () => {
  const width = 16
  assert.equal(variantIndexAtCell(0, width, 4), 0)
  assert.equal(variantIndexAtCell(width - 1, width, 4), 3)
  assert.equal(variantIndexAtCell(Math.round((2 / 3) * (width - 1)), width, 4), 2)
})

test("step and parse effort arguments", () => {
  const variants = ["low", "medium", "high", "max"]
  assert.equal(stepVariant(variants, undefined, 1), "low")
  assert.equal(stepVariant(variants, "low", 1), "medium")
  assert.equal(stepVariant(variants, "max", 1), "max")
  assert.equal(stepVariant(variants, "low", -1), "low")
  assert.equal(currentIndex(variants, "high"), 2)
  assert.deepEqual(parseEffortArg("", variants), { action: "pick" })
  assert.deepEqual(parseEffortArg("+", variants), { action: "step", delta: 1 })
  assert.deepEqual(parseEffortArg("high", variants), { action: "set", id: "high" })
  assert.deepEqual(parseEffortArg("ma", variants), { action: "set", id: "max" })
  assert.deepEqual(parseEffortArg("default", variants), { action: "set", id: undefined })
  assert.equal(parseEffortArg("nope", variants).action, "unknown")
  assert.equal(displayLabel("high"), "High")
  assert.equal(displayLabel("xhigh"), "Xhigh")
  assert.equal(displayLabel("medium"), "Medium")
  assert.equal(displayLabel(undefined), "Default")
})

test("track has a knob, notches, and fill up to the current index", () => {
  const { cells, energy, knob } = trackCells(4, 2, 16)
  assert.equal(cells.length, 16)
  assert.ok(cells.some((cell) => cell.knob && cell.ch === "●"))
  assert.equal(cells.filter((cell) => cell.notch).length, 4)
  assert.ok(cells.filter((cell) => cell.filled).length >= 3)
  assert.equal(cells[knob].knob, true)
  assert.ok(energy > 0)
  assert.equal(sparkleFrame(0, 0), "")
  assert.equal(sparkleFrame(0, 1), "✦")
})

test("detent crosses a third of a step, labels match native title case", () => {
  assert.equal(detentTargetIndex(0, 0.1, 4), 0)
  assert.equal(detentTargetIndex(0, 0.12, 4), 1)
  assert.equal(detentTargetIndex(1, 0.25, 4), 1)
  assert.equal(detentTargetIndex(1, 0.1, 4), 0)
})

test("native effort labels follow the slider color curve", () => {
  const variants = ["low", "medium", "high", "xhigh"]
  assert.equal(colorForVariant("low", variants), rgbHex(COLOR_BLUE))
  assert.equal(colorForVariant("xhigh", variants), rgbHex(COLOR_TEXT_VIOLET))
  assert.equal(colorForVariant("off", variants), "")
  assert.notEqual(colorForVariant("medium", variants), colorForVariant("high", variants))
})

test("Default matches the slider unset color instead of ranking as an unknown max", () => {
  const variants = ["low", "medium", "high", "xhigh"]
  const unset = colorForVariant("default", variants)
  assert.equal(isDefaultLevel(undefined), true)
  assert.equal(isDefaultLevel(""), true)
  assert.equal(isDefaultLevel("Default"), true)
  assert.equal(isDefaultLevel("low"), false)
  assert.equal(normalizeEffortId("default"), undefined)
  assert.deepEqual(effortLadder(variants), ["default", "low", "medium", "high", "xhigh"])
  assert.equal(unset, rgbHex(COLOR_BLUE))
  assert.equal(colorForVariant(undefined, variants), unset)
  assert.equal(colorForVariant("", variants), unset)
  assert.equal(colorForVariant("Default", variants), unset)
  assert.notEqual(unset, colorForVariant("xhigh", variants))
  assert.equal(currentIndex(effortLadder(variants), undefined), 0)
  assert.equal(stepVariant(effortLadder(variants), undefined, 1), "low")
})

test("ladders keep only the model's own variants and never invent medium/xhigh/max", () => {
  assert.deepEqual(effortLadder(["low", "high"]), ["default", "low", "high"])
  assert.equal(effortLadder(["low", "high"]).includes("medium"), false)
  assert.deepEqual(effortLadder(["low", "high", "xhigh"]), ["default", "low", "high", "xhigh"])
  assert.deepEqual(idsFromVariants([{ id: "low" }, { id: "max" }]), ["low", "max"])
  assert.deepEqual(idsFromVariants({ low: {}, high: {}, xhigh: {} }), ["low", "high", "xhigh"])
  assert.equal(idsFromVariants({ low: {}, high: {} }).includes("medium"), false)
})

test("model matching is by provider/model id, not a default ladder or loose name", () => {
  const grok = { providerID: "opencode", id: "grok-4.6", modelID: "grok-4.6", name: "Grok 4.6", variants: [{ id: "low" }, { id: "high" }, { id: "xhigh" }] }
  const hy = { providerID: "opencode", id: "hy4-flash-free", name: "HY4 Flash Free", variants: { low: {}, high: {} } }
  const deepseek = { providerID: "opencode", id: "deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash", variants: ["low", "medium", "high", "max"] }
  const listed = [grok, hy, deepseek]
  assert.equal(pickListedModel(listed, { providerID: "opencode", modelID: "grok-4.6" }), grok)
  assert.deepEqual(idsFromVariants(pickListedModel(listed, { providerID: "opencode", modelID: "grok-4.6" }).variants), ["low", "high", "xhigh"])
  assert.deepEqual(idsFromVariants(pickListedModel(listed, { providerID: "opencode", modelID: "hy4-flash-free" }).variants), ["low", "high"])
  assert.deepEqual(idsFromVariants(pickListedModel(listed, { providerID: "opencode", modelID: "deepseek-v4.1-flash" }).variants), ["low", "medium", "high", "max"])
  assert.equal(modelMatches(grok, { providerID: "anthropic", modelID: "grok-4.6" }), false)
  assert.equal(matchModelByLabel(listed, "Flash"), undefined)
  assert.equal(matchModelByLabel(listed, "Grok 4.6"), grok)
  assert.equal(matchModelFromLabels(listed, ["Build", "Grok 4.6", "Default"]), grok)
  assert.equal(matchModelFromLabels(listed, ["Build", "Plan"]), undefined)
  assert.equal(matchModelFromLabels(listed, ["HY4 Flash Free", "High"]), hy)
})

test("each model's own max is purple, even when missing from another ladder", () => {
  const three = ["low", "medium", "high"]
  const four = ["low", "medium", "high", "xhigh"]
  assert.equal(colorForVariant("high", three), rgbHex(COLOR_TEXT_VIOLET))
  assert.equal(colorForVariant("xhigh", three), rgbHex(COLOR_TEXT_VIOLET))
  assert.equal(colorForVariant("high", ["low", "high"]), rgbHex(COLOR_TEXT_VIOLET))
  assert.equal(colorForVariant("high", three), colorForVariant("xhigh", four))
  assert.equal(colorForVariant("low", four), rgbHex(COLOR_BLUE))
  assert.notEqual(colorForVariant("medium", four), colorForVariant("xhigh", four))
})
