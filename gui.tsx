/** @jsxImportSource solid-js */
import { createEffect, createMemo, createSignal, onCleanup, onMount, Show } from "solid-js"
import { Portal } from "solid-js/web"
import { Command, Plugin, Slot, Style } from "@opencode/plugin/gui"
import {
  clamp01,
  colorForVariant,
  currentIndex,
  detentTargetIndex,
  displayLabel,
  effortLadder,
  energyFor,
  fillBackgroundFor,
  idsFromVariants,
  isDefaultLevel,
  isOffLevel,
  matchModelFromLabels,
  normalizeEffortId,
  orderVariants,
  sameEffort,
  pickListedModel,
  PARTICLES,
  particleCountFor,
  pctFromIndex,
  speedFor,
  starDelayFor,
  starDurationFor,
  starLayerOpacityFor,
  valueColorFor,
} from "./effort.mjs"

const KNOB = 22
const CSS = `
.oces-dock { display:none !important; }
.oces-host { display:inline-flex; align-items:center; flex:0 0 auto; margin-inline-start:auto; vertical-align:middle; }
.oces-host:empty { display:none; }
[data-slot="composer-actions"] > .oces-host { margin-inline-start:0; }
.oces { display:inline-flex; align-items:center; gap:6px; height:28px; margin:0 2px 0 0;
  flex:0 0 auto; user-select:none; -webkit-user-select:none; vertical-align:middle; }
.oces-track { position:relative; width:146px; flex:0 0 146px; height:${KNOB}px; border-radius:999px; cursor:pointer;
  touch-action:none; background:rgba(128,128,145,.18);
  box-shadow:inset 0 1px 2px rgba(0,0,0,.28), inset 0 0 0 1px rgba(255,255,255,.06); }
.oces-track[data-energy="1"] { box-shadow:0 0 calc(var(--oces-energy,0) * 14px) rgba(168,85,247,.48), inset 0 1px 2px rgba(0,0,0,.28); }
.oces-fill { position:absolute; top:0; left:0; bottom:0; width:var(--oces-fill,11px);
  border-radius:${KNOB / 2}px 0 0 ${KNOB / 2}px; background:var(--oces-fill-bg,#4d93f8);
  overflow:hidden; pointer-events:none; }
.oces-track:not(.is-dragging) .oces-fill, .oces-track:not(.is-dragging) .oces-knob {
  transition: width .16s cubic-bezier(.2,.85,.2,1), left .16s cubic-bezier(.2,.85,.2,1), background .16s ease; }
.oces-energy { position:absolute; inset:0; opacity:var(--oces-energy,0); pointer-events:none;
  background:linear-gradient(90deg,#3b1178 0%,#6d28d9 30%,#9333ea 62%,#c084fc 100%); transition:opacity .2s ease; }
.oces-sweep { position:absolute; inset:0; pointer-events:none;
  background:linear-gradient(100deg,transparent 18%,rgba(255,255,255,.32) 50%,transparent 82%);
  animation:oces-sweep 2.4s linear infinite; }
.oces-stars { position:absolute; inset:0; overflow:hidden; pointer-events:none; opacity:var(--oces-star-opacity,0); }
.oces-star { position:absolute; left:0; right:0; height:3px; margin-top:-1.5px; pointer-events:none;
  animation-name:oces-star-sweep; animation-timing-function:linear; animation-iteration-count:infinite; }
.oces-star-dot { position:absolute; left:100%; top:0; width:3px; height:3px; margin-left:-1.5px; border-radius:50%;
  background:#f5f3ff; box-shadow:0 0 5px rgba(216,180,254,.95); opacity:var(--oces-b,1); transform:scale(var(--oces-b,1)); }
.oces-ticks { position:absolute; inset:0; pointer-events:none; }
.oces-tick { position:absolute; top:50%; width:3px; height:3px; margin:-1.5px 0 0 -1.5px; border-radius:50%;
  background:rgba(255,255,255,.28); }
.oces-tick.is-on { background:rgba(255,255,255,.7); }
.oces-knob { position:absolute; top:50%; left:var(--oces-fill,11px); width:${KNOB}px; height:${KNOB}px;
  margin:${-KNOB / 2}px 0 0 ${-KNOB / 2}px; border-radius:50%; background:#fff; pointer-events:none;
  box-shadow:0 1px 5px rgba(0,0,0,.34), 0 0 0 .5px rgba(0,0,0,.06); }
.oces-value { display:inline-flex; align-items:center; justify-content:flex-start; width:4.8em; flex:0 0 4.8em;
  height:16px; font-size:12px; font-weight:600; line-height:16px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.oces-native-effort { color: var(--oces-native-color) !important; }
.oces-native-trigger svg:not(.oces-chevron),
.oces-native-item svg:not(.oces-check),
.oces-native-item [data-slot*="indicator"] { display:none !important; }
.oces-chevron, .oces-check { flex:0 0 auto; pointer-events:none; overflow:visible;
  fill:none !important; stroke:currentColor !important; stroke-width:2; stroke-linecap:round; stroke-linejoin:round; }
.oces-chevron { width:12px; height:12px; margin-inline-start:-2px; margin-inline-end:-4px;
  color: var(--v2-icon-icon-muted, #8a8f98) !important; }
.oces-native-item { display:flex !important; align-items:center; gap:8px; }
.oces-check { width:14px; height:14px; margin-inline-start:auto; visibility:hidden;
  color: var(--v2-icon-icon-base, var(--v2-text-text-base, currentColor)) !important; }
.oces-native-item[aria-checked="true"] .oces-check,
.oces-native-item[data-checked] .oces-check,
.oces-native-item[data-selected] .oces-check,
.oces-native-item[data-state="checked"] .oces-check { visibility:visible; }
@keyframes oces-sweep { 0%{transform:translateX(100%)} 100%{transform:translateX(-100%)} }
@keyframes oces-star-sweep { 0%{transform:translate3d(0,0,0);opacity:0} 6%{opacity:1} 94%{opacity:1} 100%{transform:translate3d(-100%,0,0);opacity:0} }
@media (prefers-reduced-motion: reduce) {
  .oces-sweep, .oces-star { animation:none !important; }
  .oces-track:not(.is-dragging) .oces-fill, .oces-track:not(.is-dragging) .oces-knob { transition:none; }
}
`

type Variant = { id: string }

const EFFORT_RE = /^(low|medium|high|xhigh|max|off|minimal|min|default|none|extra)$/i
const CHEVRON_SVG =
  '<svg class="oces-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>'
const CHECK_SVG =
  '<svg class="oces-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>'

function effortText(node: Element) {
  return (node.textContent || "").replace(/\s+/g, " ").trim()
}

function paintNode(node: Element, color: string) {
  if (!color) {
    node.classList.remove("oces-native-effort")
    ;(node as HTMLElement).style.removeProperty("--oces-native-color")
    return
  }
  node.classList.add("oces-native-effort")
  ;(node as HTMLElement).style.setProperty("--oces-native-color", color)
}

function stripNative(node: Element) {
  node.classList.remove("oces-native-effort", "oces-native-trigger", "oces-native-item")
  ;(node as HTMLElement).style.removeProperty("--oces-native-color")
  node.querySelectorAll("svg.oces-chevron, svg.oces-check").forEach((svg) => svg.remove())
}

function clearStalePaints(keep: Set<Element>) {
  document.querySelectorAll(".oces-native-effort, .oces-native-trigger, .oces-native-item").forEach((node) => {
    if (keep.has(node)) return
    stripNative(node)
  })
}

function paintLabels(root: Element, color: string, keep: Set<Element>) {
  let labeled = false
  for (const el of root.querySelectorAll("span, bdi, p, div, label")) {
    if (el.querySelector("svg, img, button")) continue
    if (!EFFORT_RE.test(effortText(el))) continue
    paintNode(el, color)
    keep.add(el)
    labeled = true
  }
  if (!labeled) paintNode(root, color)
}

function iconWrap(root: Element) {
  const svgs = Array.from(root.querySelectorAll("svg:not(.oces-chevron):not(.oces-check)"))
  return svgs.at(-1)?.parentElement ?? root
}

function ensureChevron(button: Element) {
  if (button.querySelector("svg.oces-chevron")) return
  iconWrap(button).insertAdjacentHTML("beforeend", CHEVRON_SVG)
}

function ensureCheck(item: Element) {
  if (item.querySelector("svg.oces-check")) return
  item.insertAdjacentHTML("beforeend", CHECK_SVG)
}

function isComposerEffortButton(button: Element, send?: Element) {
  if (button.closest('[data-slot="composer-controls"], [data-component="composer"]')) return true
  if (button.parentElement?.querySelector(":scope > .oces")) return true
  if (send && button.closest("form") === send.closest("form")) return true
  const label = `${button.getAttribute("aria-label") || ""} ${button.getAttribute("title") || ""}`.toLowerCase()
  return /variant|thinking|effort|intensity/.test(label)
}

function menuEffortIds(node: Element) {
  const menu =
    node.closest('[role="menu"], [role="listbox"], [data-slot*="menu"], [data-slot*="list"]') ?? node.parentElement
  if (!menu) return []
  const scoped = menu.querySelectorAll(
    ':scope > [role="menuitem"], :scope > [role="option"], :scope > [role="menuitemradio"], :scope > [role="menuitemcheckbox"], :scope > button, :scope > [role="button"]',
  )
  const source = scoped.length ? scoped : menu.children
  const ids: string[] = []
  for (const child of Array.from(source)) {
    const text = effortText(child)
    if (!EFFORT_RE.test(text)) continue
    ids.push(text)
  }
  return orderVariants(ids)
}

function ladderFor(node: Element, fallback: string[]) {
  const local = menuEffortIds(node)
  return local.length ? local : fallback
}

function paintNativeEffort(variants: string[], current?: string) {
  const fallback = effortLadder(variants)
  const keep = new Set<Element>()
  const send = findSendButton()
  const buttons = Array.from(document.querySelectorAll("button,[role='button']"))
  for (const button of buttons) {
    if (button.closest(".oces")) continue
    const text = effortText(button)
    if (!EFFORT_RE.test(text)) continue
    const composer = isComposerEffortButton(button, send)
    const id = composer ? current || text : text
    const color = colorForVariant(id, composer ? fallback : ladderFor(button, fallback))
    paintLabels(button, color, keep)
    keep.add(button)
    if (!composer) continue
    button.classList.add("oces-native-trigger")
    ensureChevron(button)
  }
  const items = document.querySelectorAll('[role="menuitem"],[role="option"],[role="menuitemradio"],[role="menuitemcheckbox"]')
  for (const item of items) {
    if (item.closest(".oces")) continue
    const text = effortText(item)
    if (!EFFORT_RE.test(text)) continue
    const color = colorForVariant(text, ladderFor(item, fallback))
    item.classList.add("oces-native-item")
    paintLabels(item, color, keep)
    keep.add(item)
    ensureCheck(item)
  }
  clearStalePaints(keep)
}

function isSendLike(button: Element) {
  const label = [
    button.getAttribute("aria-label"),
    button.getAttribute("title"),
    button.getAttribute("data-action"),
    button.getAttribute("data-slot"),
  ]
    .join(" ")
    .toLowerCase()
  return /(send|submit|stop|queue|steer|发送|提交|停止)/.test(label)
}

function actionButtons(root: ParentNode) {
  return Array.from(root.querySelectorAll("button,[role='button']")).filter(
    (button) => !button.closest(".oces, .oces-host"),
  )
}

function isShown(node: Element) {
  if (!(node instanceof HTMLElement)) return false
  if (node.hidden || node.getAttribute("aria-hidden") === "true") return false
  if ("inert" in node && (node as HTMLElement & { inert?: boolean }).inert) return false
  const style = window.getComputedStyle(node)
  if (style.display === "none" || style.visibility === "hidden") return false
  const rect = node.getBoundingClientRect()
  return rect.width > 1 && rect.height > 1
}

function findVisibleComposer() {
  const list = Array.from(document.querySelectorAll("[data-component='composer']"))
  const shown = list.filter(isShown)
  const pool = shown.length ? shown : list
  const active = document.activeElement
  if (active instanceof Node) {
    const hit = pool.find((node) => node.contains(active))
    if (hit) return hit
  }
  return pool.at(-1)
}

function findSendButton(composer = findVisibleComposer()) {
  const actions =
    composer?.querySelector("[data-slot='composer-actions']") ??
    Array.from(document.querySelectorAll("[data-slot='composer-actions']")).find(isShown)
  if (actions && isShown(actions)) {
    const buttons = actionButtons(actions).filter(isShown)
    const named = buttons.find(isSendLike)
    if (named) return named
    if (buttons.length) return buttons[buttons.length - 1]
  }
  const named = actionButtons(composer ?? document).find((button) => isSendLike(button) && isShown(button))
  if (named) return named
  return undefined
}

function findComposerFooter(composer = findVisibleComposer()) {
  const controls = composer?.querySelector("[data-slot='composer-controls']")
  return (controls?.parentElement as HTMLElement | null) ?? undefined
}

function findNativeEffortTrigger(composer = findVisibleComposer()) {
  const controls = composer?.querySelector("[data-slot='composer-controls']")
  const roots = [controls, composer].filter(Boolean) as Element[]
  for (const root of roots) {
    for (const button of actionButtons(root)) {
      const text = effortText(button)
      if (EFFORT_RE.test(text)) return button
      const label = `${button.getAttribute("aria-label") || ""} ${button.getAttribute("title") || ""}`.toLowerCase()
      if (/variant|thinking|effort|intensity/.test(label)) return button
    }
  }
  return undefined
}

function effortMenuItems() {
  return Array.from(
    document.querySelectorAll('[role="menuitem"],[role="option"],[role="menuitemradio"],[role="menuitemcheckbox"]'),
  ).filter((item) => !item.closest(".oces") && EFFORT_RE.test(effortText(item)))
}

function clickElement(node: Element) {
  if (node instanceof HTMLElement) {
    node.click()
    return
  }
  node.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }))
}

let applyingNative = false

function nativeEffortMatches(id: string | undefined) {
  const trigger = findNativeEffortTrigger()
  if (!trigger) return false
  return sameEffort(effortText(trigger), id)
}

function selectNativeEffortItem(id: string | undefined) {
  const item = effortMenuItems().find((node) => sameEffort(effortText(node), id))
  if (!item) return false
  clickElement(item)
  return true
}

function applyNativeEffort(id: string | undefined) {
  if (applyingNative) return nativeEffortMatches(id)
  const trigger = findNativeEffortTrigger()
  if (!trigger) return false
  if (sameEffort(effortText(trigger), id)) return true
  applyingNative = true
  const done = () => {
    applyingNative = false
  }
  if (selectNativeEffortItem(id)) {
    done()
    return true
  }
  clickElement(trigger)
  if (selectNativeEffortItem(id)) {
    done()
    return true
  }
  window.setTimeout(() => {
    selectNativeEffortItem(id)
    done()
  }, 0)
  return true
}

function applyComposerVariant(view: any, id: string | undefined) {
  const next = normalizeEffortId(id)
  if (view?.setVariant) {
    const ok = view.setVariant(next)
    if (ok !== false && (nativeEffortMatches(next) || !findNativeEffortTrigger())) return true
  }
  const selected = view?.model?.()
  if (selected?.providerID && selected?.modelID && next !== undefined && view?.setModel) {
    const ok = view.setModel({
      providerID: selected.providerID,
      modelID: selected.modelID,
      variant: next,
    })
    if (ok !== false && (nativeEffortMatches(next) || !findNativeEffortTrigger())) return true
  }
  return applyNativeEffort(next)
}

const HOST_CLASS = "oces-host"
let dockOwner = false

function ensureHost(anchor: { parent: Element; before?: Element | null }) {
  const parent = anchor.parent
  let host = parent.querySelector(`:scope > .${HOST_CLASS}`) as HTMLElement | null
  if (!host) {
    host = document.createElement("span")
    host.className = HOST_CLASS
    host.setAttribute("data-oces-host", "")
  }
  const before = anchor.before ?? null
  if (host.parentElement !== parent || host.nextElementSibling !== before) {
    parent.insertBefore(host, before)
  }
  document.querySelectorAll(`.${HOST_CLASS}`).forEach((node) => {
    if (node !== host) node.remove()
  })
  return host
}

function placeHost() {
  const composer = findVisibleComposer()
  if (!composer) return undefined
  const send = findSendButton(composer)
  if (send?.parentElement && isShown(send)) {
    return ensureHost({ parent: send.parentElement, before: send })
  }
  const footer = findComposerFooter(composer)
  if (!footer) return undefined
  return ensureHost({ parent: footer })
}

function unwrapList(response: any) {
  if (Array.isArray(response)) return response
  if (Array.isArray(response?.data)) return response.data
  return []
}

function scrapeEffortLabel(composer = findVisibleComposer()) {
  const controls = composer?.querySelector("[data-slot='composer-controls']")
  if (!controls) return undefined
  for (const button of actionButtons(controls)) {
    const text = effortText(button)
    if (EFFORT_RE.test(text)) return text
  }
  return undefined
}

function scrapeControlLabels(composer = findVisibleComposer()) {
  const roots = [
    composer?.querySelector("[data-slot='composer-controls']"),
    composer,
  ].filter(Boolean) as Element[]
  const labels: string[] = []
  const seen = new Set<string>()
  for (const root of roots) {
    for (const button of actionButtons(root)) {
      const text = effortText(button)
      if (!text || seen.has(text)) continue
      seen.add(text)
      labels.push(text)
    }
  }
  return labels
}

async function loadModelList(client: any, directory?: string) {
  const query = directory ? { location: { directory } } : undefined
  return unwrapList(await client.model.list(query))
}

function resolveListedModel(listed: any[], selected?: { providerID?: string; modelID?: string; id?: string }) {
  const matched = pickListedModel(listed, selected)
  if (matched) return matched
  if (selected?.modelID) return undefined
  return matchModelFromLabels(listed, scrapeControlLabels())
}

function variantIds(model: any) {
  return idsFromVariants(model?.variants)
}

function selectionKey(selected?: { providerID?: string; modelID?: string }) {
  if (!selected?.modelID) return ""
  return `${selected.providerID || ""}::${selected.modelID}`
}

const UNSET = Symbol("oces-pending-unset")

function Slider(props: { context: any }) {
  const [variants, setVariants] = createSignal<string[]>([])
  const [visual, setVisual] = createSignal(0)
  const [dragging, setDragging] = createSignal(false)
  const [pending, setPending] = createSignal<string | undefined | typeof UNSET>(UNSET)
  const [nonce, setNonce] = createSignal(0)
  const [boundKey, setBoundKey] = createSignal("")
  let track: HTMLDivElement | undefined

  const session = () => props.context.sessions.current()
  const composer = () => props.context.screen.current()?.composer
  const model = () => composer()?.model()
  const current = () => {
    const hold = pending()
    if (hold !== UNSET) return hold
    if (model()) return model()?.variant
    return scrapeEffortLabel()
  }

  createEffect(() => {
    const selected = model()
    const directory = session()?.directory
    nonce()
    let cancelled = false
    void (async () => {
      try {
        const listed = await loadModelList(props.context.client, directory)
        if (cancelled) return
        const found = resolveListedModel(listed, selected)
        const next = variantIds(found)
        setVariants((prev) => (prev.join("\0") === next.join("\0") ? prev : next))
        setBoundKey(selectionKey(selected) || (found ? `${found.providerID || ""}::${found.id || found.modelID || ""}` : ""))
      } catch {
        if (!cancelled && !boundKey()) setVariants([])
      }
    })()
    onCleanup(() => {
      cancelled = true
    })
  })

  onMount(() => {
    const timer = window.setInterval(() => {
      const key = selectionKey(model())
      if (key !== boundKey() || variants().length === 0) setNonce((value) => value + 1)
      const hold = pending()
      if (hold === UNSET || dragging()) return
      const view = composer()
      const next = normalizeEffortId(hold)
      if (view?.setVariant && view.setVariant(next) !== false) setPending(UNSET)
      else if (nativeEffortMatches(hold)) setPending(UNSET)
    }, 600)
    onCleanup(() => window.clearInterval(timer))
  })

  createEffect(() => {
    const hold = pending()
    if (hold === UNSET || dragging()) return
    const view = composer()
    const next = normalizeEffortId(hold)
    if (view?.setVariant && view.setVariant(next) !== false) {
      setPending(UNSET)
      return
    }
    if (nativeEffortMatches(hold)) setPending(UNSET)
  })

  const ladder = createMemo(() => effortLadder(variants()))
  const index = createMemo(() => currentIndex(ladder(), current()))
  const targetPct = createMemo(() => pctFromIndex(Math.max(0, index()), ladder().length))
  createEffect(() => {
    if (!dragging()) setVisual(targetPct())
  })

  const pct = createMemo(() => clamp01(visual()))
  const energy = createMemo(() => energyFor(pct()))
  const fillPx = createMemo(() => `calc(${KNOB / 2}px + (100% - ${KNOB}px) * ${pct()})`)
  const stars = createMemo(() => particleCountFor(pct(), 22))
  const speed = createMemo(() => speedFor(pct()))
  const off = createMemo(() => isOffLevel(current()))
  const label = createMemo(() => displayLabel(normalizeEffortId(current())))
  const labelColor = createMemo(() =>
    isDefaultLevel(current()) ? colorForVariant("default", variants()) : valueColorFor(pct(), off()),
  )

  createEffect(() => {
    const list = variants()
    const id = current()
    const paint = () => paintNativeEffort(list, id)
    paint()
    const observer = new MutationObserver(paint)
    observer.observe(document.body, { childList: true, subtree: true })
    onCleanup(() => observer.disconnect())
  })

  const commit = (nextPct: number, fromIndex = index(), persist = false) => {
    const list = ladder()
    if (list.length === 0) return
    const nextIndex = detentTargetIndex(Math.max(0, fromIndex), nextPct, list.length)
    const id = list[nextIndex]
    if (!id) return
    const next = normalizeEffortId(id)
    const now = normalizeEffortId(current())
    if (String(next ?? "") === String(now ?? "") && (!persist || nativeEffortMatches(next))) return
    setPending(next)
    if (!persist) return
    if (applyComposerVariant(composer(), next) || nativeEffortMatches(next)) setPending(UNSET)
  }

  const posFromEvent = (event: PointerEvent) => {
    const rect = track?.getBoundingClientRect()
    if (!rect) return pct()
    const x = event.clientX - rect.left - KNOB / 2
    return clamp01(x / Math.max(1, rect.width - KNOB))
  }

  const onPointerDown = (event: PointerEvent) => {
    event.preventDefault()
    event.stopPropagation()
    track?.setPointerCapture(event.pointerId)
    setDragging(true)
    const next = posFromEvent(event)
    setVisual(next)
    commit(next, index(), false)
  }
  const onPointerMove = (event: PointerEvent) => {
    if (!dragging()) return
    const next = posFromEvent(event)
    setVisual(next)
    commit(next, index(), false)
  }
  const onPointerUp = (event: PointerEvent) => {
    if (!dragging()) return
    const next = posFromEvent(event)
    const snapped = pctFromIndex(detentTargetIndex(Math.max(0, index()), next, ladder().length), ladder().length)
    setVisual(snapped)
    commit(snapped, index(), true)
    setDragging(false)
  }

  return (
    <Show when={variants().length > 0}>
      <div class="oces">
        <div
          ref={track}
          class={`oces-track${dragging() ? " is-dragging" : ""}`}
          data-energy={energy() > 0 ? "1" : "0"}
          role="slider"
          aria-label="Thinking intensity"
          aria-valuemin={0}
          aria-valuemax={Math.max(0, ladder().length - 1)}
          aria-valuenow={Math.max(0, index())}
          aria-valuetext={label()}
          style={{
            "--oces-fill": fillPx(),
            "--oces-fill-bg": fillBackgroundFor(pct()),
            "--oces-energy": String(energy()),
            "--oces-star-opacity": String(starLayerOpacityFor(pct())),
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div class="oces-fill">
            <div class="oces-energy">
              <div class="oces-sweep" />
            </div>
            <div class="oces-stars">
              {PARTICLES.slice(0, stars()).map((star) => {
                const duration = starDurationFor(star.id, speed())
                return (
                  <span
                    class="oces-star"
                    style={{
                      top: `${star.y}%`,
                      "animation-duration": `${duration}s`,
                      "animation-delay": `${starDelayFor(star.id, duration)}s`,
                      "--oces-b": String(star.brightness),
                    }}
                  >
                    <span class="oces-star-dot" />
                  </span>
                )
              })}
            </div>
          </div>
          <div class="oces-ticks">
            {ladder().map((_, i) => (
              <span
                class={`oces-tick${i <= Math.max(0, index()) ? " is-on" : ""}`}
                style={{ left: `calc(${KNOB / 2}px + (100% - ${KNOB}px) * ${pctFromIndex(i, ladder().length)})` }}
              />
            ))}
          </div>
          <div class="oces-knob" />
        </div>
        <span class="oces-value" style={{ color: labelColor() || undefined }}>
          {label()}
        </span>
      </div>
    </Show>
  )
}

function Dock(props: { context: any }) {
  const [active, setActive] = createSignal(false)
  const [host, setHost] = createSignal<HTMLElement>()
  onMount(() => {
    if (dockOwner) return
    dockOwner = true
    setActive(true)
    let placing = false
    const place = () => {
      if (placing) return
      placing = true
      try {
        const next = placeHost()
        if (next && host() !== next) setHost(next)
      } finally {
        placing = false
      }
    }
    const observer = new MutationObserver((records) => {
      const ours = (node: Node) =>
        node instanceof Element && (node.classList.contains(HOST_CLASS) || node.closest(".oces, .oces-host"))
      if (records.every((record) => [...record.addedNodes, ...record.removedNodes].every(ours))) return
      place()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    const timer = window.setInterval(place, 500)
    place()
    onCleanup(() => {
      observer.disconnect()
      window.clearInterval(timer)
      document.querySelectorAll(`.${HOST_CLASS}`).forEach((node) => node.remove())
      setHost(undefined)
      setActive(false)
      dockOwner = false
    })
  })
  return (
    <Show when={active() && host()}>
      {(node) => (
        <Portal mount={node()}>
          <Slider context={props.context} />
        </Portal>
      )}
    </Show>
  )
}

export default Plugin.define({
  i18n: {
    en: {
      "command.set": "Set thinking intensity",
      "command.up": "Increase thinking intensity",
      "command.down": "Decrease thinking intensity",
      "toast.unavailable": "This model has no thinking-effort variants",
    },
  },
  setup(ctx) {
    ctx.add(Style, CSS)
    ctx.add(Slot, {
      at: "window.bottom",
      order: 5,
      render: () => <Dock context={ctx} />,
    })

    const variantsFor = async () => {
      const session = ctx.sessions.current()
      const model = ctx.screen.current()?.composer.model()
      try {
        const listed = await loadModelList(ctx.client, session?.directory)
        const found = resolveListedModel(listed, model)
        return {
          model,
          variants: effortLadder(variantIds(found)),
        }
      } catch {
        return { model, variants: [] as string[] }
      }
    }

    const jump = async (delta: number) => {
      const { model, variants } = await variantsFor()
      if (variants.length === 0) {
        ctx.toast.show({ title: ctx.t("command.set"), message: ctx.t("toast.unavailable"), variant: "warning" })
        return
      }
      const at = currentIndex(variants, model?.variant)
      const next = variants[Math.max(0, Math.min(variants.length - 1, (at < 0 ? 0 : at) + delta))]
      if (!next) return
      const value = normalizeEffortId(next)
      if (applyComposerVariant(ctx.screen.current()?.composer, value)) return
      ctx.toast.show({ title: ctx.t("command.set"), message: `Cannot set ${displayLabel(value)}`, variant: "error" })
    }

    ctx.add(Command, () => ({
      id: "effort.up",
      title: ctx.t("command.up"),
      group: "Model",
      bind: "mod+shift+right",
      run: () => void jump(1),
    }))
    ctx.add(Command, () => ({
      id: "effort.down",
      title: ctx.t("command.down"),
      group: "Model",
      bind: "mod+shift+left",
      run: () => void jump(-1),
    }))
  },
})
