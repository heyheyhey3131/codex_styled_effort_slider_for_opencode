/** @jsxImportSource @opentui/solid */
import { Plugin, usePlugin } from "@opencode/plugin/tui"
import { createMemo, Index } from "solid-js"
import {
  barCells,
  currentIndex,
  displayLabel,
  effortLadder,
  idsFromVariants,
  isDefaultLevel,
  isOffLevel,
  normalizeEffortId,
  orderVariants,
  padEffortLabel,
  parseEffortArg,
  pctFromIndex,
  stepVariant,
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
    if (String(next ?? "") === String(normalizeEffortId(selected()) ?? "")) return true
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
  const bar = createMemo(() => barCells(effort.variants().length, effort.index(), 16))
  const labelColor = createMemo(() => {
    const off = isOffLevel(effort.selected())
    const color = valueColorFor(effort.pct(), off)
    return color || effort.context.theme.text.muted
  })
  const pickCell = (variantIndex: number) => {
    const list = effort.variants()
    if (list.length === 0) return
    const id = list[variantIndex]
    if (id) effort.apply(id)
  }
  return (
    <box flexDirection="row" height={1} flexShrink={0} alignItems="center" gap={1}>
      <box flexDirection="row" height={1} flexShrink={0} gap={0}>
        <Index each={bar().cells}>
          {(cell) => (
            <text
              fg={cell().fg}
              bg={cell().bg}
              onMouseDown={() => pickCell(cell().variantIndex)}
              onMouseUp={() => pickCell(cell().variantIndex)}
            >
              {cell().ch}
            </text>
          )}
        </Index>
      </box>
      <text fg={effort.variants().length === 0 ? effort.context.theme.text.muted : labelColor()}>
        {effort.variants().length === 0 ? "—".padEnd(8, " ") : padEffortLabel(effort.selected(), 8)}
      </text>
    </box>
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
      after: "prompt.footer",
      render: () => <EffortBar />,
    })
  },
})
