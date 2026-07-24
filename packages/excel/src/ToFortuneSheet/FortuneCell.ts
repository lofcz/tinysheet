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
import {
  getcellrange,
  escapeCharacter,
  isChinese,
  isJapanese,
  isKoera,
} from "../common/method";
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

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SHORT_MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const LONG_MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const SHORT_WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LONG_WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

type ExcelDateFormatPart = ExcelDateFormatLiteralPart | ExcelDateFormatTokenPart;

interface ExcelDateFormatLiteralPart {
  type: "literal";
  value: string;
}

interface ExcelDateFormatTokenPart {
  type: "token";
  token: string;
  length: number;
  value: string;
  elapsed?: boolean;
}

interface ExcelDateParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
  elapsedHours: number;
  elapsedMinutes: number;
  elapsedSeconds: number;
}

export class FortuneSheetCelldata extends FortuneSheetCelldataBase {
  _borderObject: IfortuneSheetborderInfoCellForImp;
  _fomulaRef: string;
  _formulaSi: string;
  _formulaType: string;

  private sheetFile: string;
  private readXml: ReadXml;
  private cell: Element;
  private styles: IStyleCollections;
  private sharedStrings: Element[];
  private mergeCells: Element[];

  constructor(
    cell: Element,
    styles: IStyleCollections,
    sharedStrings: Element[],
    mergeCells: Element[],
    sheetFile: string,
    ReadXml: ReadXml
  ) {
    //Private
    super();
    this.cell = cell;
    this.sheetFile = sheetFile;
    this.styles = styles;
    this.sharedStrings = sharedStrings;
    this.readXml = ReadXml;
    this.mergeCells = mergeCells;

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

    if (v == null) {
      v = this.cell.getInnerElements("t");
    }

    let cellXfs = this.styles["cellXfs"] as Element[];
    let cellStyleXfs = this.styles["cellStyleXfs"] as Element[];
    let cellStyles = this.styles["cellStyles"] as Element[];
    let fonts = this.styles["fonts"] as Element[];
    let fills = this.styles["fills"] as Element[];
    let borders = this.styles["borders"] as Element[];
    let numfmts = this.styles["numfmts"] as IattributeList;
    let clrScheme = this.styles["clrScheme"] as Element[];

    let sharedStrings = this.sharedStrings;
    let cellValue = new FortuneSheetCelldataValue();

    if (f != null) {
      let formula = f[0],
        attrList = formula.attributeList;
      let t = attrList.t,
        ref = attrList.ref,
        si = attrList.si;
      let formulaValue = f[0].value;
      if (t == "shared") {
        this._fomulaRef = ref;
        this._formulaType = t;
        this._formulaSi = si;
      }
      // console.log(ref, t, si);
      if (ref != null || (formulaValue != null && formulaValue.length > 0)) {
        formulaValue = escapeCharacter(formulaValue);
        cellValue.f = (formulaValue.startsWith('=') ? "" : "=") + formulaValue;
      }
    }

    let familyFont = null;
    let quotePrefix;
    if (s != null) {
      let sNum = parseInt(s);
      let cellXf = cellXfs[sNum];
      let xfId = cellXf.attributeList.xfId;

      let numFmtId, fontId, fillId, borderId;
      let horizontal,
        vertical,
        wrapText,
        textRotation,
        shrinkToFit,
        indent,
        applyProtection;

      if (xfId != null) {
        let cellStyleXf = cellStyleXfs[parseInt(xfId)];
        let attrList = cellStyleXf.attributeList;

        let applyNumberFormat = attrList.applyNumberFormat;
        let applyFont = attrList.applyFont;
        let applyFill = attrList.applyFill;
        let applyBorder = attrList.applyBorder;
        let applyAlignment = attrList.applyAlignment;
        // let applyProtection = attrList.applyProtection;

        applyProtection = attrList.applyProtection;
        quotePrefix = attrList.quotePrefix;

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
        cellFormat.fa = escapeCharacter(numf);
        // console.log(numf, numFmtId, this.v);
        cellFormat.t = t || "n";
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
              cellValue.fs = parseInt(fs);
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
            if (underline == "single") {
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
          cellValue.tr = 3;
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
          cellValue.tr = 0;
          cellValue.rt = parseInt(textRotation);
        }
      }

      if (shrinkToFit != undefined) {
        //fortunesheet unsupport
      }

      if (indent != undefined) {
        //fortunesheet unsupport
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

    if (v != null) {
      let value = v[0].value;

      if (/&#\d+;/.test(value)) {
        value = this.htmlDecode(value);
      }

      if (t == ST_CellType["SharedString"]) {
        let siIndex = parseInt(v[0].value);
        let sharedSI = sharedStrings[siIndex];

        let rFlag = sharedSI.getInnerElements("r");
        if (rFlag == null) {
          let tFlag = sharedSI.getInnerElements("t");
          if (tFlag != null) {
            let text = "";
            tFlag.forEach((t) => {
              text += t.value;
            });

            text = escapeCharacter(text);

            //isContainMultiType(text) &&
            if (familyFont == "Roman" && text.length > 0) {
              let textArray = text.split("");
              let preWordType: string = null,
                wordText = "",
                preWholef: string = null;
              let wholef = "Times New Roman";
              if (cellValue.ff != null) {
                wholef = cellValue.ff;
              }

              let cellFormat = cellValue.ct;
              if (cellFormat == null) {
                cellFormat = new FortuneSheetCellFormat();
              }

              if (cellFormat.s == null) {
                cellFormat.s = [];
              }

              for (let i = 0; i < textArray.length; i++) {
                let w = textArray[i];
                let type: string = null,
                  ff = wholef;

                if (isChinese(w)) {
                  type = "c";
                  ff = "宋体";
                } else if (isJapanese(w)) {
                  type = "j";
                  ff = "Yu Gothic";
                } else if (isKoera(w)) {
                  type = "k";
                  ff = "Malgun Gothic";
                } else {
                  type = "e";
                }

                if (
                  (type != preWordType && preWordType != null) ||
                  i == textArray.length - 1
                ) {
                  let InlineString: any = {};

                  InlineString.ff = preWholef;

                  if (cellValue.fc != null) {
                    InlineString.fc = cellValue.fc;
                  }

                  if (cellValue.fs != null) {
                    InlineString.fs = cellValue.fs;
                  }

                  if (cellValue.cl != null) {
                    InlineString.cl = cellValue.cl;
                  }

                  if (cellValue.un != null) {
                    InlineString.un = cellValue.un;
                  }

                  if (cellValue.bl != null) {
                    InlineString.bl = cellValue.bl;
                  }

                  if (cellValue.it != null) {
                    InlineString.it = cellValue.it;
                  }

                  if (i == textArray.length - 1) {
                    if (type == preWordType) {
                      InlineString.ff = ff;
                      InlineString.v = wordText + w;
                    } else {
                      InlineString.ff = preWholef;
                      InlineString.v = wordText;
                      cellFormat.s.push(InlineString);

                      let InlineStringLast: any = {};
                      InlineStringLast.ff = ff;
                      InlineStringLast.v = w;
                      if (cellValue.fc != null) {
                        InlineStringLast.fc = cellValue.fc;
                      }

                      if (cellValue.fs != null) {
                        InlineStringLast.fs = cellValue.fs;
                      }

                      if (cellValue.cl != null) {
                        InlineStringLast.cl = cellValue.cl;
                      }

                      if (cellValue.un != null) {
                        InlineStringLast.un = cellValue.un;
                      }

                      if (cellValue.bl != null) {
                        InlineStringLast.bl = cellValue.bl;
                      }

                      if (cellValue.it != null) {
                        InlineStringLast.it = cellValue.it;
                      }
                      cellFormat.s.push(InlineStringLast);

                      break;
                    }
                  } else {
                    InlineString.v = wordText;
                  }

                  cellFormat.s.push(InlineString);

                  wordText = w;
                } else {
                  wordText += w;
                }

                preWordType = type;
                preWholef = ff;
              }

              cellFormat.t = "inlineStr";
              // cellFormat.s = [InlineString];
              cellValue.ct = cellFormat;
              // console.log(cellValue);
            } else {
              text = this.replaceSpecialWrap(text);

              if (text.indexOf("\r\n") > -1 || text.indexOf("\n") > -1) {
                let InlineString: any = {};
                InlineString.v = text;
                let cellFormat = cellValue.ct;
                if (cellFormat == null) {
                  cellFormat = new FortuneSheetCellFormat();
                }

                if (cellValue.ff != null) {
                  InlineString.ff = cellValue.ff;
                }

                if (cellValue.fc != null) {
                  InlineString.fc = cellValue.fc;
                }

                if (cellValue.fs != null) {
                  InlineString.fs = cellValue.fs;
                }

                if (cellValue.cl != null) {
                  InlineString.cl = cellValue.cl;
                }

                if (cellValue.un != null) {
                  InlineString.un = cellValue.un;
                }

                if (cellValue.bl != null) {
                  InlineString.bl = cellValue.bl;
                }

                if (cellValue.it != null) {
                  InlineString.it = cellValue.it;
                }

                cellFormat.t = "inlineStr";
                cellFormat.s = [InlineString];
                cellValue.ct = cellFormat;
              } else {
                cellValue.v = text;
                quotePrefix = "1";
              }
            }
          }
        } else {
          let styles: any = [];
          rFlag.forEach((r) => {
            let tFlag = r.getInnerElements("t");
            let rPr = r.getInnerElements("rPr");

            let InlineString: any = {};

            if (tFlag != null && tFlag.length > 0) {
              let text = tFlag[0].value;
              text = this.replaceSpecialWrap(text);
              text = escapeCharacter(text);
              InlineString.v = text;
            }

            if (rPr != null && rPr.length > 0) {
              let frpr = rPr[0];
              let sz = getlineStringAttr(frpr, "sz"),
                rFont = getlineStringAttr(frpr, "rFont"),
                family = getlineStringAttr(frpr, "family"),
                charset = getlineStringAttr(frpr, "charset"),
                scheme = getlineStringAttr(frpr, "scheme"),
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

              let ff;
              // if(family!=null){
              //     ff = fontFamilys[family];
              // }
              if (rFont != null) {
                ff = rFont;
              }
              if (ff != null) {
                InlineString.ff = ff;
              } else if (cellValue.ff != null) {
                InlineString.ff = cellValue.ff;
              }

              if (color != null) {
                InlineString.fc = color;
              } else if (cellValue.fc != null) {
                InlineString.fc = cellValue.fc;
              }

              if (sz != null) {
                InlineString.fs = parseInt(sz);
              } else if (cellValue.fs != null) {
                InlineString.fs = cellValue.fs;
              }

              if (strike != null) {
                InlineString.cl = parseInt(strike);
              } else if (cellValue.cl != null) {
                InlineString.cl = cellValue.cl;
              }

              if (u != null) {
                InlineString.un = parseInt(u);
              } else if (cellValue.un != null) {
                InlineString.un = cellValue.un;
              }

              if (b != null) {
                InlineString.bl = parseInt(b);
              } else if (cellValue.bl != null) {
                InlineString.bl = cellValue.bl;
              }

              if (i != null) {
                InlineString.it = parseInt(i);
              } else if (cellValue.it != null) {
                InlineString.it = cellValue.it;
              }

              if (vertAlign != null) {
                InlineString.va = parseInt(vertAlign);
              }

              // ff:string | undefined //font family
              // fc:string | undefined//font color
              // fs:number | undefined//font size
              // cl:number | undefined//strike
              // un:number | undefined//underline
              // bl:number | undefined//blod
              // it:number | undefined//italic
              // v:string | undefined
            } else {
              if (InlineString.ff == null && cellValue.ff != null) {
                InlineString.ff = cellValue.ff;
              }

              if (InlineString.fc == null && cellValue.fc != null) {
                InlineString.fc = cellValue.fc;
              }

              if (InlineString.fs == null && cellValue.fs != null) {
                InlineString.fs = cellValue.fs;
              }

              if (InlineString.cl == null && cellValue.cl != null) {
                InlineString.cl = cellValue.cl;
              }

              if (InlineString.un == null && cellValue.un != null) {
                InlineString.un = cellValue.un;
              }

              if (InlineString.bl == null && cellValue.bl != null) {
                InlineString.bl = cellValue.bl;
              }

              if (InlineString.it == null && cellValue.it != null) {
                InlineString.it = cellValue.it;
              }
            }

            styles.push(InlineString);
          });

          let cellFormat = cellValue.ct;
          if (cellFormat == null) {
            cellFormat = new FortuneSheetCellFormat();
          }
          cellFormat.t = "inlineStr";
          cellFormat.s = styles;
          cellValue.ct = cellFormat;
        }
      }
      // to be confirmed
      else if (t == ST_CellType["InlineString"] && v != null) {
        cellValue.v = `${value}`;
      } else {
        value = escapeCharacter(value);
        // Generators (openpyxl/XlsxWriter) often emit `<v></v>` for formulas that
        // were never calculated. An empty string would render as a blank cell and
        // block host recalculation — leave `v` unset so `f` can be evaluated.
        if (cellValue.f != null && (value == null || value === "")) {
          // keep v undefined
        } else {
          cellValue.v = value;
        }
      }
    }

    this.setDateDisplayValue(cellValue);

    if (quotePrefix != null) {
      cellValue.qp = parseInt(quotePrefix);
    }

    return cellValue;
  }

  private setDateDisplayValue(cellValue: FortuneSheetCelldataValue) {
    if (
      cellValue.ct == null ||
      cellValue.ct.fa == null ||
      cellValue.v == null ||
      (cellValue.ct.t != ST_CellType["Number"] &&
        cellValue.ct.t != ST_CellType["Date"])
    ) {
      return;
    }

    const numericValue = Number(cellValue.v);
    if (!isFinite(numericValue)) {
      return;
    }

    try {
      const formattedDate = this.formatExcelDate(cellValue.ct.fa, numericValue);
      if (formattedDate == null) {
        return;
      }

      cellValue.m = formattedDate;
      cellValue.ct.t = ST_CellType["Date"];
    } catch (e) {
      return;
    }
  }

  private formatExcelDate(format: string, serialValue: number): string | null {
    const section = this.getFirstFormatSection(format);
    const parts = this.tokenizeDateFormat(section);

    if (!this.hasDateFormatToken(parts)) {
      return null;
    }

    const dateParts = this.getExcelDateParts(serialValue);
    const use12HourClock = /A\/P|AM\/PM/i.test(section);
    let result = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part.type == "literal") {
        result += part.value;
        continue;
      }

      result += this.formatDateToken(
        part,
        this.getDateToken(parts, i, -1),
        this.getDateToken(parts, i, 1),
        dateParts,
        use12HourClock
      );
    }

    return result;
  }

  private getFirstFormatSection(format: string): string {
    let inQuote = false;

    for (let i = 0; i < format.length; i++) {
      const char = format.charAt(i);
      if (char == "\\") {
        i++;
      } else if (char == "\"") {
        inQuote = !inQuote;
      } else if (char == ";" && !inQuote) {
        return format.slice(0, i);
      }
    }

    return format;
  }

  private tokenizeDateFormat(format: string): ExcelDateFormatPart[] {
    const parts: ExcelDateFormatPart[] = [];

    for (let i = 0; i < format.length; i++) {
      const char = format.charAt(i);
      const lowerChar = char.toLowerCase();

      if (char == "\"") {
        let value = "";
        i++;
        while (i < format.length && format.charAt(i) != "\"") {
          value += format.charAt(i);
          i++;
        }
        if (value.length > 0) {
          parts.push({ type: "literal", value });
        }
      } else if (char == "\\") {
        if (i + 1 < format.length) {
          parts.push({ type: "literal", value: format.charAt(i + 1) });
          i++;
        }
      } else if (char == "_" || char == "*") {
        i++;
      } else if (char == "[") {
        const endIndex = format.indexOf("]", i + 1);
        if (endIndex == -1) {
          parts.push({ type: "literal", value: char });
          continue;
        }

        const bracketValue = format.slice(i + 1, endIndex).toLowerCase();
        if (/^[hms]+$/.test(bracketValue)) {
          parts.push({
            type: "token",
            token: bracketValue.charAt(0),
            length: bracketValue.length,
            value: bracketValue,
            elapsed: true,
          });
        }
        i = endIndex;
      } else if (/^AM\/PM/i.test(format.slice(i))) {
        parts.push({ type: "token", token: "ampm", length: 5, value: "AM/PM" });
        i += 4;
      } else if (/^A\/P/i.test(format.slice(i))) {
        parts.push({ type: "token", token: "ampm", length: 3, value: "A/P" });
        i += 2;
      } else if (/[ymdhs]/.test(lowerChar)) {
        let value = char;
        while (
          i + 1 < format.length &&
          format.charAt(i + 1).toLowerCase() == lowerChar
        ) {
          value += format.charAt(i + 1);
          i++;
        }
        parts.push({
          type: "token",
          token: lowerChar,
          length: value.length,
          value,
        });
      } else {
        parts.push({ type: "literal", value: char });
      }
    }

    return parts;
  }

  private hasDateFormatToken(parts: ExcelDateFormatPart[]): boolean {
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].type == "token") {
        return true;
      }
    }

    return false;
  }

  private getDateToken(
    parts: ExcelDateFormatPart[],
    index: number,
    direction: number
  ): ExcelDateFormatTokenPart | null {
    for (let i = index + direction; i >= 0 && i < parts.length; i += direction) {
      const part = parts[i];
      if (part.type == "token") {
        return part;
      }
    }

    return null;
  }

  private formatDateToken(
    part: ExcelDateFormatTokenPart,
    previousToken: ExcelDateFormatTokenPart | null,
    nextToken: ExcelDateFormatTokenPart | null,
    dateParts: ExcelDateParts,
    use12HourClock: boolean
  ): string {
    if (part.token == "ampm") {
      if (part.value.toUpperCase() == "A/P") {
        return dateParts.hour < 12 ? "A" : "P";
      }
      return dateParts.hour < 12 ? "AM" : "PM";
    }

    if (part.token == "y") {
      if (part.length <= 2) {
        return this.pad(dateParts.year % 100, 2);
      }
      return this.pad(dateParts.year, part.length);
    }

    if (part.token == "d") {
      if (part.length == 1) {
        return dateParts.day.toString();
      }
      if (part.length == 2) {
        return this.pad(dateParts.day, 2);
      }
      if (part.length == 3) {
        return SHORT_WEEKDAY_NAMES[dateParts.weekday];
      }
      return LONG_WEEKDAY_NAMES[dateParts.weekday];
    }

    if (part.token == "h") {
      let hour = part.elapsed ? dateParts.elapsedHours : dateParts.hour;
      if (use12HourClock && !part.elapsed) {
        hour = hour % 12;
        if (hour == 0) {
          hour = 12;
        }
      }
      return part.length > 1 ? this.pad(hour, part.length) : hour.toString();
    }

    if (part.token == "m") {
      const isMinute =
        part.elapsed ||
        (previousToken != null && previousToken.token == "h") ||
        (nextToken != null && nextToken.token == "s");
      if (isMinute) {
        const minute = part.elapsed ? dateParts.elapsedMinutes : dateParts.minute;
        return part.length > 1 ? this.pad(minute, part.length) : minute.toString();
      }

      if (part.length == 1) {
        return dateParts.month.toString();
      }
      if (part.length == 2) {
        return this.pad(dateParts.month, 2);
      }
      if (part.length == 3) {
        return SHORT_MONTH_NAMES[dateParts.month - 1];
      }
      if (part.length == 4) {
        return LONG_MONTH_NAMES[dateParts.month - 1];
      }
      return SHORT_MONTH_NAMES[dateParts.month - 1].charAt(0);
    }

    if (part.token == "s") {
      const second = part.elapsed ? dateParts.elapsedSeconds : dateParts.second;
      return part.length > 1 ? this.pad(second, part.length) : second.toString();
    }

    return part.value;
  }

  private getExcelDateParts(serialValue: number): ExcelDateParts {
    const wholeDays = Math.floor(serialValue);
    const fraction = serialValue - wholeDays;
    let days = wholeDays > 59 ? wholeDays - 1 : wholeDays;
    let milliseconds = Math.round(fraction * MS_PER_DAY);

    if (milliseconds >= MS_PER_DAY) {
      days += Math.floor(milliseconds / MS_PER_DAY);
      milliseconds = milliseconds % MS_PER_DAY;
    }

    const date = new Date(
      Date.UTC(1899, 11, 31) + days * MS_PER_DAY + milliseconds
    );

    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: date.getUTCHours(),
      minute: date.getUTCMinutes(),
      second: date.getUTCSeconds(),
      weekday: date.getUTCDay(),
      elapsedHours: Math.floor(serialValue * 24),
      elapsedMinutes: Math.floor(serialValue * 24 * 60),
      elapsedSeconds: Math.floor(serialValue * 24 * 60 * 60),
    };
  }

  private pad(value: number, length: number): string {
    let result = value.toString();
    while (result.length < length) {
      result = "0" + result;
    }
    return result;
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
