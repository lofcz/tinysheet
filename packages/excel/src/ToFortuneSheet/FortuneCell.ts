import {
  IfortuneSheetborderInfoCellForImp,
} from "./IFortune";
import {
  ReadXml,
  Element,
  IStyleCollections,
  getColor,
  getlineStringAttr,
} from "./ReadXml";
import { formatValue } from "@lofcz/tinysheet-core";
import { getcellrange, escapeCharacter } from "../common/method";
import { fromExcelFormula } from "../common/formulaText";
import {
  ST_CellType,
  borderTypes,
  fontFamilys,
} from "../common/constant";
import { IattributeList } from "../common/ICommon";
import {
  FortuneSheetborderInfoCellValueStyle,
  FortuneSheetborderInfoCellForImp,
  FortuneSheetborderInfoCellValue,
  FortuneSheetCelldataBase,
  FortuneSheetCelldataValue,
  FortuneSheetCellFormat,
} from "./FortuneBase";

export type FortuneCellWorkbookInfo = {
  /** The workbook uses the 1904 date system (serials are shifted on import). */
  date1904?: boolean;
};

/** Days between the 1900 and 1904 date systems. */
const DATE1904_OFFSET = 1462;

/** Cell font attributes a rich-text run inherits when it does not set them. */
const INHERITED_RUN_KEYS = ["ff", "fc", "fs", "cl", "un", "bl", "it"];

/** Whether a number format shows a date or time (first section). */
export function isDateFormat(fa: string | null | undefined) {
  if (!fa || /^general$/i.test(fa)) return false;
  return formatHasDate(fa) || formatHasTime(fa);
}

function formatHasDate(fa: string) {
  const f = stripFormatLiterals(fa.split(";")[0]).toLowerCase();
  if (/[yd]/.test(f) || /(^|[^a-z])e+([^a-z]|$)/.test(f)) return true;
  const mm = f.replace(/h+[^a-z0-9]*m+/g, "").replace(/m+[^a-z0-9]*s/g, "");
  return /m/.test(mm);
}

function formatHasTime(fa: string) {
  const raw = fa.split(";")[0];
  if (/\[(h+|m+|s+)\]/i.test(raw)) return true;
  const f = stripFormatLiterals(raw).toLowerCase();
  return /[hs]/.test(f) || /am\/pm|a\/p/.test(f);
}

function stripFormatLiterals(fa: string) {
  return fa
    .replace(/"[^"]*"/g, "")
    .replace(/\\./g, "")
    .replace(/_./g, "")
    .replace(/\*./g, "")
    .replace(/\[[^\]]*\]/g, "");
}

export class FortuneSheetCelldata extends FortuneSheetCelldataBase {
  _borderObject: IfortuneSheetborderInfoCellForImp;
  _fomulaRef: string;
  _formulaSi: string;
  _formulaType: string;
  /** `ref` of an array formula master (`<f t="array" ref=...>`). */
  _arrayRef: string;
  /** The array formula carries dynamic-array cell metadata (`cm`). */
  _dynamicArray: boolean;

  private sheetFile: string;
  private readXml: ReadXml;
  private cell: Element;
  private styles: IStyleCollections;
  private sharedStrings: Element[];
  private mergeCells: Element[];
  private workbookInfo: FortuneCellWorkbookInfo;

  constructor(
    cell: Element,
    styles: IStyleCollections,
    sharedStrings: Element[],
    mergeCells: Element[],
    sheetFile: string,
    ReadXml: ReadXml,
    workbookInfo: FortuneCellWorkbookInfo = {}
  ) {
    //Private
    super();
    this.cell = cell;
    this.sheetFile = sheetFile;
    this.styles = styles;
    this.sharedStrings = sharedStrings;
    this.readXml = ReadXml;
    this.mergeCells = mergeCells;
    this.workbookInfo = workbookInfo;

    let attrList = cell.attributeList;
    let r = attrList.r,
      s = attrList.s,
      t = attrList.t;
    let range = getcellrange(r);

    this.r = range.row[0];
    this.c = range.column[0];
    this.v = this.generateValue(s, t);
  }

  /**
   * @param s Style index ,start 1
   * @param t Cell type, Optional value is ST_CellType, it's found at constat.ts
   */
  private generateValue(s: string, t: string) {
    let v = this.cell.getInnerElements("v");
    let f = this.cell.getInnerElements("f");

    let cellXfs = this.styles["cellXfs"] as Element[];
    let cellStyleXfs = this.styles["cellStyleXfs"] as Element[];
    let fonts = this.styles["fonts"] as Element[];
    let fills = this.styles["fills"] as Element[];
    let borders = this.styles["borders"] as Element[];
    let numfmts = this.styles["numfmts"] as IattributeList;
    let clrScheme = this.styles["clrScheme"] as Element[];

    let cellValue = new FortuneSheetCelldataValue();

    if (f != null) {
      let formula = f[0],
        attrList = formula.attributeList;
      let ft = attrList.t,
        ref = attrList.ref,
        si = attrList.si;
      let formulaValue = f[0].value;
      if (ft == "shared") {
        this._fomulaRef = ref;
        this._formulaType = ft;
        this._formulaSi = si;
      } else if (ft == "array" && ref != null) {
        this._formulaType = ft;
        this._arrayRef = ref;
        this._dynamicArray = this.cell.attributeList.cm != null;
      }
      if (formulaValue != null && formulaValue.length > 0) {
        cellValue.f = fromExcelFormula(escapeCharacter(formulaValue));
      }
    }


    let familyFont = null;
    let quotePrefix;
    if (s != null) {
      let sNum = parseInt(s);
      let cellXf = cellXfs[sNum] ?? cellXfs[0] ?? new Element("<xf/>");
      let xfId = cellXf.attributeList.xfId;

      let numFmtId, fontId, fillId, borderId;
      let horizontal,
        vertical,
        wrapText,
        textRotation,
        shrinkToFit,
        indent,
        applyProtection,
        locked,
        formulaHidden;
      // <protection locked=".." hidden=".."/> of a style record
      const readProtection = (xf: Element) => {
        const protection = xf.getInnerElements("protection");
        if (protection == null || protection.length === 0) return;
        const attrs = protection[0].attributeList;
        if (attrs.locked != null) locked = attrs.locked;
        if (attrs.hidden != null) formulaHidden = attrs.hidden;
      };

      if (xfId != null) {
        let cellStyleXf =
          cellStyleXfs[parseInt(xfId)] ?? new Element("<xf/>");
        let attrList = cellStyleXf.attributeList;

        let applyNumberFormat = attrList.applyNumberFormat;
        let applyFont = attrList.applyFont;
        let applyFill = attrList.applyFill;
        let applyBorder = attrList.applyBorder;
        let applyAlignment = attrList.applyAlignment;
        // let applyProtection = attrList.applyProtection;

        applyProtection = attrList.applyProtection;
        quotePrefix = attrList.quotePrefix;
        if (applyProtection != null && applyProtection != "0") {
          readProtection(cellStyleXf);
        }

        if (applyNumberFormat != "0" && attrList.numFmtId != null) {
          // if(attrList.numFmtId!="0"){
          numFmtId = attrList.numFmtId;
          // }
        }
        if (applyFont != "0" && attrList.fontId != null) {
          fontId = attrList.fontId;
        }
        if (applyFill != "0" && attrList.fillId != null) {
          fillId = attrList.fillId;
        }
        if (applyBorder != "0" && attrList.borderId != null) {
          borderId = attrList.borderId;
        }
        if (applyAlignment != null && applyAlignment != "0") {
          let alignment = cellStyleXf.getInnerElements("alignment");
          if (alignment != null) {
            let attrList = alignment[0].attributeList;
            if (attrList.horizontal != null) {
              horizontal = attrList.horizontal;
            }
            if (attrList.vertical != null) {
              vertical = attrList.vertical;
            }
            if (attrList.wrapText != null) {
              wrapText = attrList.wrapText;
            }
            if (attrList.textRotation != null) {
              textRotation = attrList.textRotation;
            }
            if (attrList.shrinkToFit != null) {
              shrinkToFit = attrList.shrinkToFit;
            }
            if (attrList.indent != null) {
              indent = attrList.indent;
            }
          }
        }
      }

      let applyNumberFormat = cellXf.attributeList.applyNumberFormat;
      let applyFont = cellXf.attributeList.applyFont;
      let applyFill = cellXf.attributeList.applyFill;
      let applyBorder = cellXf.attributeList.applyBorder;
      let applyAlignment = cellXf.attributeList.applyAlignment;

      if (cellXf.attributeList.applyProtection != null) {
        applyProtection = cellXf.attributeList.applyProtection;
      }
      if (applyProtection != "0") {
        readProtection(cellXf);
      }

      if (cellXf.attributeList.quotePrefix != null) {
        quotePrefix = cellXf.attributeList.quotePrefix;
      }

      if (applyNumberFormat != "0" && cellXf.attributeList.numFmtId != null) {
        numFmtId = cellXf.attributeList.numFmtId;
      }
      if (applyFont != "0") {
        fontId = cellXf.attributeList.fontId;
      }
      if (applyFill != "0") {
        fillId = cellXf.attributeList.fillId;
      }
      if (applyBorder != "0") {
        borderId = cellXf.attributeList.borderId;
      }
      if (applyAlignment != "0") {
        let alignment = cellXf.getInnerElements("alignment");
        if (alignment != null && alignment.length > 0) {
          let attrList = alignment[0].attributeList;
          if (attrList.horizontal != null) {
            horizontal = attrList.horizontal;
          }
          if (attrList.vertical != null) {
            vertical = attrList.vertical;
          }
          if (attrList.wrapText != null) {
            wrapText = attrList.wrapText;
          }
          if (attrList.textRotation != null) {
            textRotation = attrList.textRotation;
          }
          if (attrList.shrinkToFit != null) {
            shrinkToFit = attrList.shrinkToFit;
          }
          if (attrList.indent != null) {
            indent = attrList.indent;
          }
        }
      }

      if (numFmtId != undefined) {
        let numf = numfmts[parseInt(numFmtId)];
        let cellFormat = new FortuneSheetCellFormat();
        cellFormat.fa = numf != null ? escapeCharacter(numf) : "General";
        cellValue.ct = cellFormat;
      }

      if (fillId != undefined) {
        let fillIdNum = parseInt(fillId);
        let fill = fills[fillIdNum];
        // console.log(cellValue.v);
        let bg = this.getBackgroundByFill(fill, clrScheme);
        if (bg != null) {
          cellValue.bg = bg;
        }
      }

      if (fontId != undefined) {
        let fontIdNum = parseInt(fontId);
        let font = fonts[fontIdNum];
        if (font != null) {
          let sz = font.getInnerElements("sz"); //font size
          let colors = font.getInnerElements("color"); //font color
          let family = font.getInnerElements("name"); //font family
          let familyOverrides = font.getInnerElements("family"); //font family will be overrided by name
          let charset = font.getInnerElements("charset"); //font charset
          let bolds = font.getInnerElements("b"); //font bold
          let italics = font.getInnerElements("i"); //font italic
          let strikes = font.getInnerElements("strike"); //font italic
          let underlines = font.getInnerElements("u"); //font italic

          if (sz != null && sz.length > 0) {
            let fs = sz[0].attributeList.val;
            if (fs != null) {
              cellValue.fs = parseFloat(fs);
            }
          }

          if (colors != null && colors.length > 0) {
            let color = colors[0];
            let fc = getColor(color, this.styles, "t");
            if (fc != null) {
              cellValue.fc = fc;
            }
          }

          if (familyOverrides != null && familyOverrides.length > 0) {
            let val = familyOverrides[0].attributeList.val;
            if (val != null) {
              familyFont = fontFamilys[val];
            }
          }

          if (family != null && family.length > 0) {
            let val = family[0].attributeList.val;
            if (val != null) {
              cellValue.ff = val;
            }
          }

          if (bolds != null && bolds.length > 0) {
            let bold = bolds[0].attributeList.val;
            if (bold == "0") {
              cellValue.bl = 0;
            } else {
              cellValue.bl = 1;
            }
          }

          if (italics != null && italics.length > 0) {
            let italic = italics[0].attributeList.val;
            if (italic == "0") {
              cellValue.it = 0;
            } else {
              cellValue.it = 1;
            }
          }

          if (strikes != null && strikes.length > 0) {
            let strike = strikes[0].attributeList.val;
            if (strike == "0") {
              cellValue.cl = 0;
            } else {
              cellValue.cl = 1;
            }
          }

          if (underlines != null && underlines.length > 0) {
            let underline = underlines[0].attributeList.val;
            if (underline == null || underline == "single") {
              cellValue.un = 1;
            } else if (underline == "double") {
              cellValue.un = 2;
            } else if (underline == "singleAccounting") {
              cellValue.un = 3;
            } else if (underline == "doubleAccounting") {
              cellValue.un = 4;
            } else {
              cellValue.un = 0;
            }
          }
        }
      }

      // vt: number | undefined//Vertical alignment, 0 middle, 1 up, 2 down, alignment
      // ht: number | undefined//Horizontal alignment,0 center, 1 left, 2 right, alignment
      // tr: number | undefined //Text rotation,0: 0、1: 45 、2: -45、3 Vertical text、4: 90 、5: -90, alignment
      // tb: number | undefined //Text wrap,0 truncation, 1 overflow, 2 word wrap, alignment

      if (horizontal != undefined) {
        //Horizontal alignment
        if (horizontal == "center") {
          cellValue.ht = 0;
        } else if (horizontal == "centerContinuous") {
          cellValue.ht = 0; //fortunesheet unsupport
        } else if (horizontal == "left") {
          cellValue.ht = 1;
        } else if (horizontal == "right") {
          cellValue.ht = 2;
        } else if (horizontal == "distributed") {
          cellValue.ht = 0; //fortunesheet unsupport
        } else if (horizontal == "fill") {
          cellValue.ht = 1; //fortunesheet unsupport
        } else if (horizontal == "general") {
          cellValue.ht = 1; //fortunesheet unsupport
        } else if (horizontal == "justify") {
          cellValue.ht = 0; //fortunesheet unsupport
        } else {
          cellValue.ht = 1;
        }
      }

      if (vertical != undefined) {
        //Vertical alignment
        if (vertical == "bottom") {
          cellValue.vt = 2;
        } else if (vertical == "center") {
          cellValue.vt = 0;
        } else if (vertical == "distributed") {
          cellValue.vt = 0; //fortunesheet unsupport
        } else if (vertical == "justify") {
          cellValue.vt = 0; //fortunesheet unsupport
        } else if (vertical == "top") {
          cellValue.vt = 1;
        } else {
          cellValue.vt = 1;
        }
      } else {
        //sometimes bottom style is lost after setting it in excel
        //when vertical is undefined set it to 2.
        cellValue.vt = 2;
      }

      if (wrapText != undefined) {
        if (wrapText == "1") {
          cellValue.tb = "2";
        } else {
          cellValue.tb = "1";
        }
      } else {
        cellValue.tb = "1";
      }

      if (textRotation != undefined) {
        // tr: number | undefined //Text rotation,0: 0、1: 45 、2: -45、3 Vertical text、4: 90 、5: -90, alignment
        if (textRotation == "255") {
          cellValue.tr = "3" as any;
        }
        // else if(textRotation=="45"){
        //     cellValue.tr = 1;
        // }
        // else if(textRotation=="90"){
        //     cellValue.tr = 4;
        // }
        // else if(textRotation=="135"){
        //     cellValue.tr = 2;
        // }
        // else if(textRotation=="180"){
        //     cellValue.tr = 5;
        // }
        else {
          cellValue.tr = "0" as any;
          cellValue.rt = parseInt(textRotation);
        }
      }

      const isTrue = (v: any) => v == "1" || v == "true";
      if (shrinkToFit != undefined && isTrue(shrinkToFit)) {
        cellValue.sk = 1;
      }

      if (indent != undefined) {
        const level = parseInt(indent, 10);
        if (level > 0) cellValue.ind = Math.min(level, 250);
      }

      // Excel cells are locked unless the style says otherwise
      if (locked != undefined && !isTrue(locked)) {
        cellValue.lo = 0;
      }
      if (formulaHidden != undefined && isTrue(formulaHidden)) {
        cellValue.hi = 1;
      }

      if (borderId != undefined) {
        let borderIdNum = parseInt(borderId);
        let border = borders[borderIdNum];
        // this._borderId = borderIdNum;

        let borderObject = new FortuneSheetborderInfoCellForImp();
        borderObject.rangeType = "cell";
        // borderObject.cells = [];
        let borderCellValue = new FortuneSheetborderInfoCellValue();

        borderCellValue.row_index = this.r;
        borderCellValue.col_index = this.c;

        let lefts = border.getInnerElements("left");
        let rights = border.getInnerElements("right");
        let tops = border.getInnerElements("top");
        let bottoms = border.getInnerElements("bottom");
        let diagonals = border.getInnerElements("diagonal");

        let starts = border.getInnerElements("start");
        let ends = border.getInnerElements("end");

        let left = this.getBorderInfo(lefts);
        let right = this.getBorderInfo(rights);
        let top = this.getBorderInfo(tops);
        let bottom = this.getBorderInfo(bottoms);
        let diagonal = this.getBorderInfo(diagonals);

        let start = this.getBorderInfo(starts);
        let end = this.getBorderInfo(ends);

        let isAdd = false;

        if (start != null && start.color != null) {
          borderCellValue.l = start;
          isAdd = true;
        }

        if (end != null && end.color != null) {
          borderCellValue.r = end;
          isAdd = true;
        }

        if (left != null && left.color != null) {
          borderCellValue.l = left;
          isAdd = true;
        }

        if (right != null && right.color != null) {
          borderCellValue.r = right;
          isAdd = true;
        }

        if (top != null && top.color != null) {
          borderCellValue.t = top;
          isAdd = true;
        }

        if (bottom != null && bottom.color != null) {
          borderCellValue.b = bottom;
          isAdd = true;
        }

        if (isAdd) {
          borderObject.value = borderCellValue;
          // this.config._borderInfo[borderId] = borderObject;
          this._borderObject = borderObject;
        }
      }
    } else {
      cellValue.tb = "1";
    }

    this.assignValue(cellValue, t, v);

    if (quotePrefix != null) {
      cellValue.qp = parseInt(quotePrefix);
    }

    return cellValue;
  }

  /** Cell value (v / m / ct) from the cell's type and `<v>` / `<is>`. */
  private assignValue(
    cellValue: FortuneSheetCelldataValue,
    t: string,
    v: Element[] | null
  ) {
    const fa = cellValue.ct?.fa;
    const setType = (type: string, format?: string) => {
      const ct = cellValue.ct ?? new FortuneSheetCellFormat();
      ct.fa = format ?? ct.fa ?? "General";
      ct.t = type;
      cellValue.ct = ct;
    };

    if (t == ST_CellType["SharedString"]) {
      if (v == null) return;
      const si = this.sharedStrings[parseInt(v[0].value)];
      if (si != null) this.assignStringItem(cellValue, si);
      return;
    }

    if (t == ST_CellType["InlineString"]) {
      const is = this.cell.getInnerElements("is");
      if (is != null) this.assignStringItem(cellValue, is[0]);
      return;
    }

    if (v == null) {
      if (cellValue.ct != null && cellValue.ct.t == null) cellValue.ct.t = "n";
      return;
    }
    let raw = v[0].value ?? "";
    if (/&#\d+;/.test(raw)) raw = this.htmlDecode(raw);
    raw = escapeCharacter(raw);

    // Generators (openpyxl/XlsxWriter) often emit `<v></v>` for formulas
    // that were never calculated: leave `v` unset so the formula is evaluated.
    if (raw === "" && cellValue.f != null) return;

    if (t == ST_CellType["Boolean"]) {
      const b = raw === "1" || raw.toUpperCase() === "TRUE";
      cellValue.v = b as any;
      cellValue.m = b ? "TRUE" : "FALSE";
      setType("b", "General");
      return;
    }
    if (t == ST_CellType["Error"]) {
      cellValue.v = raw;
      cellValue.m = raw;
      setType("e");
      return;
    }
    if (t == ST_CellType["String"]) {
      const text = this.replaceSpecialWrap(raw);
      cellValue.v = text;
      cellValue.m = text;
      setType(fa === "@" ? "s" : "g");
      return;
    }

    // Numbers (t="n" or no type) and ISO dates (t="d").
    let num = Number(raw);
    if (t == ST_CellType["Date"] && isNaN(num)) {
      const ms = Date.parse(raw);
      if (!isNaN(ms)) num = ms / 86400000 + 25569;
    }
    if (raw.trim() === "" || !isFinite(num)) {
      cellValue.v = raw;
      setType("g");
      return;
    }
    const format = fa ?? "General";
    const isDate = isDateFormat(format);
    if (isDate && this.workbookInfo.date1904) num += DATE1904_OFFSET;
    cellValue.v = num as any;
    cellValue.m = formatValue(format, num);
    setType(isDate ? "d" : "n", format);
  }

  /** Text or rich text of a shared-string / inline-string item. */
  private assignStringItem(cellValue: FortuneSheetCelldataValue, si: Element) {
    // Phonetic runs (<rPh>) are not part of the text.
    const item = new Element(
      si.elementString.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "")
    );
    let rFlag = item.getInnerElements("r");
    if (rFlag == null) {
      let tFlag = item.getInnerElements("t");
      let text = "";
      if (tFlag != null) {
        tFlag.forEach((tt) => {
          text += tt.value;
        });
      }
      text = this.replaceSpecialWrap(escapeCharacter(text));
      if (text.indexOf("\r\n") > -1 || text.indexOf("\n") > -1) {
        let InlineString: any = { v: text.replace(/\r?\n/g, "\r\n") };
        for (const key of INHERITED_RUN_KEYS) {
          if ((cellValue as any)[key] != null) {
            InlineString[key] = (cellValue as any)[key];
          }
        }
        let cellFormat = cellValue.ct ?? new FortuneSheetCellFormat();
        cellFormat.fa = cellFormat.fa ?? "General";
        cellFormat.t = "inlineStr";
        cellFormat.s = [InlineString];
        cellValue.ct = cellFormat;
      } else {
        cellValue.v = text;
        cellValue.m = text;
        let cellFormat = cellValue.ct ?? new FortuneSheetCellFormat();
        cellFormat.fa = cellFormat.fa ?? "General";
        cellFormat.t = cellFormat.fa === "@" ? "s" : "g";
        cellValue.ct = cellFormat;
        // Keep numeric-looking text as text when edited.
        cellValue.qp = 1;
      }
      return;
    }

    let styles: any = [];
    rFlag.forEach((r) => {
      let tFlag = r.getInnerElements("t");
      let rPr = r.getInnerElements("rPr");

      let InlineString: any = {};

      if (tFlag != null && tFlag.length > 0) {
        let text = tFlag[0].value;
        text = this.replaceSpecialWrap(escapeCharacter(text));
        InlineString.v = text.replace(/\r?\n/g, "\r\n");
      }

      if (rPr != null && rPr.length > 0) {
        let frpr = rPr[0];
        let sz = getlineStringAttr(frpr, "sz"),
          rFont = getlineStringAttr(frpr, "rFont"),
          b = getlineStringAttr(frpr, "b"),
          i = getlineStringAttr(frpr, "i"),
          u = getlineStringAttr(frpr, "u"),
          strike = getlineStringAttr(frpr, "strike"),
          vertAlign = getlineStringAttr(frpr, "vertAlign"),
          color;

        let cEle = frpr.getInnerElements("color");
        if (cEle != null && cEle.length > 0) {
          color = getColor(cEle[0], this.styles, "t");
        }

        const pick = (key: string, own: any, parse = (x: any) => x) => {
          if (own != null) InlineString[key] = parse(own);
          else if ((cellValue as any)[key] != null)
            InlineString[key] = (cellValue as any)[key];
        };
        pick("ff", rFont);
        pick("fc", color);
        pick("fs", sz, (x) => parseFloat(x));
        pick("cl", strike, (x) => parseInt(x));
        pick("un", u, (x) => parseInt(x));
        pick("bl", b, (x) => parseInt(x));
        pick("it", i, (x) => parseInt(x));
        if (vertAlign != null) InlineString.va = parseInt(vertAlign);
      } else {
        for (const key of INHERITED_RUN_KEYS) {
          if (InlineString[key] == null && (cellValue as any)[key] != null) {
            InlineString[key] = (cellValue as any)[key];
          }
        }
      }

      styles.push(InlineString);
    });

    let cellFormat = cellValue.ct ?? new FortuneSheetCellFormat();
    cellFormat.fa = cellFormat.fa ?? "General";
    cellFormat.t = "inlineStr";
    cellFormat.s = styles;
    cellValue.ct = cellFormat;
  }


  private replaceSpecialWrap(text: string): string {
    text = text
      .replace(/_x000D_/g, "")
      .replace(/&#13;&#10;/g, "\r\n")
      .replace(/&#13;/g, "\r")
      .replace(/&#10;/g, "\n");
    return text;
  }

  private getBackgroundByFill(
    fill: Element,
    clrScheme: Element[]
  ): string | null {
    let patternFills = fill.getInnerElements("patternFill");
    if (patternFills != null) {
      let patternFill = patternFills[0];
      let fgColors = patternFill.getInnerElements("fgColor");
      let bgColors = patternFill.getInnerElements("bgColor");
      let fg, bg;
      if (fgColors != null) {
        let fgColor = fgColors[0];
        fg = getColor(fgColor, this.styles);
      }

      if (bgColors != null) {
        let bgColor = bgColors[0];
        bg = getColor(bgColor, this.styles);
      }
      // console.log(fgColors,bgColors,clrScheme);
      if (fg != null) {
        return fg;
      } else if (bg != null) {
        return bg;
      }
    } else {
      let gradientfills = fill.getInnerElements("gradientFill");
      if (gradientfills != null) {
        //graient color fill handler

        return null;
      }
    }
  }

  private getBorderInfo(
    borders: Element[]
  ): FortuneSheetborderInfoCellValueStyle {
    if (borders == null) {
      return null;
    }

    let border = borders[0],
      attrList = border.attributeList;
    let clrScheme = this.styles["clrScheme"] as Element[];
    let style: string = attrList.style;
    if (style == null || style == "none") {
      return null;
    }

    let colors = border.getInnerElements("color");
    let colorRet = "#000000";
    if (colors != null) {
      let color = colors[0];
      colorRet = getColor(color, this.styles, "b");
      if (colorRet == null) {
        colorRet = "#000000";
      }
    }

    let ret = new FortuneSheetborderInfoCellValueStyle();
    ret.style = borderTypes[style];
    ret.color = colorRet;

    return ret;
  }

  private htmlDecode(str: string): string {
    return str.replace(/&#(x)?([^&]{1,5});/g, function ($, $1, $2) {
      return String.fromCharCode(parseInt($2, $1 ? 16 : 10));
    });
  }
}
