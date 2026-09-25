# Keyboard shortcuts

TinySheet follows Excel's keyboard model. On macOS, use <kbd>Cmd</kbd>
wherever the table says <kbd>Ctrl</kbd>. Shortcuts apply while the sheet has
focus; <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd> moves focus between the
sheet and the toolbar.

## Moving around

| Shortcut | Action |
| --- | --- |
| <kbd>Arrow keys</kbd> | Move the active cell |
| <kbd>Ctrl</kbd>+<kbd>Arrow</kbd> | Jump to the edge of the current data region |
| <kbd>Enter</kbd> / <kbd>Shift</kbd>+<kbd>Enter</kbd> | Move down / up (wraps inside a multi-cell selection) |
| <kbd>Tab</kbd> / <kbd>Shift</kbd>+<kbd>Tab</kbd> | Move right / left (wraps inside a multi-cell selection) |
| <kbd>Home</kbd> | Go to the first column of the row |
| <kbd>Ctrl</kbd>+<kbd>Home</kbd> | Go to A1 |
| <kbd>Ctrl</kbd>+<kbd>End</kbd> | Go to the last used cell |
| <kbd>PageDown</kbd> / <kbd>PageUp</kbd> | Move one screen down / up |
| <kbd>Alt</kbd>+<kbd>PageDown</kbd> / <kbd>Alt</kbd>+<kbd>PageUp</kbd> | Move one screen right / left |
| <kbd>Ctrl</kbd>+<kbd>PageDown</kbd> / <kbd>Ctrl</kbd>+<kbd>PageUp</kbd> | Next / previous sheet |
| <kbd>Ctrl</kbd>+<kbd>Backspace</kbd> | Scroll the active cell into view |

## Selecting

| Shortcut | Action |
| --- | --- |
| <kbd>Shift</kbd>+<kbd>Arrow</kbd> | Extend the selection by one cell |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Arrow</kbd> | Extend the selection to the edge of the data region |
| <kbd>Shift</kbd>+<kbd>Home</kbd> | Extend to the first column |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Home</kbd> / <kbd>End</kbd> | Extend to A1 / to the last used cell |
| <kbd>Shift</kbd>+<kbd>PageDown</kbd> / <kbd>PageUp</kbd> | Extend one screen down / up |
| <kbd>Ctrl</kbd>+<kbd>A</kbd> | Select the current region, then the whole sheet |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Space</kbd> | Same as <kbd>Ctrl</kbd>+<kbd>A</kbd> |
| <kbd>Ctrl</kbd>+<kbd>Space</kbd> | Select entire columns |
| <kbd>Shift</kbd>+<kbd>Space</kbd> | Select entire rows |

## Editing

| Shortcut | Action |
| --- | --- |
| Any character | Replace the active cell's content and start editing |
| <kbd>F2</kbd> | Edit the active cell |
| <kbd>Enter</kbd> | Commit and move down |
| <kbd>Tab</kbd> | Commit and move right |
| <kbd>Ctrl</kbd>+<kbd>Enter</kbd> | Commit the entry into every cell of the selection |
| <kbd>Alt</kbd>+<kbd>Enter</kbd> | New line inside the cell |
| <kbd>Esc</kbd> | Cancel editing |
| <kbd>F4</kbd> | While editing a formula, cycle the reference under the caret: `A1` → `$A$1` → `A$1` → `$A1` |
| <kbd>Delete</kbd> | Clear the contents of the selection (formats are kept) |
| <kbd>Backspace</kbd> | Clear the active cell and start editing it |
| <kbd>Ctrl</kbd>+<kbd>;</kbd> | Insert today's date |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>;</kbd> | Insert the current time |
| <kbd>Ctrl</kbd>+<kbd>D</kbd> / <kbd>Ctrl</kbd>+<kbd>R</kbd> | Fill down / right from the first row / column of the selection |
| <kbd>Ctrl</kbd>+<kbd>Z</kbd> | Undo |
| <kbd>Ctrl</kbd>+<kbd>Y</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> | Redo |

While typing a formula, a list of matching functions appears: use
<kbd>Up</kbd>/<kbd>Down</kbd> to choose and <kbd>Tab</kbd> or <kbd>Enter</kbd>
to insert the function and its opening parenthesis. Inside the parentheses a
hint card shows the function's arguments, with the current one highlighted.

## Clipboard

| Shortcut | Action |
| --- | --- |
| <kbd>Ctrl</kbd>+<kbd>C</kbd> | Copy |
| <kbd>Ctrl</kbd>+<kbd>X</kbd> | Cut |
| <kbd>Ctrl</kbd>+<kbd>V</kbd> | Paste (formulas copied within the workbook keep relative references) |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> | Paste as plain text |

## Formatting

| Shortcut | Action |
| --- | --- |
| <kbd>Ctrl</kbd>+<kbd>B</kbd> | Bold |
| <kbd>Ctrl</kbd>+<kbd>I</kbd> | Italic |
| <kbd>Ctrl</kbd>+<kbd>U</kbd> | Underline |
| <kbd>Ctrl</kbd>+<kbd>5</kbd> | Strikethrough |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>~</kbd> | General number format |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>!</kbd> | Number with two decimals and separators (`#,##0.00`) |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>@</kbd> | Time (`hh:mm AM/PM`) |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>#</kbd> | Date (`yyyy-MM-dd`) |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>$</kbd> | Currency |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>%</kbd> | Percentage (`0%`) |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>^</kbd> | Scientific (`0.00E+00`) |

Bold, italic, underline and strikethrough also apply to selected text while
editing a cell.

## Rows, columns and view

| Shortcut | Action |
| --- | --- |
| <kbd>Ctrl</kbd>+<kbd>-</kbd> | Delete the selected entire rows or columns |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>=</kbd> (<kbd>Ctrl</kbd>+<kbd>+</kbd>) | Insert rows or columns before the selected entire rows or columns |
| <kbd>Ctrl</kbd>+<kbd>9</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>9</kbd> | Hide / unhide rows in the selection |
| <kbd>Ctrl</kbd>+<kbd>0</kbd> / <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>0</kbd> | Hide / unhide columns in the selection |
| <kbd>Ctrl</kbd>+<kbd>+</kbd> / <kbd>Ctrl</kbd>+<kbd>-</kbd> | Zoom in / out (when no entire rows or columns are selected) |
| <kbd>Ctrl</kbd>+<kbd>F</kbd> | Find |
| <kbd>Ctrl</kbd>+<kbd>H</kbd> | Replace |
