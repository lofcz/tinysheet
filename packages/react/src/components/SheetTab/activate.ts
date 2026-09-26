import {
  Context,
  GlobalCache,
  cancelActiveImgItem,
  cancelNormalSelected,
  getSheetIndex,
  onSheetTabActivated,
  updateCell,
} from "@lofcz/tinysheet-core";

/**
 * Shows `sheetId` like a click on its tab: grouping is updated (Excel keeps
 * the group when the sheet is in it), the view of the sheet being left is
 * remembered (SheetTab restores the view of the sheet being shown) and
 * sheet-level UI state (an active image, the editor) is dropped. An entry
 * being typed in `cellInput` is committed first (Excel).
 */
export function activateSheetTab(
  draftCtx: Context,
  sheetId: string,
  globalCache: GlobalCache,
  cellInput?: HTMLDivElement | null
) {
  onSheetTabActivated(draftCtx, sheetId);
  if (draftCtx.currentSheetId === sheetId) return;
  const index = getSheetIndex(draftCtx, sheetId);
  if (index == null) return;
  const sheet = draftCtx.luckysheetfile[index];
  if (cellInput && draftCtx.luckysheetCellUpdate.length > 0) {
    const [r, c] = draftCtx.luckysheetCellUpdate;
    updateCell(draftCtx, r, c, cellInput);
  }
  draftCtx.sheetScrollRecord[draftCtx.currentSheetId] = {
    scrollLeft: draftCtx.scrollLeft,
    scrollTop: draftCtx.scrollTop,
    luckysheet_select_status: draftCtx.luckysheet_select_status,
    luckysheet_select_save: draftCtx.luckysheet_select_save,
    luckysheet_selection_range: draftCtx.luckysheet_selection_range,
  };
  draftCtx.dataVerificationDropDownList = false;
  draftCtx.currentSheetId = sheetId;
  draftCtx.zoomRatio = sheet.zoomRatio || 1;
  cancelActiveImgItem(draftCtx, globalCache);
  cancelNormalSelected(draftCtx);
}

/**
 * Restores the remembered view (scroll position and selection) of the sheet
 * that just became active, or starts it at A1.
 */
export function restoreSheetView(draftCtx: Context) {
  // leaving Point mode across sheets already restored the edited cell's
  // sheet (and a commit may have moved its selection since)
  if (draftCtx.sheetScrollRestoredFor === draftCtx.currentSheetId) return;
  draftCtx.sheetScrollRestoredFor = undefined;
  const r = draftCtx.sheetScrollRecord?.[draftCtx.currentSheetId];
  if (r) {
    draftCtx.scrollLeft = r.scrollLeft ?? 0;
    draftCtx.scrollTop = r.scrollTop ?? 0;
    draftCtx.luckysheet_select_status = r.luckysheet_select_status ?? false;
    draftCtx.luckysheet_select_save = r.luckysheet_select_save ?? undefined;
  } else {
    draftCtx.scrollLeft = 0;
    draftCtx.scrollTop = 0;
    draftCtx.luckysheet_select_status = false;
    draftCtx.luckysheet_select_save = undefined;
  }
  draftCtx.luckysheet_selection_range = [];
}
