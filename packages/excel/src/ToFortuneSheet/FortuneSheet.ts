import {
  IfortuneImageBorder,
  IfortuneImageCrop,
  IfortuneImageDefault,
  IfortuneImages,
  IfortuneSheetCelldata,
  IfortuneSheetCelldataValue,
  IMapfortuneSheetborderInfoCellForImp,
  IfortuneSheetborderInfoCellValue,
  IfortuneSheetborderInfoCellValueStyle,
  IFormulaSI,
  IfortuneSheetRowAndColumnLen,
  IfortuneSheetRowAndColumnHidden,
  IfortuneSheetSelection,
  IcellOtherInfo,
  IformulaList,
  IformulaListItem,
  IfortunesheetHyperlink,
  IfortunesheetHyperlinkType,
  IfortunesheetDataVerification,
} from "./IFortune";
import {
  FortuneSheetCelldata,
  FortuneCellWorkbookInfo,
} from "./FortuneCell";
import { shiftFormula } from "../common/formulaText";
import { IattributeList } from "../common/ICommon";
import {
  getXmlAttibute,
  getColumnWidthPixel,
  fromulaRef,
  getRowHeightPixel,
  getcellrange,
  generateRandomIndex,
  getPxByEMUs,
  getMultiSequenceToNum,
  getTransR1C1ToSequence,
  getPeelOffX14,
  getMultiFormulaValue,
  escapeCharacter,
} from "../common/method";
import {
  borderTypes,
  COMMON_TYPE2,
  DATA_VERIFICATION_MAP,
  DATA_VERIFICATION_TYPE2_MAP,
  worksheetFilePath,
} from "../common/constant";
import { ReadXml, IStyleCollections, Element, getColor } from "./ReadXml";
import {
  FortuneFileBase,
  FortuneSheetBase,
  FortuneConfig,
  FortuneSheetborderInfoCellForImp,
  FortuneSheetborderInfoCellValue,
  FortunesheetCalcChain,
  FortuneSheetConfigMerge,
  FortuneSheetCelldataValue,
} from "./FortuneBase";
import { ImageList } from "./FortuneImage";
import dayjs from "dayjs";
import {
  FortuneChartSpec,
  FortuneChartSeriesSpec,
  ChartCellResolver,
  DEFAULT_CHART_COLORS,
  parseChartNumber,
  renderChartSvgFromSeries,
  resolveChartSpecToSeries,
  svgToDataUri as chartSvgToDataUri,
  escapeXml as chartEscapeXml,
  roundSvgNumber as chartRoundSvgNumber,
} from "../chart";

interface DrawingAnchorRect {
  fromCol: number;
  fromColOff: number;
  fromRow: number;
  fromRowOff: number;
  toCol: number;
  toColOff: number;
  toRow: number;
  toRowOff: number;
  width: number;
  height: number;
  type: string;
}

interface DrawingCellAnchor {
  index: number;
  offset: number;
}

interface DrawingRelationship {
  id: string;
  target: string;
  type: string;
}

interface ShapeRenderItem {
  x: number;
  y: number;
  width: number;
  height: number;
  geometry: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  text: string;
  fontSize: number;
}

/** Excel's default column width for Calibri 11 (8.43 characters + padding). */
const EXCEL_DEFAULT_COLUMN_WIDTH = 9.140625;

/** TinySheet's own default sizes (px); sheet defaults close to these are not materialised. */
const TINYSHEET_COLUMN_WIDTH = 73;
const TINYSHEET_ROW_HEIGHT = 19;

/** `<pane xSplit ySplit state="frozen">` -> TinySheet `frozen`. */
export function frozenFromPane(panes: Element[] | null) {
  if (panes == null || panes.length == 0) return undefined;
  const attrList = panes[0].attributeList;
  const state = getXmlAttibute(attrList, "state", "split");
  if (state != "frozen" && state != "frozenSplit") return undefined;
  const xSplit = Math.round(parseFloat(getXmlAttibute(attrList, "xSplit", "0")));
  const ySplit = Math.round(parseFloat(getXmlAttibute(attrList, "ySplit", "0")));
  if (!(xSplit > 0) && !(ySplit > 0)) return undefined;
  const range = {
    row_focus: ySplit > 0 ? ySplit - 1 : 0,
    column_focus: xSplit > 0 ? xSplit - 1 : 0,
  };
  const type: "rangeRow" | "rangeColumn" | "rangeBoth" =
    xSplit > 0 && ySplit > 0 ? "rangeBoth" : ySplit > 0 ? "rangeRow" : "rangeColumn";
  return { type, range };
}

/** Excel data-validation operators -> TinySheet `type2`. */
const DV_OPERATORS: Record<string, string> = {
  between: "between",
  notBetween: "notBetween",
  equal: "equal",
  notEqual: "notEqualTo",
  greaterThan: "moreThanThe",
  lessThan: "lessThan",
  greaterThanOrEqual: "greaterOrEqualTo",
  lessThanOrEqual: "lessThanOrEqualTo",
};

const DV_DATE_OPERATORS: Record<string, string> = {
  between: "between",
  notBetween: "notBetween",
  equal: "equal",
  notEqual: "notEqualTo",
  greaterThan: "laterThan",
  lessThan: "earlierThan",
  greaterThanOrEqual: "noEarlierThan",
  lessThanOrEqual: "noLaterThan",
};

export class FortuneSheet extends FortuneSheetBase {
  private readXml: ReadXml;
  private sheetFile: string;
  private isInitialCell: boolean;
  private styles: IStyleCollections;
  private sharedStrings: Element[];
  private mergeCells: Element[];
  private calcChainEles: Element[];
  private sheetList: IattributeList;

  private imageList: ImageList;

  private formulaRefList: IFormulaSI;
  private workbookInfo: FortuneCellWorkbookInfo;
  private customDefaultRowHeight: boolean;
  private customDefaultColWidth: boolean;
  private arrayFormulaCells: FortuneSheetCelldata[] = [];

  /** Excel frozen panes, in TinySheet's model. */
  frozen?: {
    type: "rangeRow" | "rangeColumn" | "rangeBoth";
    range: { row_focus: number; column_focus: number };
  };

  constructor(
    sheetName: string,
    sheetId: string,
    sheetOrder: number,
    isInitialCell: boolean = false,
    allFileOption: any
  ) {
    //Private
    super();
    this.isInitialCell = isInitialCell;

    this.readXml = allFileOption.readXml;
    this.sheetFile = allFileOption.sheetFile;
    this.styles = allFileOption.styles;
    this.sharedStrings = allFileOption.sharedStrings;
    this.calcChainEles = allFileOption.calcChain;
    this.sheetList = allFileOption.sheetList;
    this.imageList = allFileOption.imageList;
    this.hide = allFileOption.hide;
    this.workbookInfo = allFileOption.workbookInfo || {};

    //Output
    this.name = sheetName;
    this.id = sheetId;
    this.order = sheetOrder.toString();
    this.config = new FortuneConfig();
    this.celldata = [];
    this.mergeCells = this.readXml.getElementsByTagName(
      "mergeCells/mergeCell",
      this.sheetFile
    );
    let clrScheme = this.styles["clrScheme"] as Element[];
    let sheetView = this.readXml.getElementsByTagName(
      "sheetViews/sheetView",
      this.sheetFile
    );
    let showGridLines = "1",
      tabSelected = "0",
      zoomScale = "100",
      activeCell = "A1";
    if (sheetView.length > 0) {
      let attrList = sheetView[0].attributeList;
      showGridLines = getXmlAttibute(attrList, "showGridLines", "1");
      tabSelected = getXmlAttibute(attrList, "tabSelected", "0");
      zoomScale = getXmlAttibute(attrList, "zoomScale", "100");
      // let colorId = getXmlAttibute(attrList, "colorId", "0");
      this.frozen = frozenFromPane(sheetView[0].getInnerElements("pane"));
      let selections = sheetView[0].getInnerElements("selection");
      if (selections != null && selections.length > 0) {
        activeCell = getXmlAttibute(
          selections[0].attributeList,
          "activeCell",
          "A1"
        );
        let range: IfortuneSheetSelection = getcellrange(
          activeCell,
          this.sheetList,
          sheetId
        );
        this.luckysheet_select_save = [];
        this.luckysheet_select_save.push(range);
      }
    }
    this.showGridLines = showGridLines;
    this.status = tabSelected;
    this.zoomRatio = parseInt(zoomScale) / 100;

    let tabColors = this.readXml.getElementsByTagName(
      "sheetPr/tabColor",
      this.sheetFile
    );
    if (tabColors != null && tabColors.length > 0) {
      let tabColor = tabColors[0],
        attrList = tabColor.attributeList;
      // if(attrList.rgb!=null){
      let tc = getColor(tabColor, this.styles, "b");
      this.color = tc;
      // }
    }

    let sheetFormatPr = this.readXml.getElementsByTagName(
      "sheetFormatPr",
      this.sheetFile
    );
    // Excel's defaults (Calibri 11): 8.43 characters (+ padding) and 15pt.
    let defaultColWidth = EXCEL_DEFAULT_COLUMN_WIDTH,
      defaultRowHeight = 15,
      customDefaultHeight = false,
      customDefaultWidth = false;
    if (sheetFormatPr.length > 0) {
      let attrList = sheetFormatPr[0].attributeList;
      let width = parseFloat(getXmlAttibute(attrList, "defaultColWidth", null));
      let base = parseFloat(getXmlAttibute(attrList, "baseColWidth", null));
      let height = parseFloat(
        getXmlAttibute(attrList, "defaultRowHeight", null)
      );
      if (isFinite(width) && width > 0) {
        defaultColWidth = width;
        customDefaultWidth = true;
      } else if (isFinite(base) && base > 0) {
        defaultColWidth = base + (EXCEL_DEFAULT_COLUMN_WIDTH - 8);
        customDefaultWidth = base != 8;
      }
      if (isFinite(height) && height > 0) defaultRowHeight = height;
      customDefaultHeight =
        getXmlAttibute(attrList, "customHeight", "0") == "1" ||
        getXmlAttibute(attrList, "customHeight", "0") == "true";
    }

    this.defaultColWidth = getColumnWidthPixel(defaultColWidth);
    this.defaultRowHeight = getRowHeightPixel(defaultRowHeight);
    this.customDefaultRowHeight = customDefaultHeight;
    this.customDefaultColWidth = customDefaultWidth;

    this.generateConfigColumnLenAndHidden();
    let cellOtherInfo: IcellOtherInfo =
      this.generateConfigRowLenAndHiddenAddCell();

    if (this.calcChain == null) {
      this.calcChain = [];
    }

    let formulaListExist: IformulaList = {};
    for (let c = 0; c < this.calcChainEles.length; c++) {
      let calcChainEle = this.calcChainEles[c],
        attrList = calcChainEle.attributeList;
      if (attrList.i != sheetId) {
        continue;
      }

      let r = attrList.r,
        i = attrList.i,
        l = attrList.l,
        s = attrList.s,
        a = attrList.a,
        t = attrList.t;

      let range = getcellrange(r);
      let chain = new FortunesheetCalcChain();
      chain.r = range.row[0];
      chain.c = range.column[0];
      chain.id = this.id;
      this.calcChain.push(chain);
      formulaListExist["r" + r + "c" + c] = null;
    }

    if (this.formulaRefList != null) {
      for (let key in this.formulaRefList) {
        let funclist = this.formulaRefList[key];
        let mainFunc = funclist["mainRef"];
        if (mainFunc == null) {
          continue;
        }
        let mainCellValue = mainFunc.cellValue;
        let formulaTxt = mainFunc.fv;
        let mainR = mainCellValue.r,
          mainC = mainCellValue.c;
        // let refRange = getcellrange(ref);
        for (let name in funclist) {
          if (name == "mainRef") {
            continue;
          }

          let funcValue = funclist[name],
            cellValue = funcValue.cellValue;
          if (cellValue == null) {
            continue;
          }
          let r = cellValue.r,
            c = cellValue.c;

          if (formulaTxt == null) {
            continue;
          }
          let func = shiftFormula(formulaTxt, r - mainR, c - mainC);
          if (cellValue.v == null || typeof cellValue.v !== "object") {
            cellValue.v = new FortuneSheetCelldataValue();
          }
          (cellValue.v as IfortuneSheetCelldataValue).f = func;

          //添加共享公式链
          let chain = new FortunesheetCalcChain();
          chain.r = cellValue.r;
          chain.c = cellValue.c;
          chain.id = this.id;
          this.calcChain.push(chain);
        }
      }
    }

    //There may be formulas that do not appear in calcChain
    for (let key in cellOtherInfo.formulaList) {
      if (!(key in formulaListExist)) {
        let formulaListItem = cellOtherInfo.formulaList[key];
        let chain = new FortunesheetCalcChain();
        chain.r = formulaListItem.r;
        chain.c = formulaListItem.c;
        chain.id = this.id;
        this.calcChain.push(chain);
      }
    }

    // dataVerification config
    this.dataVerification = this.generateConfigDataValidations();

    // hyperlink config
    this.hyperlink = this.generateConfigHyperlinks();
    this.linkHyperlinkCells();

    // array / dynamic-array formulas: spill anchors and spilled cells
    this.applyArrayFormulas();

    // sheet default width/height for columns and rows without their own
    this.applyDefaultSizes();

    // sheet hide
    this.hide = this.hide;

    if (this.mergeCells != null) {
      for (let i = 0; i < this.mergeCells.length; i++) {
        let merge = this.mergeCells[i],
          attrList = merge.attributeList;
        let ref = attrList.ref;
        if (ref == null) {
          continue;
        }
        let range = getcellrange(ref, this.sheetList, sheetId);
        let mergeValue = new FortuneSheetConfigMerge();
        mergeValue.r = range.row[0];
        mergeValue.c = range.column[0];
        mergeValue.rs = range.row[1] - range.row[0] + 1;
        mergeValue.cs = range.column[1] - range.column[0] + 1;
        if (this.config.merge == null) {
          this.config.merge = {};
        }
        this.config.merge[range.row[0] + "_" + range.column[0]] = mergeValue;
      }
    }

    let drawingFile = allFileOption.drawingFile,
      drawingRelsFile = allFileOption.drawingRelsFile;
    if (drawingFile != null && drawingRelsFile != null) {
      this.generateDrawingImages(drawingFile, drawingRelsFile);
    }
  }

  private generateDrawingImages(drawingFile: string, drawingRelsFile: string) {
    let anchors = this.readXml.getElementsByTagName(
      "xdr:twoCellAnchor|xdr:oneCellAnchor|xdr:absoluteAnchor",
      drawingFile
    );

    if (anchors == null || anchors.length == 0) {
      return;
    }

    for (let i = 0; i < anchors.length; i++) {
      this.addPictureImages(anchors[i], drawingRelsFile);
      this.addShapeImage(anchors[i]);
      this.addChartImage(anchors[i], drawingRelsFile);
    }
  }

  private addPictureImages(anchor: Element, drawingRelsFile: string) {
    let pics = anchor.getInnerElements("xdr:pic");
    if (pics == null || pics.length == 0) {
      return;
    }

    for (let i = 0; i < pics.length; i++) {
      let blips = pics[i].getInnerElements("a:blip");
      if (blips == null || blips.length == 0) {
        continue;
      }

      let rembed =
        getXmlAttibute(blips[0].attributeList, "r:embed", null) ||
        getXmlAttibute(blips[0].attributeList, "ns2:embed", null);
      let imageObject = this.getBase64ByRid(rembed, drawingRelsFile);
      if (imageObject == null) {
        continue;
      }

      this.addDrawingImage(anchor, imageObject);
    }
  }

  private addShapeImage(anchor: Element) {
    let svg = this.renderShapeAnchorSvg(anchor);
    if (svg == null) {
      return;
    }

    this.addDrawingImage(anchor, {
      src: this.svgToDataUri(svg),
    });
  }

  private addChartImage(anchor: Element, drawingRelsFile: string) {
    let graphicFrames = anchor.getInnerElements("xdr:graphicFrame");
    if (graphicFrames == null || graphicFrames.length == 0) {
      return;
    }

    for (let i = 0; i < graphicFrames.length; i++) {
      let charts = graphicFrames[i].getInnerElements("c:chart");
      if (charts == null || charts.length == 0) {
        continue;
      }

      let rid = getXmlAttibute(charts[0].attributeList, "r:id", null);
      let relationship = this.getRelationshipByRid(rid, drawingRelsFile);
      if (relationship == null || relationship.target == null) {
        continue;
      }

      let chartFile = this.normalizeRelationshipTarget(relationship.target);
      if (chartFile == null) {
        continue;
      }

      let rect = this.getAnchorRect(anchor);
      if (rect == null) {
        continue;
      }

      let chartSpec = this.buildChartSpec(chartFile, rect.width, rect.height);
      if (chartSpec == null) {
        continue;
      }

      let series = resolveChartSpecToSeries(
        chartSpec,
        this.createParseCellResolver()
      );
      let svg = renderChartSvgFromSeries(series, chartSpec.width, chartSpec.height, {
        title: chartSpec.title,
        categoryAxisTitle: chartSpec.categoryAxisTitle,
        valueAxisTitle: chartSpec.valueAxisTitle,
        valueAxis: chartSpec.valueAxis,
      });

      this.addDrawingImage(anchor, {
        src: chartSvgToDataUri(svg),
        chartSpec: chartSpec,
      });
    }
  }

  private addDrawingImage(anchor: Element, imageObject: any) {
    let rect = this.getAnchorRect(anchor);
    if (rect == null || imageObject == null || imageObject.src == null) {
      return;
    }

    imageObject.fromCol = rect.fromCol;
    imageObject.fromColOff = rect.fromColOff;
    imageObject.fromRow = rect.fromRow;
    imageObject.fromRowOff = rect.fromRowOff;
    imageObject.toCol = rect.toCol;
    imageObject.toColOff = rect.toColOff;
    imageObject.toRow = rect.toRow;
    imageObject.toRowOff = rect.toRowOff;
    imageObject.originWidth = rect.width;
    imageObject.originHeight = rect.height;
    imageObject.type = rect.type;
    imageObject.isFixedPos = false;
    imageObject.fixedLeft = 0;
    imageObject.fixedTop = 0;

    let imageBorder: IfortuneImageBorder = {
      color: "#000",
      radius: 0,
      style: "solid",
      width: 0,
    };
    imageObject.border = imageBorder;

    let imageCrop: IfortuneImageCrop = {
      height: rect.height,
      offsetLeft: 0,
      offsetTop: 0,
      width: rect.width,
    };
    imageObject.crop = imageCrop;

    let imageDefault: IfortuneImageDefault = {
      height: rect.height,
      left: 0,
      top: 0,
      width: rect.width,
    };
    imageObject.default = imageDefault;

    if (this.images == null) {
      this.images = {};
    }
    this.images[generateRandomIndex("image")] = imageObject;
  }

  private getAnchorRect(anchor: Element): DrawingAnchorRect {
    let anchorType = this.getAnchorType(anchor);
    let fromAnchor: DrawingCellAnchor;
    let toAnchorCol: DrawingCellAnchor;
    let toAnchorRow: DrawingCellAnchor;
    let width = 0;
    let height = 0;
    let type = "1";

    if (anchorType == "twoCell") {
      let xdrFroms = anchor.getInnerElements("xdr:from");
      let xdrTos = anchor.getInnerElements("xdr:to");
      if (
        xdrFroms == null ||
        xdrTos == null ||
        xdrFroms.length == 0 ||
        xdrTos.length == 0
      ) {
        return null;
      }

      let from = this.getAnchorMarker(xdrFroms[0]);
      let to = this.getAnchorMarker(xdrTos[0]);
      fromAnchor = { index: from.col, offset: from.colOff };
      toAnchorCol = { index: to.col, offset: to.colOff };
      toAnchorRow = { index: to.row, offset: to.rowOff };
      width = this.getAxisDistance(
        from.col,
        from.colOff,
        to.col,
        to.colOff,
        "column"
      );
      height = this.getAxisDistance(
        from.row,
        from.rowOff,
        to.row,
        to.rowOff,
        "row"
      );

      let editAs = getXmlAttibute(anchor.attributeList, "editAs", "twoCell");
      if (editAs == "absolute") {
        type = "3";
      } else if (editAs == "oneCell") {
        type = "2";
      }

      return {
        fromCol: from.col,
        fromColOff: from.colOff,
        fromRow: from.row,
        fromRowOff: from.rowOff,
        toCol: to.col,
        toColOff: to.colOff,
        toRow: to.row,
        toRowOff: to.rowOff,
        width: width,
        height: height,
        type: type,
      };
    }

    let size = this.getAnchorSize(anchor);
    if (size == null) {
      return null;
    }

    if (anchorType == "absolute") {
      let positions = anchor.getInnerElements("xdr:pos");
      if (positions == null || positions.length == 0) {
        return null;
      }

      let left = getPxByEMUs(
        parseInt(getXmlAttibute(positions[0].attributeList, "x", "0"))
      );
      let top = getPxByEMUs(
        parseInt(getXmlAttibute(positions[0].attributeList, "y", "0"))
      );
      fromAnchor = this.getAxisAnchorByOffset(left, "column");
      let fromRow = this.getAxisAnchorByOffset(top, "row");
      toAnchorCol = this.getAxisEndAnchor(
        fromAnchor.index,
        fromAnchor.offset,
        size.width,
        "column"
      );
      toAnchorRow = this.getAxisEndAnchor(
        fromRow.index,
        fromRow.offset,
        size.height,
        "row"
      );

      return {
        fromCol: fromAnchor.index,
        fromColOff: fromAnchor.offset,
        fromRow: fromRow.index,
        fromRowOff: fromRow.offset,
        toCol: toAnchorCol.index,
        toColOff: toAnchorCol.offset,
        toRow: toAnchorRow.index,
        toRowOff: toAnchorRow.offset,
        width: size.width,
        height: size.height,
        type: "3",
      };
    }

    let xdrFroms = anchor.getInnerElements("xdr:from");
    if (xdrFroms == null || xdrFroms.length == 0) {
      return null;
    }

    let from = this.getAnchorMarker(xdrFroms[0]);
    toAnchorCol = this.getAxisEndAnchor(
      from.col,
      from.colOff,
      size.width,
      "column"
    );
    toAnchorRow = this.getAxisEndAnchor(
      from.row,
      from.rowOff,
      size.height,
      "row"
    );

    return {
      fromCol: from.col,
      fromColOff: from.colOff,
      fromRow: from.row,
      fromRowOff: from.rowOff,
      toCol: toAnchorCol.index,
      toColOff: toAnchorCol.offset,
      toRow: toAnchorRow.index,
      toRowOff: toAnchorRow.offset,
      width: size.width,
      height: size.height,
      type: "2",
    };
  }

  private getAnchorType(anchor: Element): string {
    // openpyxl emits unprefixed drawing tags in the default xmlns
    if (
      anchor.container.indexOf("xdr:absoluteAnchor") > -1 ||
      anchor.container.indexOf("<absoluteAnchor") > -1
    ) {
      return "absolute";
    }

    if (
      anchor.container.indexOf("xdr:oneCellAnchor") > -1 ||
      anchor.container.indexOf("<oneCellAnchor") > -1
    ) {
      return "oneCell";
    }

    return "twoCell";
  }

  private getAnchorMarker(marker: Element) {
    return {
      col: this.getXdrValue(marker.getInnerElements("xdr:col")) || 0,
      colOff: getPxByEMUs(
        this.getXdrValue(marker.getInnerElements("xdr:colOff")) || 0
      ),
      row: this.getXdrValue(marker.getInnerElements("xdr:row")) || 0,
      rowOff: getPxByEMUs(
        this.getXdrValue(marker.getInnerElements("xdr:rowOff")) || 0
      ),
    };
  }

  private getAnchorSize(anchor: Element) {
    let ext = anchor.getInnerElements("xdr:ext");
    if (ext == null || ext.length == 0) {
      return null;
    }

    return {
      width: getPxByEMUs(
        parseInt(getXmlAttibute(ext[0].attributeList, "cx", "0"))
      ),
      height: getPxByEMUs(
        parseInt(getXmlAttibute(ext[0].attributeList, "cy", "0"))
      ),
    };
  }

  private getAxisEndAnchor(
    index: number,
    offset: number,
    size: number,
    axis: string
  ): DrawingCellAnchor {
    let current = index;
    let remaining = offset + size;
    let guard = 0;

    while (remaining > this.getAxisSize(current, axis) && guard < 20000) {
      let axisSize = this.getAxisSize(current, axis);
      if (axisSize > 0) {
        remaining -= axisSize;
      }
      current++;
      guard++;
    }

    return {
      index: current,
      offset: remaining,
    };
  }

  private getAxisAnchorByOffset(offset: number, axis: string): DrawingCellAnchor {
    let current = 0;
    let remaining = offset;
    let guard = 0;

    while (remaining > this.getAxisSize(current, axis) && guard < 20000) {
      let axisSize = this.getAxisSize(current, axis);
      if (axisSize > 0) {
        remaining -= axisSize;
      }
      current++;
      guard++;
    }

    return {
      index: current,
      offset: remaining,
    };
  }

  private getAxisDistance(
    startIndex: number,
    startOffset: number,
    endIndex: number,
    endOffset: number,
    axis: string
  ) {
    if (endIndex < startIndex) {
      return 0;
    }

    if (endIndex == startIndex) {
      return Math.max(0, endOffset - startOffset);
    }

    let distance = this.getAxisSize(startIndex, axis) - startOffset;
    for (let i = startIndex + 1; i < endIndex; i++) {
      distance += this.getAxisSize(i, axis);
    }
    distance += endOffset;

    return Math.max(0, distance);
  }

  private getAxisSize(index: number, axis: string) {
    let hidden =
      axis == "column" ? this.config.colhidden : this.config.rowhidden;
    let lens = axis == "column" ? this.config.columnlen : this.config.rowlen;
    let defaultSize =
      axis == "column" ? this.defaultColWidth : this.defaultRowHeight;
    let key = index.toString();
    let size = defaultSize;

    if (hidden != null && key in hidden) {
      size = 0;
    } else if (lens != null && key in lens) {
      size = lens[key];
    }

    return Math.round(size + 1);
  }

  private renderShapeAnchorSvg(anchor: Element): string {
    let rect = this.getAnchorRect(anchor);
    if (rect == null || rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    let groups = anchor.getInnerElements("xdr:grpSp");
    let items: ShapeRenderItem[] = [];

    if (groups != null && groups.length > 0) {
      for (let i = 0; i < groups.length; i++) {
        items = items.concat(
          this.getGroupShapeRenderItems(groups[i], rect.width, rect.height)
        );
      }
    } else {
      let shapes = anchor.getInnerElements("xdr:sp");
      if (shapes != null) {
        for (let i = 0; i < shapes.length; i++) {
          let item = this.getShapeRenderItem(shapes[i], 0, 0, 1, 1, rect);
          if (shapes.length == 1) {
            item.x = 0;
            item.y = 0;
            item.width = rect.width;
            item.height = rect.height;
          }
          items.push(item);
        }
      }
    }

    if (items.length == 0) {
      return null;
    }

    let body = "";
    for (let i = 0; i < items.length; i++) {
      body += this.renderShapeItem(items[i]);
    }

    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="' +
      this.roundSvgNumber(rect.width) +
      '" height="' +
      this.roundSvgNumber(rect.height) +
      '" viewBox="0 0 ' +
      this.roundSvgNumber(rect.width) +
      " " +
      this.roundSvgNumber(rect.height) +
      '">' +
      body +
      "</svg>"
    );
  }

  private getGroupShapeRenderItems(
    group: Element,
    width: number,
    height: number
  ): ShapeRenderItem[] {
    let items: ShapeRenderItem[] = [];
    let groupTransform = this.getGroupTransform(group);
    let scaleX = groupTransform.width == 0 ? 1 : width / groupTransform.width;
    let scaleY = groupTransform.height == 0 ? 1 : height / groupTransform.height;
    let shapes = group.getInnerElements("xdr:sp");

    if (shapes == null) {
      return items;
    }

    for (let i = 0; i < shapes.length; i++) {
      items.push(
        this.getShapeRenderItem(
          shapes[i],
          groupTransform.x,
          groupTransform.y,
          scaleX,
          scaleY,
          null
        )
      );
    }

    return items;
  }

  private getGroupTransform(group: Element) {
    let transforms = group.getInnerElements("a:xfrm");
    let transform = transforms != null && transforms.length > 0 ? transforms[0] : null;
    let x = 0,
      y = 0,
      width = 1,
      height = 1;

    if (transform != null) {
      let childOff = transform.getInnerElements("a:chOff");
      let childExt = transform.getInnerElements("a:chExt");
      let off = childOff != null ? childOff : transform.getInnerElements("a:off");
      let ext = childExt != null ? childExt : transform.getInnerElements("a:ext");

      if (off != null && off.length > 0) {
        x = parseInt(getXmlAttibute(off[0].attributeList, "x", "0"));
        y = parseInt(getXmlAttibute(off[0].attributeList, "y", "0"));
      }

      if (ext != null && ext.length > 0) {
        width = parseInt(getXmlAttibute(ext[0].attributeList, "cx", "1"));
        height = parseInt(getXmlAttibute(ext[0].attributeList, "cy", "1"));
      }
    }

    return { x: x, y: y, width: width, height: height };
  }

  private getShapeRenderItem(
    shape: Element,
    originX: number,
    originY: number,
    scaleX: number,
    scaleY: number,
    fallbackRect: DrawingAnchorRect
  ): ShapeRenderItem {
    let shapeRect = this.getShapeTransform(shape);
    let x = (shapeRect.x - originX) * scaleX;
    let y = (shapeRect.y - originY) * scaleY;
    let width = shapeRect.width * scaleX;
    let height = shapeRect.height * scaleY;

    if (fallbackRect != null && (width == 0 || height == 0)) {
      x = 0;
      y = 0;
      width = fallbackRect.width;
      height = fallbackRect.height;
    }

    return {
      x: x,
      y: y,
      width: width,
      height: height,
      geometry: this.getShapeGeometry(shape),
      fill: this.getShapeFill(shape),
      stroke: this.getShapeStroke(shape),
      strokeWidth: this.getShapeStrokeWidth(shape),
      text: this.getShapeText(shape),
      fontSize: this.getShapeFontSize(shape),
    };
  }

  private getShapeTransform(shape: Element) {
    let spPrs = shape.getInnerElements("xdr:spPr");
    let x = 0,
      y = 0,
      width = 0,
      height = 0;

    if (spPrs != null && spPrs.length > 0) {
      let transforms = spPrs[0].getInnerElements("a:xfrm");
      if (transforms != null && transforms.length > 0) {
        let off = transforms[0].getInnerElements("a:off");
        let ext = transforms[0].getInnerElements("a:ext");
        if (off != null && off.length > 0) {
          x = parseInt(getXmlAttibute(off[0].attributeList, "x", "0"));
          y = parseInt(getXmlAttibute(off[0].attributeList, "y", "0"));
        }
        if (ext != null && ext.length > 0) {
          width = parseInt(getXmlAttibute(ext[0].attributeList, "cx", "0"));
          height = parseInt(getXmlAttibute(ext[0].attributeList, "cy", "0"));
        }
      }
    }

    return {
      x: x,
      y: y,
      width: width,
      height: height,
    };
  }

  private getShapeGeometry(shape: Element) {
    let geometries = shape.getInnerElements("a:prstGeom");
    if (geometries == null || geometries.length == 0) {
      return "rect";
    }

    return getXmlAttibute(geometries[0].attributeList, "prst", "rect");
  }

  private getShapeFill(shape: Element) {
    let spPrs = shape.getInnerElements("xdr:spPr");
    if (spPrs == null || spPrs.length == 0) {
      return "#ffffff";
    }

    let solidFills = spPrs[0].getInnerElements("a:solidFill");
    if (solidFills == null || solidFills.length == 0) {
      return "#ffffff";
    }

    return this.getColorFromElement(solidFills[0], "#ffffff");
  }

  private getShapeStroke(shape: Element) {
    let spPrs = shape.getInnerElements("xdr:spPr");
    if (spPrs == null || spPrs.length == 0) {
      return "#000000";
    }

    let lines = spPrs[0].getInnerElements("a:ln");
    if (lines == null || lines.length == 0) {
      return "#000000";
    }

    let noFills = lines[0].getInnerElements("a:noFill");
    if (noFills != null && noFills.length > 0) {
      return "none";
    }

    let solidFills = lines[0].getInnerElements("a:solidFill");
    if (solidFills == null || solidFills.length == 0) {
      return "#000000";
    }

    return this.getColorFromElement(solidFills[0], "#000000");
  }

  private getShapeStrokeWidth(shape: Element) {
    let spPrs = shape.getInnerElements("xdr:spPr");
    if (spPrs == null || spPrs.length == 0) {
      return 1;
    }

    let lines = spPrs[0].getInnerElements("a:ln");
    if (lines == null || lines.length == 0) {
      return 1;
    }

    let width = parseInt(getXmlAttibute(lines[0].attributeList, "w", "9525"));
    return Math.max(1, getPxByEMUs(width));
  }

  private getShapeText(shape: Element) {
    let texts = shape.getInnerElements("a:t");
    if (texts == null || texts.length == 0) {
      return "";
    }

    let text = "";
    for (let i = 0; i < texts.length; i++) {
      text += texts[i].value;
    }

    return this.decodeXml(text);
  }

  private getShapeFontSize(shape: Element) {
    let runProperties = shape.getInnerElements("a:rPr");
    if (runProperties == null || runProperties.length == 0) {
      return 14;
    }

    let size = parseInt(getXmlAttibute(runProperties[0].attributeList, "sz", "1400"));
    if (isNaN(size)) {
      return 14;
    }

    return Math.max(8, Math.round((size / 100) * (96 / 72)));
  }

  private renderShapeItem(item: ShapeRenderItem) {
    let shape = "";
    let fill = this.escapeXml(item.fill);
    let stroke = this.escapeXml(item.stroke);
    let strokeWidth = this.roundSvgNumber(item.strokeWidth);

    if (item.geometry == "ellipse") {
      shape =
        '<ellipse cx="' +
        this.roundSvgNumber(item.x + item.width / 2) +
        '" cy="' +
        this.roundSvgNumber(item.y + item.height / 2) +
        '" rx="' +
        this.roundSvgNumber(item.width / 2) +
        '" ry="' +
        this.roundSvgNumber(item.height / 2) +
        '" fill="' +
        fill +
        '" stroke="' +
        stroke +
        '" stroke-width="' +
        strokeWidth +
        '"/>';
    } else if (item.geometry == "rightArrow") {
      let headWidth = Math.min(item.width * 0.42, item.height * 1.1);
      let shaftTop = item.y + item.height * 0.25;
      let shaftBottom = item.y + item.height * 0.75;
      let points = [
        [item.x, shaftTop],
        [item.x + item.width - headWidth, shaftTop],
        [item.x + item.width - headWidth, item.y],
        [item.x + item.width, item.y + item.height / 2],
        [item.x + item.width - headWidth, item.y + item.height],
        [item.x + item.width - headWidth, shaftBottom],
        [item.x, shaftBottom],
      ];
      shape =
        '<polygon points="' +
        this.svgPoints(points) +
        '" fill="' +
        fill +
        '" stroke="' +
        stroke +
        '" stroke-width="' +
        strokeWidth +
        '"/>';
    } else {
      shape =
        '<rect x="' +
        this.roundSvgNumber(item.x) +
        '" y="' +
        this.roundSvgNumber(item.y) +
        '" width="' +
        this.roundSvgNumber(item.width) +
        '" height="' +
        this.roundSvgNumber(item.height) +
        '" fill="' +
        fill +
        '" stroke="' +
        stroke +
        '" stroke-width="' +
        strokeWidth +
        '"/>';
    }

    if (item.text == "") {
      return shape;
    }

    return (
      shape +
      '<text x="' +
      this.roundSvgNumber(item.x + item.width / 2) +
      '" y="' +
      this.roundSvgNumber(item.y + item.height / 2) +
      '" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="' +
      this.roundSvgNumber(item.fontSize) +
      '" fill="#000000">' +
      this.escapeXml(item.text) +
      "</text>"
    );
  }

  private buildChartSpec(
    chartFile: string,
    width: number,
    height: number
  ): FortuneChartSpec {
    let charts = this.readXml.getElementsByTagName("c:chartSpace/c:chart", chartFile);
    if (charts == null || charts.length == 0) {
      return null;
    }

    let seriesElements = charts[0].getInnerElements("c:ser");
    let series: FortuneChartSeriesSpec[] = [];
    let title = this.getChartTitleText(
      this.readXml.getElementsByTagName(
        "c:chartSpace/c:chart/c:title",
        chartFile
      )
    );
    let categoryAxisTitle = this.getChartTitleText(
      this.readXml.getElementsByTagName(
        "c:chartSpace/c:chart/c:plotArea/c:catAx/c:title",
        chartFile
      )
    );
    let valueAxisTitle = this.getChartTitleText(
      this.readXml.getElementsByTagName(
        "c:chartSpace/c:chart/c:plotArea/c:valAx/c:title",
        chartFile
      )
    );
    let valueAxis = this.getChartValueAxis(chartFile);
    let varyColors = this.getChartVaryColors(charts[0]);

    if (seriesElements == null) {
      return {
        type: "bar",
        width: width,
        height: height,
        title: title || undefined,
        categoryAxisTitle: categoryAxisTitle || undefined,
        valueAxisTitle: valueAxisTitle || undefined,
        valueAxis: valueAxis,
        varyColors: varyColors,
        series: series,
      };
    }

    for (let i = 0; i < seriesElements.length; i++) {
      let item = seriesElements[i];
      let color = this.getChartSeriesColor(item, i);
      let titleRef = this.getNestedValue(item, ["c:tx", "c:strRef", "c:f"]);
      let categoryRef =
        this.getNestedValue(item, ["c:cat", "c:strRef", "c:f"]) ||
        this.getNestedValue(item, ["c:cat", "c:numRef", "c:f"]);
      let valueRef = this.getNestedValue(item, ["c:val", "c:numRef", "c:f"]);

      let cachedCategories = this.getChartPointTexts(item, [
        "c:cat",
        "c:strRef",
        "c:strCache",
      ]);
      if (cachedCategories.length == 0) {
        cachedCategories = this.getChartPointTexts(item, [
          "c:cat",
          "c:numRef",
          "c:numCache",
        ]);
      }
      let cachedValues = this.getChartPointNumbers(item, [
        "c:val",
        "c:numRef",
        "c:numCache",
      ]);
      let pointColors = this.getChartPointColors(item);

      let rangeLen = Math.max(
        cachedCategories.length,
        cachedValues.length,
        this.countCellsInReference(categoryRef),
        this.countCellsInReference(valueRef)
      );
      let mode: "category" | "series" = rangeLen > 1 ? "category" : "series";

      series.push({
        color: color,
        titleRef: titleRef || undefined,
        categoryRef: categoryRef || undefined,
        cachedCategories:
          cachedCategories.length > 0 ? cachedCategories : undefined,
        valueRef: valueRef || undefined,
        cachedValues: cachedValues.length > 0 ? cachedValues : undefined,
        pointColors: pointColors.length > 0 ? pointColors : undefined,
        mode: mode,
      });
    }

    return {
      type: "bar",
      width: width,
      height: height,
      title: title || undefined,
      categoryAxisTitle: categoryAxisTitle || undefined,
      valueAxisTitle: valueAxisTitle || undefined,
      valueAxis: valueAxis,
      varyColors: varyColors,
      series: series,
    };
  }

  private getChartValueAxis(
    chartFile: string
  ): { min?: number; max?: number; majorUnit?: number } | undefined {
    let valAxes = this.readXml.getElementsByTagName(
      "c:chartSpace/c:chart/c:plotArea/c:valAx",
      chartFile
    );
    if (valAxes == null || valAxes.length == 0) {
      return undefined;
    }

    let valAx = valAxes[0];
    let min = this.getChartAxisNumericAttr(valAx, ["c:scaling", "c:min"]);
    let max = this.getChartAxisNumericAttr(valAx, ["c:scaling", "c:max"]);
    let majorUnit = this.getChartAxisNumericAttr(valAx, ["c:majorUnit"]);

    if (min == null && max == null && majorUnit == null) {
      return undefined;
    }

    let axis: { min?: number; max?: number; majorUnit?: number } = {};
    if (min != null) axis.min = min;
    if (max != null) axis.max = max;
    if (majorUnit != null) axis.majorUnit = majorUnit;
    return axis;
  }

  private getChartAxisNumericAttr(
    element: Element,
    path: string[]
  ): number | null {
    let current: Element[] = [element];
    for (let i = 0; i < path.length; i++) {
      let next: Element[] = [];
      for (let j = 0; j < current.length; j++) {
        let elements = current[j].getInnerElements(path[i]);
        if (elements != null) {
          next = next.concat(elements);
        }
      }
      if (next.length == 0) {
        return null;
      }
      current = next;
    }

    let raw = getXmlAttibute(current[0].attributeList, "val", null);
    if (raw == null || raw === "") {
      return null;
    }
    let parsed = parseFloat(raw);
    return isFinite(parsed) ? parsed : null;
  }

  private getChartTitleText(titleElements: Element[] | null): string {
    if (titleElements == null || titleElements.length == 0) {
      return "";
    }
    let texts = titleElements[0].getInnerElements("a:t");
    if (texts == null || texts.length == 0) {
      return "";
    }
    let parts: string[] = [];
    for (let i = 0; i < texts.length; i++) {
      if (texts[i].value) {
        parts.push(this.decodeXml(texts[i].value));
      }
    }
    return parts.join("").trim();
  }

  private getChartVaryColors(chart: Element): boolean {
    let containers =
      chart.getInnerElements("c:barChart") ||
      chart.getInnerElements("c:lineChart") ||
      chart.getInnerElements("c:pieChart") ||
      chart.getInnerElements("c:areaChart");
    if (containers == null || containers.length == 0) {
      // Excel-like default for single-series category charts.
      return true;
    }
    let vary = containers[0].getInnerElements("c:varyColors");
    if (vary == null || vary.length == 0) {
      return true;
    }
    let val = getXmlAttibute(vary[0].attributeList, "val", "1");
    return val !== "0" && val !== "false";
  }

  private getChartPointColors(series: Element): string[] {
    let dPts = series.getInnerElements("c:dPt");
    if (dPts == null || dPts.length == 0) {
      return [];
    }
    let colors: string[] = [];
    for (let i = 0; i < dPts.length; i++) {
      let idx = i;
      let idxEls = dPts[i].getInnerElements("c:idx");
      if (idxEls != null && idxEls.length > 0) {
        let idxAttr = getXmlAttibute(idxEls[0].attributeList, "val", String(i));
        let parsed = parseInt(idxAttr, 10);
        if (!isNaN(parsed)) {
          idx = parsed;
        }
      }
      let spPrs = dPts[i].getInnerElements("c:spPr");
      let color = DEFAULT_CHART_COLORS[idx % DEFAULT_CHART_COLORS.length];
      if (spPrs != null && spPrs.length > 0) {
        let solidFills = spPrs[0].getInnerElements("a:solidFill");
        if (solidFills != null && solidFills.length > 0) {
          color = this.getColorFromElement(solidFills[0], color);
        }
      }
      colors[idx] = color;
    }
    return colors;
  }

  private createParseCellResolver(): ChartCellResolver {
    return (reference: string) => {
      let cells = this.getCellsInReference(reference);
      return cells.map((cell) => ({
        display: this.getCellDisplayValue(cell),
        numeric: this.getCellNumericValueOrNull(cell),
      }));
    };
  }

  private countCellsInReference(reference: string) {
    if (reference == null || reference == "") {
      return 0;
    }
    let range = this.getNormalizedCellRange(reference);
    if (range == null || range.sheetIndex != this.id) {
      return 0;
    }
    return (
      (range.row[1] - range.row[0] + 1) * (range.column[1] - range.column[0] + 1)
    );
  }

  private getChartPointTexts(series: Element, path: string[]): string[] {
    let cacheValue = this.getNestedElements(series, path);
    if (cacheValue == null) {
      return [];
    }

    let points = cacheValue.getInnerElements("c:pt");
    if (points == null || points.length == 0) {
      return [];
    }

    let texts: string[] = [];
    for (let i = 0; i < points.length; i++) {
      let values = points[i].getInnerElements("c:v");
      texts.push(
        values != null && values.length > 0
          ? this.decodeXml(values[0].value)
          : ""
      );
    }
    return texts;
  }

  private getChartPointNumbers(series: Element, path: string[]): number[] {
    let texts = this.getChartPointTexts(series, path);
    let numbers: number[] = [];
    for (let i = 0; i < texts.length; i++) {
      numbers.push(parseChartNumber(texts[i]));
    }
    return numbers;
  }

  private getNestedElements(element: Element, path: string[]): Element {
    let current: Element[] = [element];

    for (let i = 0; i < path.length; i++) {
      let next: Element[] = [];
      for (let j = 0; j < current.length; j++) {
        let elements = current[j].getInnerElements(path[i]);
        if (elements != null) {
          next = next.concat(elements);
        }
      }

      if (next.length == 0) {
        return null;
      }

      current = next;
    }

    return current[0];
  }

  private getCellsInReference(reference: string): IfortuneSheetCelldata[] {
    if (reference == null || reference == "") {
      return [];
    }

    let range = this.getNormalizedCellRange(reference);
    if (range == null || range.sheetIndex != this.id) {
      return [];
    }

    let cells: IfortuneSheetCelldata[] = [];
    for (let r = range.row[0]; r <= range.row[1]; r++) {
      for (let c = range.column[0]; c <= range.column[1]; c++) {
        let found: IfortuneSheetCelldata = null;
        for (let i = 0; i < this.celldata.length; i++) {
          let cell = this.celldata[i];
          if (cell.r == r && cell.c == c) {
            found = cell;
            break;
          }
        }
        cells.push(found);
      }
    }
    return cells;
  }

  private getNormalizedCellRange(reference: string) {
    let normalized = reference.replace(/\$/g, "");
    normalized = normalized.replace(/^'([^']+)'!/, "$1!");
    return getcellrange(normalized, this.sheetList, this.id);
  }

  private getCellDisplayValue(cell: IfortuneSheetCelldata) {
    if (cell == null || cell.v == null) {
      return "";
    }

    if (typeof cell.v != "object") {
      return cell.v.toString();
    }

    let value = cell.v as IfortuneSheetCelldataValue;
    if (value.m != null && value.m !== "") {
      return value.m.toString();
    }
    if (value.v != null && value.v !== "") {
      return value.v.toString();
    }
    return "";
  }

  private getCellNumericValueOrNull(cell: IfortuneSheetCelldata) {
    if (cell == null || cell.v == null) {
      return null;
    }

    if (typeof cell.v != "object") {
      let parsed = parseChartNumber(cell.v.toString());
      return isNaN(parsed) ? null : parsed;
    }

    let value = cell.v as IfortuneSheetCelldataValue;
    if (value.v != null && value.v !== "") {
      let parsed = parseChartNumber(value.v.toString());
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
    return null;
  }

  private getChartSeriesColor(series: Element, index: number) {
    let fallback = DEFAULT_CHART_COLORS[index % DEFAULT_CHART_COLORS.length];
    let spPrs = series.getInnerElements("c:spPr");
    if (spPrs == null || spPrs.length == 0) {
      return fallback;
    }

    let solidFills = spPrs[0].getInnerElements("a:solidFill");
    if (solidFills == null || solidFills.length == 0) {
      return fallback;
    }

    return this.getColorFromElement(solidFills[0], fallback);
  }

  private getColorFromElement(element: Element, fallback: string) {
    let srgb = element.getInnerElements("a:srgbClr");
    if (srgb != null && srgb.length > 0) {
      let val = getXmlAttibute(srgb[0].attributeList, "val", null);
      if (val != null) {
        return "#" + val;
      }
    }

    let scheme = element.getInnerElements("a:schemeClr");
    if (scheme != null && scheme.length > 0) {
      let val = getXmlAttibute(scheme[0].attributeList, "val", null);
      let colors: IattributeList = {
        accent1: "#4472C4",
        accent2: "#ED7D31",
        accent3: "#A5A5A5",
        accent4: "#FFC000",
        accent5: "#5B9BD5",
        accent6: "#70AD47",
        tx1: "#000000",
        bg1: "#ffffff",
      };
      if (val != null && val in colors) {
        return colors[val];
      }
    }

    return fallback;
  }

  private getNestedValue(element: Element, path: string[]) {
    let current: Element[] = [element];

    for (let i = 0; i < path.length; i++) {
      let next: Element[] = [];
      for (let j = 0; j < current.length; j++) {
        let elements = current[j].getInnerElements(path[i]);
        if (elements != null) {
          next = next.concat(elements);
        }
      }

      if (next.length == 0) {
        return "";
      }

      current = next;
    }

    return current[0].value;
  }

  private getRelationshipByRid(
    rid: string,
    drawingRelsFile: string
  ): DrawingRelationship {
    if (rid == null) {
      return null;
    }

    let Relationships = this.readXml.getElementsByTagName(
      "Relationships/Relationship",
      drawingRelsFile
    );

    if (Relationships != null && Relationships.length > 0) {
      for (let i = 0; i < Relationships.length; i++) {
        let Relationship = Relationships[i];
        let attrList = Relationship.attributeList;
        let Id = getXmlAttibute(attrList, "Id", null);
        if (Id == rid) {
          return {
            id: Id,
            target: getXmlAttibute(attrList, "Target", null),
            type: getXmlAttibute(attrList, "Type", null),
          };
        }
      }
    }

    return null;
  }

  private normalizeRelationshipTarget(target: string) {
    if (target == null || target == "") {
      return null;
    }

    if (/^[a-z]+:/i.test(target)) {
      return null;
    }

    let src = target.replace(/^\//, "");
    src = src.replace(/\.\.\//g, "");
    if (src.indexOf("xl/") != 0) {
      src = "xl/" + src;
    }

    return src;
  }

  private svgPoints(points: number[][]) {
    let text = "";
    for (let i = 0; i < points.length; i++) {
      if (i > 0) {
        text += " ";
      }
      text +=
        this.roundSvgNumber(points[i][0]) +
        "," +
        this.roundSvgNumber(points[i][1]);
    }
    return text;
  }

  private svgToDataUri(svg: string) {
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  private escapeXml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  private decodeXml(value: string) {
    return value
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&");
  }

  private roundSvgNumber(value: number) {
    return (Math.round(value * 100) / 100).toString();
  }

  private getXdrValue(ele: Element[]): number {
    if (ele == null || ele.length == 0) {
      return null;
    }

    return parseInt(ele[0].value);
  }

  private getBase64ByRid(rid: string, drawingRelsFile: string) {
    let relationship = this.getRelationshipByRid(rid, drawingRelsFile);
    if (relationship != null) {
      let src = this.normalizeRelationshipTarget(relationship.target);
      if (src == null) {
        return null;
      }
      let imgage = this.imageList.getImageByName(src);
      return imgage;
    }

    return null;
  }

  private findCell(r: number, c: number) {
    if (this.cellIndex == null) {
      this.cellIndex = new Map();
      for (const cell of this.celldata) {
        this.cellIndex.set(cell.r + "_" + cell.c, cell);
      }
    }
    return this.cellIndex.get(r + "_" + c);
  }

  private cellIndex: Map<string, IfortuneSheetCelldata>;

  /** Cells with a hyperlink carry `hl` like links created in TinySheet. */
  private linkHyperlinkCells() {
    for (const key of Object.keys(this.hyperlink || {})) {
      const [r, c] = key.split("_").map(Number);
      const cell = this.findCell(r, c);
      if (cell == null || cell.v == null || typeof cell.v !== "object") {
        continue;
      }
      (cell.v as any).hl = { r, c, id: this.id };
    }
  }

  /**
   * Array formulas (`t="array"`, dynamic arrays with `cm`, and legacy CSE
   * formulas alike) become TinySheet spills: the anchor keeps the formula
   * and gets `spill: { rs, cs }`, the other cells of the range keep their
   * cached values and get `spillFrom` so recalculation owns them.
   */
  private applyArrayFormulas() {
    for (const anchor of this.arrayFormulaCells) {
      const range = getcellrange(anchor._arrayRef);
      if (range == null) continue;
      const rs = range.row[1] - range.row[0] + 1;
      const cs = range.column[1] - range.column[0] + 1;
      if (!(rs >= 1 && cs >= 1) || (rs == 1 && cs == 1)) continue;
      if (anchor.v == null || typeof anchor.v !== "object") continue;
      (anchor.v as any).spill = { rs, cs };
      for (let i = 0; i < rs; i++) {
        for (let j = 0; j < cs; j++) {
          if (i == 0 && j == 0) continue;
          const cell = this.findCell(anchor.r + i, anchor.c + j);
          if (cell == null) continue;
          if (cell.v == null || typeof cell.v !== "object") {
            cell.v = new FortuneSheetCelldataValue();
          }
          delete (cell.v as any).f;
          (cell.v as any).spillFrom = { dr: i, dc: j };
        }
      }
    }
  }

  /**
   * A sheet default column width (or custom default row height) that differs
   * from TinySheet's default is materialised on every used column/row that
   * has no size of its own, since TinySheet has no per-sheet default.
   */
  private applyDefaultSizes() {
    let maxRow = -1,
      maxCol = -1;
    for (const cell of this.celldata) {
      if (cell.r > maxRow) maxRow = cell.r;
      if (cell.c > maxCol) maxCol = cell.c;
    }
    for (const key in this.config.merge || {}) {
      const m = this.config.merge[key];
      maxRow = Math.max(maxRow, m.r + m.rs - 1);
      maxCol = Math.max(maxCol, m.c + m.cs - 1);
    }
    if (
      this.customDefaultColWidth &&
      Math.abs(this.defaultColWidth - TINYSHEET_COLUMN_WIDTH) > 1
    ) {
      const lastCol = Math.max(maxCol, 25);
      for (let c = 0; c <= lastCol; c++) {
        if (this.config.columnlen?.[c] != null) continue;
        if (this.config.colhidden?.[c] != null) continue;
        if (this.config.columnlen == null) this.config.columnlen = {};
        this.config.columnlen[c] = this.defaultColWidth;
      }
    }
    if (
      this.customDefaultRowHeight &&
      Math.abs(this.defaultRowHeight - TINYSHEET_ROW_HEIGHT) > 1
    ) {
      const lastRow = Math.max(maxRow, 0);
      for (let r = 0; r <= lastRow; r++) {
        if (this.config.rowlen?.[r] != null) continue;
        if (this.config.rowhidden?.[r] != null) continue;
        if (this.config.rowlen == null) this.config.rowlen = {};
        this.config.rowlen[r] = this.defaultRowHeight;
      }
    }
  }

  /**
   * @desc This will convert cols/col to fortunesheet config of column'width
   */
  private generateConfigColumnLenAndHidden() {
    let cols = this.readXml.getElementsByTagName("cols/col", this.sheetFile);
    for (let i = 0; i < cols.length; i++) {
      let col = cols[i],
        attrList = col.attributeList;
      let min = getXmlAttibute(attrList, "min", null);
      let max = getXmlAttibute(attrList, "max", null);
      let width = getXmlAttibute(attrList, "width", null);
      let hidden = getXmlAttibute(attrList, "hidden", null);
      let customWidth = getXmlAttibute(attrList, "customWidth", null);

      if (min == null || max == null) {
        continue;
      }

      let minNum = parseInt(min) - 1,
        maxNum = parseInt(max) - 1,
        widthNum = parseFloat(width);

      for (let m = minNum; m <= maxNum; m++) {
        if (width != null) {
          if (this.config.columnlen == null) {
            this.config.columnlen = {};
          }
          this.config.columnlen[m] = getColumnWidthPixel(widthNum);
        }

        if (hidden == "1") {
          if (this.config.colhidden == null) {
            this.config.colhidden = {};
          }
          this.config.colhidden[m] = 0;

          if (this.config.columnlen && !(widthNum > 0)) {
            delete this.config.columnlen[m];
          }
        }

        if (customWidth != null) {
          if (this.config.customWidth == null) {
            this.config.customWidth = {};
          }
          this.config.customWidth[m] = 1;
        }
      }
    }
  }

  /**
   * @desc This will convert cols/col to fortunesheet config of column'width
   */
  private generateConfigRowLenAndHiddenAddCell(): IcellOtherInfo {
    let rows = this.readXml.getElementsByTagName(
      "sheetData/row",
      this.sheetFile
    );
    let cellOtherInfo: IcellOtherInfo = {};
    let formulaList: IformulaList = {};
    cellOtherInfo.formulaList = formulaList;
    for (let i = 0; i < rows.length; i++) {
      let row = rows[i],
        attrList = row.attributeList;
      let rowNo = getXmlAttibute(attrList, "r", null);
      let height = getXmlAttibute(attrList, "ht", null);
      let hidden = getXmlAttibute(attrList, "hidden", null);
      let customHeight = getXmlAttibute(attrList, "customHeight", null);

      if (rowNo == null) {
        continue;
      }

      let rowNoNum = parseInt(rowNo) - 1;
      if (height != null) {
        let heightNum = parseFloat(height);
        if (this.config.rowlen == null) {
          this.config.rowlen = {};
        }
        this.config.rowlen[rowNoNum] = getRowHeightPixel(heightNum);
      }

      if (hidden == "1") {
        if (this.config.rowhidden == null) {
          this.config.rowhidden = {};
        }
        this.config.rowhidden[rowNoNum] = 0;

        // Keep the height to restore on unhide (writers use ht="0" for none).
        if (this.config.rowlen && !(parseFloat(height) > 0)) {
          delete this.config.rowlen[rowNoNum];
        }
      }

      if (customHeight != null) {
        if (this.config.customHeight == null) {
          this.config.customHeight = {};
        }
        this.config.customHeight[rowNoNum] = 1;
      }

      if (this.isInitialCell) {
        let cells = row.getInnerElements("c");
        for (let key in cells) {
          let cell = cells[key];
          let cellValue = new FortuneSheetCelldata(
            cell,
            this.styles,
            this.sharedStrings,
            this.mergeCells,
            this.sheetFile,
            this.readXml,
            this.workbookInfo
          );
          if (cellValue._borderObject != null) {
            if (this.config.borderInfo == null) {
              this.config.borderInfo = [];
            }
            this.config.borderInfo.push(cellValue._borderObject);
            delete cellValue._borderObject;
          }

          // let borderId = cellValue._borderId;
          // if(borderId!=null){
          //     let borders = this.styles["borders"] as Element[];
          //     if(this.config._borderInfo==null){
          //         this.config._borderInfo = {};
          //     }
          //     if( borderId in this.config._borderInfo){
          //         this.config._borderInfo[borderId].cells.push(cellValue.r + "_" + cellValue.c);
          //     }
          //     else{
          //         let border = borders[borderId];
          //         let borderObject = new FortuneSheetborderInfoCellForImp();
          //         borderObject.rangeType = "cellGroup";
          //         borderObject.cells = [];
          //         let borderCellValue = new FortuneSheetborderInfoCellValue();

          //         let lefts = border.getInnerElements("left");
          //         let rights = border.getInnerElements("right");
          //         let tops = border.getInnerElements("top");
          //         let bottoms = border.getInnerElements("bottom");
          //         let diagonals = border.getInnerElements("diagonal");

          //         let left = this.getBorderInfo(lefts);
          //         let right = this.getBorderInfo(rights);
          //         let top = this.getBorderInfo(tops);
          //         let bottom = this.getBorderInfo(bottoms);
          //         let diagonal = this.getBorderInfo(diagonals);

          //         let isAdd = false;
          //         if(left!=null && left.color!=null){
          //             borderCellValue.l = left;
          //             isAdd = true;
          //         }

          //         if(right!=null && right.color!=null){
          //             borderCellValue.r = right;
          //             isAdd = true;
          //         }

          //         if(top!=null && top.color!=null){
          //             borderCellValue.t = top;
          //             isAdd = true;
          //         }

          //         if(bottom!=null && bottom.color!=null){
          //             borderCellValue.b = bottom;
          //             isAdd = true;
          //         }

          //         if(isAdd){
          //             borderObject.value = borderCellValue;
          //             this.config._borderInfo[borderId] = borderObject;
          //         }

          //     }
          // }
          if (cellValue._arrayRef != null) {
            this.arrayFormulaCells.push(cellValue);
          }

          if (cellValue._formulaType == "shared") {
            if (this.formulaRefList == null) {
              this.formulaRefList = {};
            }

            if (this.formulaRefList[cellValue._formulaSi] == null) {
              this.formulaRefList[cellValue._formulaSi] = {};
            }

            let fv;
            if (cellValue.v != null) {
              fv = (cellValue.v as IfortuneSheetCelldataValue).f;
            }

            let refValue = {
              t: cellValue._formulaType,
              ref: cellValue._fomulaRef,
              si: cellValue._formulaSi,
              fv: fv,
              cellValue: cellValue,
            };

            if (cellValue._fomulaRef != null) {
              this.formulaRefList[cellValue._formulaSi]["mainRef"] = refValue;
            } else {
              this.formulaRefList[cellValue._formulaSi][
                cellValue.r + "_" + cellValue.c
              ] = refValue;
            }

            // console.log(refValue, this.formulaRefList);
          }

          //There may be formulas that do not appear in calcChain
          if (
            cellValue.v != null &&
            (cellValue.v as IfortuneSheetCelldataValue).f != null
          ) {
            let formulaCell: IformulaListItem = {
              r: cellValue.r,
              c: cellValue.c,
            };
            cellOtherInfo.formulaList["r" + cellValue.r + "c" + cellValue.c] =
              formulaCell;
          }

          this.celldata.push(cellValue);
        }
      }
    }

    return cellOtherInfo;
  }

  /**
   * fortunesheet config of dataValidations
   *
   * @returns {IfortunesheetDataVerification} - dataValidations config
   */
  private generateConfigDataValidations(): IfortunesheetDataVerification {
    let rows = this.readXml.getElementsByTagName(
      "dataValidations/dataValidation",
      this.sheetFile
    );
    let extLst =
      this.readXml.getElementsByTagName(
        "extLst/ext/x14:dataValidations/x14:dataValidation",
        this.sheetFile
      ) || [];

    rows = rows.concat(extLst);

    let dataVerification: IfortunesheetDataVerification = {};

    for (let i = 0; i < rows.length; i++) {
      let row = rows[i];
      let attrList = row.attributeList;
      let formulaValue = row.value;

      let type = getXmlAttibute(attrList, "type", null);
      if (!type || type == "none") {
        continue;
      }
      let operator = getXmlAttibute(attrList, "operator", null) || "between",
        sqref = "",
        sqrefIndexArr: string[] = [],
        valueArr: string[] = [];

      // x14 processing
      const formulaReg = new RegExp(/<x14:formula1>|<xm:sqref>/g);
      if (formulaReg.test(formulaValue)) {
        const peelOffData = getPeelOffX14(formulaValue);
        sqref = peelOffData?.sqref;
        valueArr = getMultiFormulaValue(peelOffData?.formula);
      } else {
        sqref = getXmlAttibute(attrList, "sqref", null);
        valueArr = getMultiFormulaValue(formulaValue);
      }
      sqrefIndexArr = getMultiSequenceToNum(sqref);

      let _type: string = DATA_VERIFICATION_MAP[type];
      if (_type == null) {
        continue;
      }
      let _type2: string | null = null;
      let _value1: string | number = valueArr?.length >= 1 ? valueArr[0] : "";
      let _value2: string | number = valueArr?.length >= 2 ? valueArr[1] : "";
      let _hint = escapeCharacter(getXmlAttibute(attrList, "prompt", null));
      let showInput = getXmlAttibute(attrList, "showInputMessage", "0");
      let showError = getXmlAttibute(attrList, "showErrorMessage", "0");
      let errorStyle = getXmlAttibute(attrList, "errorStyle", "stop");
      let _hintShow = !!_hint && (showInput == "1" || showInput == "true");
      let _prohibitInput =
        (showError == "1" || showError == "true") && errorStyle == "stop";

      if (_type === "date") {
        _type2 = DV_DATE_OPERATORS[operator] || "between";
        const toDate = (value: string | number) => {
          let serial = Number(value);
          if (value === "" || !isFinite(serial)) return value;
          if (this.workbookInfo.date1904) serial += 1462;
          return dayjs(new Date(Date.UTC(1899, 11, 30) + serial * 86400000))
            .add(new Date().getTimezoneOffset(), "minute")
            .format("YYYY-MM-DD");
        };
        _value1 = toDate(_value1);
        _value2 = toDate(_value2);
      } else if (_type === "dropdown") {
        // "a,b,c" -> a,b,c ; ranges stay references
        const list = String(_value1).replace(/^=/, "");
        _value1 = /^".*"$/s.test(list)
          ? list.slice(1, -1).replace(/""/g, '"')
          : list;
      } else if (_type === "text_content") {
        // Custom formulas generated for "contains / excludes / equals" rules.
        const text = String(_value1);
        const include =
          /^ISNUMBER\(SEARCH\("((?:[^"]|"")*)",\$?[A-Z]+\$?\d+\)\)$/i.exec(text);
        const exclude =
          /^ISERROR\(SEARCH\("((?:[^"]|"")*)",\$?[A-Z]+\$?\d+\)\)$/i.exec(text);
        const equal = /^\$?[A-Z]+\$?\d+="((?:[^"]|"")*)"$/i.exec(text);
        if (include) {
          _type2 = "include";
          _value1 = include[1].replace(/""/g, '"');
        } else if (exclude) {
          _type2 = "exclude";
          _value1 = exclude[1].replace(/""/g, '"');
        } else if (equal) {
          _type2 = "equal";
          _value1 = equal[1].replace(/""/g, '"');
        } else {
          // Any other custom formula.
          _type = "custom";
          _value1 = text.replace(/^=/, "");
        }
      } else {
        _type2 = DV_OPERATORS[operator] || "between";
      }

      // dynamically add dataVerifications
      for (const ref of sqrefIndexArr) {
        dataVerification[ref] = {
          type: _type as any,
          type2: _type2,
          value1: _value1,
          value2: _value2,
          checked: false,
          remote: false,
          prohibitInput: _prohibitInput,
          hintShow: _hintShow,
          hintText: _hint,
          hintValue: _hint || "",
        } as any;
      }
    }

    return dataVerification;
  }

  /**
   * fortunesheet config of hyperlink
   *
   * @returns {IfortunesheetHyperlink} - hyperlink config
   */
  private generateConfigHyperlinks(): IfortunesheetHyperlink {
    let rows = this.readXml.getElementsByTagName(
      "hyperlinks/hyperlink",
      this.sheetFile
    );
    let hyperlink: IfortunesheetHyperlink = {};
    for (let i = 0; i < rows.length; i++) {
      let row = rows[i];
      let attrList = row.attributeList;
      let ref = getXmlAttibute(attrList, "ref", null),
        refArr = getMultiSequenceToNum(ref),
        _display = escapeCharacter(getXmlAttibute(attrList, "display", null)),
        _address = escapeCharacter(getXmlAttibute(attrList, "location", null)),
        _tooltip = escapeCharacter(getXmlAttibute(attrList, "tooltip", null));
      let _type: IfortunesheetHyperlinkType = _address
        ? "cellrange"
        : "webpage";

      // external hyperlink
      if (!_address) {
        let rid = attrList["r:id"];
        let sheetFile = this.sheetFile;
        let relationshipList = this.readXml.getElementsByTagName(
          "Relationships/Relationship",
          `xl/worksheets/_rels/${sheetFile.replace(worksheetFilePath, "")}.rels`
        );

        const findRid = relationshipList?.find(
          (e) => e.attributeList["Id"] === rid
        );

        if (findRid) {
          _address = escapeCharacter(findRid.attributeList["Target"]);
          const type = findRid.attributeList[
            "TargetMode"
          ]?.toLocaleLowerCase();
          if (type === "external") {
            _type = "webpage";
          }
        }
      }

      if (_address && _type === "cellrange") {
        _address = _address.replace(/^#/, "");
      }

      // match R1C1
      const addressReg = new RegExp(/^.*!R([\d$])+C([\d$])*$/g);
      if (addressReg.test(_address)) {
        _address = getTransR1C1ToSequence(_address);
      }

      // dynamically add hyperlinks
      for (const ref of refArr) {
        hyperlink[ref] = {
          linkAddress: _address,
          linkTooltip: _tooltip || "",
          linkType: _type,
          display: _display || "",
        };
      }
    }

    return hyperlink;
  }

  // private getBorderInfo(borders:Element[]):FortuneSheetborderInfoCellValueStyle{
  //     if(borders==null){
  //         return null;
  //     }

  //     let border = borders[0], attrList = border.attributeList;
  //     let clrScheme = this.styles["clrScheme"] as Element[];
  //     let style:string = attrList.style;
  //     if(style==null || style=="none"){
  //         return null;
  //     }

  //     let colors = border.getInnerElements("color");
  //     let colorRet = "#000000";
  //     if(colors!=null){
  //         let color = colors[0];
  //         colorRet = getColor(color, clrScheme);
  //     }

  //     let ret = new FortuneSheetborderInfoCellValueStyle();
  //     ret.style = borderTypes[style];
  //     ret.color = colorRet;

  //     return ret;
  // }
}
