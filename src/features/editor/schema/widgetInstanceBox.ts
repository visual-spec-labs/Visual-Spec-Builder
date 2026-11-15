import type { Box, ScreenSpec } from './types';

/** Placement defaults are not the widget editing canvas dimensions. Legacy widgets
 * have no recorded extraction modes; preserve their existing fixed-size behavior. */
export function widgetInstanceBox(widget: ScreenSpec): Box {
  return structuredClone(widget.defaultInstanceBox ?? widget.size);
}
