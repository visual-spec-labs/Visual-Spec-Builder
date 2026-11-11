import type { NodeStates } from "@/features/editor/schema";

/** DOM hooks consumed by index.css; styles alone only provide the state variables. */
export function controlStateProps(states: NodeStates | undefined) {
  return {
    className: "vs-control-node",
    "data-vs-hover-background": states?.hover?.background !== undefined || undefined,
    "data-vs-hover-color": states?.hover?.color !== undefined || undefined,
    "data-vs-hover-border": states?.hover?.borderColor !== undefined || undefined,
    "data-vs-focus-background": states?.focus?.background !== undefined || undefined,
    "data-vs-focus-color": states?.focus?.color !== undefined || undefined,
    "data-vs-focus-border": states?.focus?.borderColor !== undefined || undefined,
    "data-vs-pressed-background": states?.pressed?.background !== undefined || undefined,
    "data-vs-pressed-color": states?.pressed?.color !== undefined || undefined,
    "data-vs-pressed-border": states?.pressed?.borderColor !== undefined || undefined,
  };
}
