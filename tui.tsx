/** @jsxImportSource @opentui/solid */
import { Plugin, usePlugin } from "@opencode/plugin/tui"
import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import {
  currentIndex,
  displayLabel,
  effortLadder,
  fillColorFor,
  idsFromVariants,
  isDefaultLevel,
  isOffLevel,
  normalizeEffortId,
  orderVariants,
  parseEffortArg,
  pctFromIndex,
  sparkleFrame,
  stepVariant,
  trackCells,
  valueColorFor,
} from "./effort.mjs"

function listVariants(context: ReturnType<typeof usePlugin>) {
  const selected = context.ui.model.current()
  const fromUi = [...(context.ui.model.variant.list() ?? [])]
  if (fromUi.length > 0) return effortLadder(orderVariants(fromUi))
  if (!selected) return []
  const models = context.data.location.model.list(context.location) ?? []
  const found = models.find(
    (item) =>
      item.providerID === selected.providerID &&
      (item.id === selected.modelID || item.modelID === selected.modelID),
  )
  return effortLadder(idsFromVariants(found?.variants))
}

function useEffort() {
  const context = usePlugin()
  const variants = createMemo(() => listVariants(context))
  const selected = createMemo(() => context.ui.model.current()?.variant)
  const index = createMemo(() => currentIndex(variants(), selected()))
  const pct = createMemo(() => pctFromIndex(index() < 0 ? 0 : index(), variants().length))
  const apply = (id: string | undefined, toast = false) => {
    const next = normalizeEffortId(id)
    const ok = context.ui.model.variant.set(next)
    if (ok === false) {
      context.ui.toast.show({
        message: variants().length === 0 ? "This model has no thinking-effort variants" : `Cannot set ${displayLabel(id)}`,
        variant: "error",
      })
      return false
    }
    if (toast) {
      context.ui.toast.show({
        message: `Thinking ${displayLabel(id)}`,
        variant: "success",
        duration: 1400,
      })
    }
    return true
  }
  const step = (delta: number) => {
    const list = variants()
    if (list.length === 0) {
      context.ui.toast.show({ message: "This model has no thinking-effort variants", variant: "warning" })
      return
    }
    const next = stepVariant(list, selected(), delta)
    if (next) apply(next, true)
  }
  const pick = async () => {
    const list = variants()
    if (list.length === 0) {
      context.ui.toast.show({ message: "This model has no thinking-effort variants", variant: "warning" })
      return
    }
    const choice = await context.ui.dialog.select<string | undefined>({
      title: "Thinking intensity",
      current: selected() ?? "",
      options: [
        { title: "Default (model)", value: "", description: "Provider default effort" },
        ...list.filter((id) => !isDefaultLevel(id)).map((id) => ({
          title: displayLabel(id),
          value: id,
          description: isOffLevel(id) ? "Reasoning off" : `Effort ${id}`,
        })),
      ],
    })
    if (choice === undefined) return
    apply(choice === "" ? undefined : choice, true)
  }
  const runSlash = async (input?: string) => {
    const parsed = parseEffortArg(input, variants())
    if (parsed.action === "pick") return pick()
    if (parsed.action === "step") return step(parsed.delta)
    if (parsed.action === "set") return apply(parsed.id, true)
    context.ui.toast.show({
      message: `Unknown effort "${parsed.raw}". Try /effort high or /effort +`,
      variant: "warning",
    })
  }
  return { context, variants, selected, index, pct, apply, step, pick, runSlash }
}

function EffortBar() {
  const effort = useEffort()
  const [frame, setFrame] = createSignal(0)
  onMount(() => {
    const timer = setInterval(() => setFrame((value) => value + 1), 280)
    onCleanup(() => clearInterval(timer))
  })
  const track = createMemo(() => trackCells(effort.variants().length, effort.index(), 18))
  const labelColor = createMemo(() => {
    const off = isOffLevel(effort.selected())
    const color = valueColorFor(effort.pct(), off)
    return color || effort.context.theme.text.muted
  })
  const sparkle = createMemo(() => sparkleFrame(frame(), track().energy))
  const empty = createMemo(() => effort.variants().length === 0)
  return (
    <box flexDirection="row" gap={1} paddingX={1} alignItems="center" onMouseUp={() => void effort.pick()}>
      <text fg={effort.context.theme.text.muted}>think</text>
      <Show
        when={!empty()}
        fallback={
          <text fg={effort.context.theme.text.muted} onMouseUp={() => void effort.pick()}>
            ●━━━━━━━━━━━━━━━━
          </text>
        }
      >
        <box flexDirection="row">
          <For each={track().cells}>
            {(cell) => (
              <text
                fg={cell.fg ?? effort.context.theme.text.muted}
                onMouseDown={() => effort.apply(effort.variants()[cell.variantIndex])}
                onMouseUp={() => effort.apply(effort.variants()[cell.variantIndex])}
              >
                {cell.ch}
              </text>
            )}
          </For>
        </box>
      </Show>
      <text fg={empty() ? effort.context.theme.text.muted : labelColor()} onMouseUp={() => void effort.pick()}>
        {empty() ? "—" : displayLabel(effort.selected())}
      </text>
      <Show when={sparkle()}>
        {(glyph) => <text fg={fillColorFor(effort.pct())}>{glyph()}</text>}
      </Show>
    </box>
  )
}

function HomeBar() {
  const context = usePlugin()
  return (
    <Show when={context.ui.router.current().type === "home"}>
      <EffortBar />
    </Show>
  )
}

function SessionBar() {
  const context = usePlugin()
  return (
    <Show when={context.ui.router.current().type !== "home"}>
      <EffortBar />
    </Show>
  )
}

function EffortStatus() {
  const effort = useEffort()
  const color = createMemo(() => {
    const off = isOffLevel(effort.selected())
    return valueColorFor(effort.pct(), off) || effort.context.theme.text.muted
  })
  return (
    <text fg={effort.variants().length > 0 ? color() : effort.context.theme.text.muted} onMouseUp={() => void effort.pick()}>
      {effort.variants().length > 0 ? displayLabel(effort.selected()) : "think"}
    </text>
  )
}

function commandsFor(context: Parameters<NonNullable<Parameters<typeof Plugin.define>[0]["setup"]>>[0]) {
  const runSlash = async (input?: string) => {
    const variants = listVariants(context as any)
    const selected = context.ui.model.current()?.variant
    const parsed = parseEffortArg(input, variants)
    const apply = (id: string | undefined) => {
      const ok = context.ui.model.variant.set(normalizeEffortId(id))
      if (ok === false) {
        context.ui.toast.show({
          message: variants.length === 0 ? "This model has no thinking-effort variants" : `Cannot set ${displayLabel(id)}`,
          variant: "error",
        })
        return
      }
      context.ui.toast.show({
        message: `Thinking ${displayLabel(id)}`,
        variant: "success",
        duration: 1400,
      })
    }
    if (parsed.action === "pick") {
      if (variants.length === 0) {
        context.ui.toast.show({ message: "This model has no thinking-effort variants", variant: "warning" })
        return
      }
      const choice = await context.ui.dialog.select<string | undefined>({
        title: "Thinking intensity",
        current: selected ?? "",
        options: [
          { title: "Default (model)", value: "", description: "Provider default effort" },
          ...variants.filter((id) => !isDefaultLevel(id)).map((id) => ({
            title: displayLabel(id),
            value: id,
            description: isOffLevel(id) ? "Reasoning off" : `Effort ${id}`,
          })),
        ],
      })
      if (choice === undefined) return
      apply(choice === "" ? undefined : choice)
      return
    }
    if (parsed.action === "step") {
      const next = stepVariant(variants, selected, parsed.delta)
      if (next) apply(next)
      return
    }
    if (parsed.action === "set") {
      apply(parsed.id)
      return
    }
    context.ui.toast.show({
      message: `Unknown effort "${parsed.raw}". Try /effort high or /effort +`,
      variant: "warning",
    })
  }
  const step = (delta: number) => {
    const variants = listVariants(context as any)
    const next = stepVariant(variants, context.ui.model.current()?.variant, delta)
    if (!next) {
      context.ui.toast.show({ message: "This model has no thinking-effort variants", variant: "warning" })
      return
    }
    const ok = context.ui.model.variant.set(normalizeEffortId(next))
    if (ok === false) {
      context.ui.toast.show({ message: `Cannot set ${displayLabel(next)}`, variant: "error" })
      return
    }
    context.ui.toast.show({ message: `Thinking ${displayLabel(next)}`, variant: "success", duration: 1400 })
  }
  return [
    {
      id: "codex-effort-slider.set",
      title: "Set thinking intensity",
      group: "Model",
      palette: true,
      slash: { name: "effort", aliases: ["thinking", "reason"], arguments: true },
      run: (input?: string) => void runSlash(input),
    },
    {
      id: "codex-effort-slider.down",
      title: "Decrease thinking intensity",
      group: "Model",
      bind: "ctrl+shift+left",
      palette: true,
      run: () => step(-1),
    },
    {
      id: "codex-effort-slider.up",
      title: "Increase thinking intensity",
      group: "Model",
      bind: "ctrl+shift+right",
      palette: true,
      run: () => step(1),
    },
  ]
}

export default Plugin.define({
  id: "codex-effort-slider",
  async setup(context) {
    try {
      await context.data.location.model.sync(context.location)
    } catch {
      // Catalog sync is best-effort; the UI list still works without it.
    }

    context.keymap.layer(() => ({
      mode: "global",
      priority: 10,
      commands: commandsFor(context),
      bindings: ["codex-effort-slider.set", "codex-effort-slider.down", "codex-effort-slider.up"],
    }))

    context.ui.slot({
      before: "prompt.footer",
      render: () => <SessionBar />,
    })
    context.ui.slot({
      append: "session.composer.top",
      render: () => <SessionBar />,
    })
    context.ui.slot({
      append: "home.footer",
      render: () => <HomeBar />,
    })
    context.ui.slot({
      append: "prompt.footer.status",
      render: () => <EffortStatus />,
    })
    context.ui.slot({
      append: "home.footer.status",
      render: () => <EffortStatus />,
    })
  },
})
