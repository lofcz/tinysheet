import {
  IFortuneFile,
  IfortuneSheetRowAndColumnHidden,
  IfortuneSheetRowAndColumnLen,
} from "./IFortune";
import { FortuneSheet } from "./FortuneSheet";
import { IuploadfileList, IattributeList } from "../common/ICommon";
import {
  workBookFile,
  coreFile,
  appFile,
  stylesFile,
  sharedStringsFile,
  numFmtDefault,
  theme1File,
  calcChainFile,
  workbookRels,
} from "../common/constant";
import { ReadXml, IStyleCollections, Element } from "./ReadXml";
import { escapeCharacter, getXmlAttibute } from "../common/method";
import {
  FortuneFileBase,
  FortuneFileInfo,
  FortuneSheetBase,
  FortuneSheetCelldataBase,
  FortuneSheetCelldataValue,
  FortuneSheetCellFormat,
} from "./FortuneBase";
import { ImageList } from "./FortuneImage";
import {
  sheetImportFeatures,
  workbookImportFeatures,
  WorkbookImportInfo,
  resolvePartPath,
} from "./importFeatures";
import {
  importDefinedNames,
  readDefinedNamesXml,
} from "../common/definedNames";
import { generateChartId } from "@lofcz/tinysheet-core";

export class FortuneFile {
  private files: IuploadfileList;
  private sheetNameList: IattributeList;
  private readXml: ReadXml;
  private fileName: string;
  private styles: IStyleCollections;
  private sharedStrings: Element[];
  private calcChain: Element[];
  private imageList: ImageList;
  private sheets?: FortuneSheet[];
  private info?: FortuneFileInfo;
  private workbookInfo: WorkbookImportInfo = {};

  constructor(files: IuploadfileList, fileName: string) {
    this.files = files;
    this.fileName = fileName;
    this.readXml = new ReadXml(files);
    this.getSheetNameList();

    this.sharedStrings = this.readXml.getElementsByTagName(
      "sst/si",
      sharedStringsFile
    );
    this.calcChain = this.readXml.getElementsByTagName(
      "calcChain/c",
      calcChainFile
    );
    this.styles = {};
    this.styles["cellXfs"] = this.readXml.getElementsByTagName(
      "cellXfs/xf",
      stylesFile
    );
    this.styles["cellStyleXfs"] = this.readXml.getElementsByTagName(
      "cellStyleXfs/xf",
      stylesFile
    );
    this.styles["cellStyles"] = this.readXml.getElementsByTagName(
      "cellStyles/cellStyle",
      stylesFile
    );
    this.styles["fonts"] = this.readXml.getElementsByTagName(
      "fonts/font",
      stylesFile
    );
    this.styles["fills"] = this.readXml.getElementsByTagName(
      "fills/fill",
      stylesFile
    );
    this.styles["borders"] = this.readXml.getElementsByTagName(
      "borders/border",
      stylesFile
    );
    this.styles["clrScheme"] = this.readXml.getElementsByTagName(
      "a:clrScheme/a:dk1|a:lt1|a:dk2|a:lt2|a:accent1|a:accent2|a:accent3|a:accent4|a:accent5|a:accent6|a:hlink|a:folHlink",
      theme1File
    );
    this.styles["indexedColors"] = this.readXml.getElementsByTagName(
      "colors/indexedColors/rgbColor",
      stylesFile
    );
    this.styles["mruColors"] = this.readXml.getElementsByTagName(
      "colors/mruColors/color",
      stylesFile
    );

    this.imageList = new ImageList(files);

    let numfmts = this.readXml.getElementsByTagName(
      "numFmt/numFmt",
      stylesFile
    );
    let numFmtDefaultC = JSON.parse(JSON.stringify(numFmtDefault));
    for (let i = 0; i < numfmts.length; i++) {
      let attrList = numfmts[i].attributeList;
      let numfmtid = getXmlAttibute(attrList, "numFmtId", "49");
      let formatcode = getXmlAttibute(attrList, "formatCode", "@");
      // Custom codes (ids >= 164) and explicit overrides of built-in ids.
      numFmtDefaultC[numfmtid] = formatcode;
    }

    let workbookPr = this.readXml.getElementsByTagName(
      "workbookPr",
      workBookFile
    );
    if (workbookPr.length > 0) {
      let date1904 = workbookPr[0].attributeList.date1904;
      this.workbookInfo.date1904 = date1904 == "1" || date1904 == "true";
    }

    // console.log(JSON.stringify(numFmtDefaultC), numfmts);
    this.styles["numfmts"] = numFmtDefaultC;
  }

  /**
   * @return All sheet name of workbook
   */
  private getSheetNameList() {
    let workbookRelList = this.readXml.getElementsByTagName(
      "Relationships/Relationship",
      workbookRels
    );
    if (workbookRelList == null) {
      return;
    }

    let regex = new RegExp("worksheets/[^/]*?.xml", "i");
    let sheetNames: IattributeList = {};
    // part names are case-insensitive: map targets to the zip's spelling
    let byLowerName = new Map<string, string>();
    Object.keys(this.files).forEach((name) =>
      byLowerName.set(name.toLowerCase(), name)
    );
    for (let i = 0; i < workbookRelList.length; i++) {
      let rel = workbookRelList[i],
        attrList = rel.attributeList;
      let id = attrList["Id"],
        target = attrList["Target"],
        type = attrList["Type"] || "";
      if (id == null || target == null) continue;
      if (/\/worksheet$/.test(type) || (!type && regex.test(target))) {
        let path = resolvePartPath("xl", escapeCharacter(target));
        sheetNames[id] = byLowerName.get(path.toLowerCase()) ?? path;
      }
    }

    this.sheetNameList = sheetNames;
  }

  /**
   * @param sheetName WorkSheet'name
   * @return sheet file name and path in zip
   */
  private getSheetFileBysheetId(sheetId: string) {
    // for(let i=0;i<this.sheetNameList.length;i++){
    //     let sheetFileName = this.sheetNameList[i];
    //     if(sheetFileName.indexOf("sheet"+sheetId)>-1){
    //         return sheetFileName;
    //     }
    // }
    return this.sheetNameList[sheetId];
  }

  /**
   * @return workBook information
   */
  getWorkBookInfo() {
    let Company = this.readXml.getElementsByTagName("Company", appFile);
    let AppVersion = this.readXml.getElementsByTagName("AppVersion", appFile);
    let creator = this.readXml.getElementsByTagName("dc:creator", coreFile);
    let lastModifiedBy = this.readXml.getElementsByTagName(
      "cp:lastModifiedBy",
      coreFile
    );
    let created = this.readXml.getElementsByTagName(
      "dcterms:created",
      coreFile
    );
    let modified = this.readXml.getElementsByTagName(
      "dcterms:modified",
      coreFile
    );
    this.info = new FortuneFileInfo();
    this.info.name = this.fileName;
    this.info.creator = creator.length > 0 ? creator[0].value : "";
    this.info.lastmodifiedby =
      lastModifiedBy.length > 0 ? lastModifiedBy[0].value : "";
    this.info.createdTime = created.length > 0 ? created[0].value : "";
    this.info.modifiedTime = modified.length > 0 ? modified[0].value : "";
    this.info.company = Company.length > 0 ? Company[0].value : "";
    this.info.appversion = AppVersion.length > 0 ? AppVersion[0].value : "";
  }

  /**
   * @return All sheet , include whole information
   */
  getSheetsFull(isInitialCell: boolean = true) {
    let sheets = this.readXml.getElementsByTagName(
      "sheets/sheet",
      workBookFile
    );
    let sheetList: IattributeList = {};
    for (let key in sheets) {
      let sheet = sheets[key];
      sheetList[escapeCharacter(sheet.attributeList.name)] =
        sheet.attributeList["sheetId"];
    }
    this.sheets = [];
    let order = 0;
    for (let key in sheets) {
      let sheet = sheets[key];
      let sheetName = escapeCharacter(sheet.attributeList.name);
      let sheetId = sheet.attributeList["sheetId"];
      let rid = sheet.attributeList["r:id"];
      let sheetFile = this.getSheetFileBysheetId(rid);
      let state = sheet.attributeList.state;
      let hide = state === "hidden" || state === "veryHidden" ? 1 : 0;

      let drawing = this.readXml.getElementsByTagName("drawing", sheetFile),
        drawingFile,
        drawingRelsFile;
      if (drawing != null && drawing.length > 0) {
        let attrList = drawing[0].attributeList;
        let rid = getXmlAttibute(attrList, "r:id", null);
        if (rid != null) {
          drawingFile = this.getDrawingFile(rid, sheetFile);
          drawingRelsFile =
            drawingFile != null ? this.getDrawingRelsFile(drawingFile) : null;
        }
      }

      if (sheetFile != null) {
        let sheet = new FortuneSheet(sheetName, sheetId, order, isInitialCell, {
          sheetFile: sheetFile,
          readXml: this.readXml,
          sheetList: sheetList,
          styles: this.styles,
          sharedStrings: this.sharedStrings,
          calcChain: this.calcChain,
          imageList: this.imageList,
          drawingFile: drawingFile,
          drawingRelsFile: drawingRelsFile,
          hide: hide,
          workbookInfo: this.workbookInfo,
        });
        for (const feature of sheetImportFeatures) {
          feature.read({
            sheet,
            sheetFile,
            readXml: this.readXml,
            files: this.files,
            styles: this.styles,
            workbook: this.workbookInfo,
          });
        }
        this.columnWidthSet = [];
        this.rowHeightSet = [];

        this.imagePositionCaculation(sheet);
        this.chartPositionCalculation(sheet);

        this.sheets.push(sheet);
        order++;
      }
    }
    for (const feature of workbookImportFeatures) {
      feature.read({
        sheets: this.sheets,
        readXml: this.readXml,
        files: this.files,
        workbook: this.workbookInfo,
      });
    }
  }

  /** Charts use the same two-cell anchors as images. */
  private chartPositionCalculation(sheet: FortuneSheet) {
    if (sheet.chartObjects.length == 0) {
      return;
    }
    let images = sheet.images;
    sheet.images = sheet.chartObjects as any;
    this.imagePositionCaculation(sheet);
    sheet.images = images;
  }

  private columnWidthSet: number[] = [];
  private rowHeightSet: number[] = [];

  private extendArray(
    index: number,
    sets: number[],
    def: number,
    hidden: IfortuneSheetRowAndColumnHidden,
    lens: IfortuneSheetRowAndColumnLen
  ) {
    if (index < sets.length) {
      return;
    }

    let startIndex = sets.length,
      endIndex = index;
    let allGap = 0;
    if (startIndex > 0) {
      allGap = sets[startIndex - 1];
    }
    // else{
    //     sets.push(0);
    // }
    for (let i = startIndex; i <= endIndex; i++) {
      let gap = def,
        istring = i.toString();
      if (istring in hidden) {
        gap = 0;
      } else if (istring in lens) {
        gap = lens[istring];
      }

      allGap += Math.round(gap + 1);

      sets.push(allGap);
    }
  }

  private imagePositionCaculation(sheet: FortuneSheet) {
    let images = sheet.images,
      defaultColWidth = sheet.defaultColWidth,
      defaultRowHeight = sheet.defaultRowHeight;
    let colhidden = {};
    if (sheet.config.colhidden) {
      colhidden = sheet.config.colhidden;
    }

    let columnlen = {};
    if (sheet.config.columnlen) {
      columnlen = sheet.config.columnlen;
    }

    let rowhidden = {};
    if (sheet.config.rowhidden) {
      rowhidden = sheet.config.rowhidden;
    }

    let rowlen = {};
    if (sheet.config.rowlen) {
      rowlen = sheet.config.rowlen;
    }

    for (let key in images) {
      let imageObject: any = images[key]; //Image, fortuneImage
      let fromCol = imageObject.fromCol;
      let fromColOff = imageObject.fromColOff;
      let fromRow = imageObject.fromRow;
      let fromRowOff = imageObject.fromRowOff;

      let toCol = imageObject.toCol;
      let toColOff = imageObject.toColOff;
      let toRow = imageObject.toRow;
      let toRowOff = imageObject.toRowOff;

      let x_n = 0,
        y_n = 0;
      let cx_n = 0,
        cy_n = 0;

      if (fromCol >= this.columnWidthSet.length) {
        this.extendArray(
          fromCol,
          this.columnWidthSet,
          defaultColWidth,
          colhidden,
          columnlen
        );
      }
      if (fromCol == 0) {
        x_n = 0;
      } else {
        x_n = this.columnWidthSet[fromCol - 1];
      }
      x_n = x_n + fromColOff;

      if (fromRow >= this.rowHeightSet.length) {
        this.extendArray(
          fromRow,
          this.rowHeightSet,
          defaultRowHeight,
          rowhidden,
          rowlen
        );
      }
      if (fromRow == 0) {
        y_n = 0;
      } else {
        y_n = this.rowHeightSet[fromRow - 1];
      }
      y_n = y_n + fromRowOff;

      if (toCol != null && toRow != null) {
        if (toCol >= this.columnWidthSet.length) {
          this.extendArray(
            toCol,
            this.columnWidthSet,
            defaultColWidth,
            colhidden,
            columnlen
          );
        }
        if (toCol == 0) {
          cx_n = 0;
        } else {
          cx_n = this.columnWidthSet[toCol - 1];
        }
        cx_n = cx_n + toColOff - x_n;

        if (toRow >= this.rowHeightSet.length) {
          this.extendArray(
            toRow,
            this.rowHeightSet,
            defaultRowHeight,
            rowhidden,
            rowlen
          );
        }
        if (toRow == 0) {
          cy_n = 0;
        } else {
          cy_n = this.rowHeightSet[toRow - 1];
        }
        cy_n = cy_n + toRowOff - y_n;
      } else {
        // oneCellAnchor: use pre-calculated dimensions from xdr:ext
        cx_n = imageObject.originWidth || 0;
        cy_n = imageObject.originHeight || 0;
      }

      imageObject.originWidth = cx_n;
      imageObject.originHeight = cy_n;

      imageObject.crop.height = cy_n;
      imageObject.crop.width = cx_n;

      imageObject.default.height = cy_n;
      imageObject.default.left = x_n;
      imageObject.default.top = y_n;
      imageObject.default.width = cx_n;
    }

    //console.log(this.columnWidthSet, this.rowHeightSet);
  }

  /**
   * @return drawing file string
   */
  private getDrawingFile(rid: string, sheetFile: string): string {
    let sheetRelsPath = "xl/worksheets/_rels/";
    let sheetFileArr = sheetFile.split("/");
    let sheetRelsName = sheetFileArr[sheetFileArr.length - 1];

    let sheetRelsFile = sheetRelsPath + sheetRelsName + ".rels";

    let drawing = this.readXml.getElementsByTagName(
      "Relationships/Relationship",
      sheetRelsFile
    );
    if (drawing.length > 0) {
      for (let i = 0; i < drawing.length; i++) {
        let relationship = drawing[i];
        let attrList = relationship.attributeList;
        let relationshipId = getXmlAttibute(attrList, "Id", null);
        if (relationshipId == rid) {
          let target = getXmlAttibute(attrList, "Target", null);
          if (target != null) {
            return target.replace(/\.\.\//g, "").replace(/^\//, "");
          }
        }
      }
    }

    return null;
  }
  private getDrawingRelsFile(drawingFile: string): string {
    let drawingRelsPath = "xl/drawings/_rels/";
    let drawingFileArr = drawingFile.split("/");
    let drawingRelsName = drawingFileArr[drawingFileArr.length - 1];

    let drawingRelsFile = drawingRelsPath + drawingRelsName + ".rels";

    return drawingRelsFile;
  }

  /**
   * @return All sheet base information widthout cell and config
   */
  getSheetsWithoutCell() {
    this.getSheetsFull(false);
  }

  /**
   * @return FortuneSheet file json
   */
  Parse() {
    this.getWorkBookInfo();
    this.getSheetsFull();
  }

  /** Defined names of xl/workbook.xml -> sheet.definedNames (core names.ts) */
  private attachDefinedNames(sheets: any[]) {
    const key = Object.keys(this.files).find(
      (k) => k.indexOf(workBookFile) > -1
    );
    if (!key) return;
    const names = readDefinedNamesXml(this.files[key]);
    if (names.length === 0) return;
    const order = this.readXml
      .getElementsByTagName("sheets/sheet", workBookFile)
      .map((el) => el.attributeList.name);
    importDefinedNames(names, order).forEach((list, sheetName) => {
      const sheet = sheets.find((s) => s.name === sheetName) ?? sheets[0];
      if (sheet) {
        sheet.definedNames = [...(sheet.definedNames ?? []), ...list];
      }
    });
  }

  serialize(): FortuneFileBase {
    const FortuneOutPutFile = new FortuneFileBase();
    FortuneOutPutFile.info = this.info;
    FortuneOutPutFile.sheets = [];

    for (const sheet of this.sheets!) {
      const sheetout: any = {};
      //let attrName = ["name","color","config","index","status","order","row","column","luckysheet_select_save","scrollLeft","scrollTop","zoomRatio","showGridLines","defaultColWidth","defaultRowHeight","celldata","chart","isPivotTable","pivotTable","luckysheet_conditionformat_save","freezen","calcChain"];

      if (sheet.name != null) {
        sheetout.name = sheet.name;
      }

      if (sheet.color != null) {
        sheetout.color = sheet.color;
      }

      if (sheet.config != null) {
        // Plain objects (the parser uses classes), so immer can draft them.
        sheetout.config = JSON.parse(JSON.stringify(sheet.config));
        // if(sheetout.config._borderInfo!=null){
        //     delete sheetout.config._borderInfo;
        // }
      }

      if (sheet.id != null) {
        sheetout.id = sheet.id;
      }

      if (sheet.status != null) {
        sheetout.status = sheet.status;
      }

      if (sheet.order != null) {
        sheetout.order = sheet.order;
      }

      if (sheet.row != null) {
        sheetout.row = sheet.row;
      }

      if (sheet.column != null) {
        sheetout.column = sheet.column;
      }

      if (sheet.luckysheet_select_save != null) {
        sheetout.luckysheet_select_save = sheet.luckysheet_select_save;
      }

      if (sheet.scrollLeft != null) {
        sheetout.scrollLeft = sheet.scrollLeft;
      }

      if (sheet.scrollTop != null) {
        sheetout.scrollTop = sheet.scrollTop;
      }

      if (sheet.zoomRatio != null) {
        sheetout.zoomRatio = sheet.zoomRatio;
      }

      if (sheet.showGridLines != null) {
        sheetout.showGridLines = sheet.showGridLines;
      }

      if (sheet.defaultColWidth != null) {
        sheetout.defaultColWidth = sheet.defaultColWidth;
      }

      if (sheet.defaultRowHeight != null) {
        sheetout.defaultRowHeight = sheet.defaultRowHeight;
      }

      // https://github.com/ruilisi/fortune-sheet/issues/299
      // every cell of every merge -> its merge (anchors get rs/cs)
      const merges = new Map();
      if (sheet.config?.merge) {
        for (const { r, c, rs, cs } of Object.values(sheet.config.merge)) {
          // huge merges (whole rows/columns) are resolved per cell below
          if (!(rs * cs <= 100000)) continue;
          for (let i = r; i < r + rs; i++)
            for (let j = c; j < c + cs; j++)
              if (i !== r || j !== c) merges.set(i + "_" + j, { r, c });
          merges.set(r + "_" + c, { r, c, rs, cs });
        }
      }
      const bigMerges = Object.values(sheet.config?.merge ?? {}).filter(
        (m) => !(m.rs * m.cs <= 100000)
      );
      const plain = (o: any) => Object.getPrototypeOf(o) === Object.prototype;

      if (sheet.celldata != null) {
        // Plain objects matter here (immer can only draft plain objects)
        sheetout.celldata = new Array(sheet.celldata.length);
        let n = 0;
        for (let { r, c, v } of sheet.celldata) {
          if (v != null && typeof v === "object") {
            if (!plain(v)) {
              const { ...xv } = v;
              v = xv;
            }
            if (v.ct && !plain(v.ct)) {
              const { ...ct } = v.ct;
              v.ct = ct;
            }
            let merge = merges.size ? merges.get(r + "_" + c) : undefined;
            if (merge == null && bigMerges.length) {
              const range = bigMerges.find(
                (m) => r >= m.r && r < m.r + m.rs && c >= m.c && c < m.c + m.cs
              );
              if (range) {
                merge =
                  range.r === r && range.c === c
                    ? { r, c, rs: range.rs, cs: range.cs }
                    : { r: range.r, c: range.c };
              }
            }
            if (merge != null) {
              v.mc = { ...merge };
              if (merge.r !== r || merge.c !== c) v = { mc: v.mc };
            }
          }
          sheetout.celldata[n++] = { r, c, v };
        }
        sheetout.celldata.length = n;
      }

      if (sheet.chart != null) {
        sheetout.chart = sheet.chart;
      }

      if (sheet.isPivotTable != null) {
        sheetout.isPivotTable = sheet.isPivotTable;
      }

      if (sheet.pivotTable != null) {
        sheetout.pivotTable = sheet.pivotTable;
      }

      if (sheet.luckysheet_conditionformat_save != null) {
        sheetout.luckysheet_conditionformat_save =
          sheet.luckysheet_conditionformat_save;
      }

      if (sheet.freezen != null) {
        sheetout.freezen = sheet.freezen;
      }

      if (sheet.frozen != null) {
        sheetout.frozen = sheet.frozen;
      }

      if (sheet.calcChain != null) {
        sheetout.calcChain = sheet.calcChain;
      }

      if (sheet.images != null) {
        sheetout.images = Object.entries(sheet.images).map(
          ([id, image]: any) => ({
            ...image,
            id,
            left: image.default?.left ?? 0,
            top: image.default?.top ?? 0,
            width: image.default?.width ?? image.originWidth ?? 0,
            height: image.default?.height ?? image.originHeight ?? 0,
          })
        );
      }

      let chartObjects = (sheet as any).chartObjects as any[] | undefined;
      if (chartObjects != null && chartObjects.length > 0) {
        sheetout.charts = chartObjects.map((item) => ({
          ...item.chart,
          id: generateChartId(),
          left: item.default?.left ?? 0,
          top: item.default?.top ?? 0,
          width: item.default?.width || item.originWidth || 480,
          height: item.default?.height || item.originHeight || 288,
        }));
      }

      if (sheet.dataVerification != null) {
        sheetout.dataVerification = sheet.dataVerification;
      }

      if ((sheet as any).tables != null) {
        sheetout.tables = (sheet as any).tables;
      }

      if ((sheet as any).threadedComments != null) {
        sheetout.threadedComments = (sheet as any).threadedComments;
      }
      if ((sheet as any).pageSetup != null) {
        sheetout.pageSetup = (sheet as any).pageSetup;
      }
      if ((sheet as any).sparklineGroups != null) {
        sheetout.sparklineGroups = (sheet as any).sparklineGroups;
      }
      if ((sheet as any).shapes != null) {
        sheetout.shapes = (sheet as any).shapes;
      }
      // PivotTables (common/pivotTables.ts readPivotTables)
      if ((sheet as any).pivotTables != null) {
        sheetout.pivotTables = (sheet as any).pivotTables;
      }

      if (sheet.hyperlink != null) {
        sheetout.hyperlink = sheet.hyperlink;
      }

      if (sheet.hide != null) {
        sheetout.hide = sheet.hide;
      }

      if ((sheet as any).calcSettings != null) {
        sheetout.calcSettings = (sheet as any).calcSettings;
      }
      // set by feature readers (importProtection.ts)
      ["showRowColHeaders", "rightToLeft", "workbookProtection"].forEach(
        (key) => {
          if ((sheet as any)[key] != null) sheetout[key] = (sheet as any)[key];
        }
      );

      FortuneOutPutFile.sheets.push(sheetout);
    }

    this.attachDefinedNames(FortuneOutPutFile.sheets);

    return FortuneOutPutFile;
  }
}
