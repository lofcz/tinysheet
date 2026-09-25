/**
 * UI primitives of the TinySheet chrome (docs/DESIGN.md): Fika's ink /
 * nordic look, themed with the `--ts-*` tokens (Workbook/index.css), with
 * a11y roles and keyboard support. Build new ribbon commands, panes and
 * dialogs from these instead of ad-hoc markup.
 *
 *   import { IconButton, SplitButton, LargeButton, DropdownMenu, Popover,
 *     Tooltip, Tabs, Select, Combo, Input, NumberInput, Checkbox, Switch,
 *     Separator, Button, DialogShell, Dialog, Icon } from "../ui";
 */
// ui.css is imported by each primitive: an import of this re-export
// module alone may be dropped by bundlers (sideEffects).

export {
  Button,
  IconButton,
  SplitButton,
  LargeButton,
  MenuButton,
} from "./Button";
export type {
  ButtonProps,
  IconButtonProps,
  SplitButtonProps,
  LargeButtonProps,
  MenuButtonProps,
} from "./Button";
export { MenuList, DropdownMenu, useMenuTrigger } from "./Menu";
export type { MenuItem, MenuListProps, DropdownMenuProps } from "./Menu";
export { Popover } from "./Popover";
export type { PopoverProps } from "./Popover";
export { Tooltip } from "./Tooltip";
export type { TooltipProps } from "./Tooltip";
export { Tabs } from "./Tabs";
export type { TabItem, TabsProps } from "./Tabs";
export { Select, Combo } from "./Select";
export type { SelectOption, SelectProps, ComboProps } from "./Select";
export { Input, NumberInput } from "./Input";
export type { InputProps, NumberInputProps } from "./Input";
export { Checkbox, Switch, Separator } from "./Controls";
export type { CheckboxProps, SwitchProps } from "./Controls";
export { DialogShell, Dialog } from "./Dialog";
export type { DialogShellProps, DialogProps } from "./Dialog";
export {
  Icon,
  registerIcon,
  getIcon,
  ICON_SIZE,
  ICON_LARGE_SIZE,
  ICON_STROKE,
} from "./icons";
export type { LucideIcon } from "./icons";
export {
  computePosition,
  useFloatingPosition,
  portalRootFor,
  VIEWPORT_EDGE,
} from "./floating";
export type { Placement } from "./floating";
