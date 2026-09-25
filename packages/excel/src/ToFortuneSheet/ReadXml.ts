import { IuploadfileList, IattributeList, stringToNum } from "../common/ICommon";
import { indexedColors } from "../common/constant";
import { LightenDarkenColor } from "../common/method";

/** Compiled tag patterns, shared by every reader (they are stateless). */
const tagPatternCache = new Map<string, RegExp>();

/**
 * OOXML writers disagree on prefixes: Excel uses `xdr:`/`c:`, openpyxl often
 * puts the same local names in a default xmlns. Match either form.
 */
function tagMatchNames(tag: string): string[] {
  const names = [tag];
  const colon = tag.indexOf(":");
  if (colon > -1) {
    const localName = tag.substr(colon + 1);
    if (localName.length > 0 && names.indexOf(localName) == -1) {
      names.push(localName);
    }
  }
  return names;
}

function tagPattern(tag: string): string {
  return tagMatchNames(tag)
    .map(
      (t) =>
        "<" +
        t +
        "\\s[^>]*?[^/]>[\\s\\S]*?</" +
        t +
        ">|<" +
        t +
        "\\s[^>]*?/>|<" +
        t +
        ">[\\s\\S]*?</" +
        t +
        ">|<" +
        t +
        "/>"
    )
    .join("|");
}

/** The global regular expression matching `tag` ("a|b" for alternatives). */
function tagRegExp(tag: string): RegExp {
  let re = tagPatternCache.get(tag);
  if (!re) {
    const source =
      tag.indexOf("|") > -1
        ? tag.split("|").map(tagPattern).join("|")
        : tagPattern(tag);
    re = new RegExp(source, "g");
    tagPatternCache.set(tag, re);
  }
  return re;
}

class xmloperation {
  /**
   * @param tag Search xml tag name , div,title etc.
   * @param file Xml string
   * @return Xml element string
   */
  protected getElementsByOneTag(tag: string, file: string): string[] {
    if (!file) return [];
    // cheap pre-check: none of the names occurs at all
    const names = tag.split("|");
    let present = false;
    for (let i = 0; i < names.length && !present; i++) {
      const candidates = tagMatchNames(names[i]);
      for (let j = 0; j < candidates.length; j++) {
        if (file.indexOf("<" + candidates[j]) > -1) {
          present = true;
          break;
        }
      }
    }
    if (!present) return [];
    const ret = file.match(tagRegExp(tag));
    return ret == null ? [] : ret;
  }
}

export class ReadXml extends xmloperation {
  originFile: IuploadfileList;
  constructor(files: IuploadfileList) {
    super();
    this.originFile = files;
  }
  /**
   * @param path Search xml tag group , div,title etc.
   * @param fileName One of uploadfileList, uploadfileList is file group, {key:value}
   * @return Xml element calss
   */
  getElementsByTagName(path: string, fileName: string): Element[] {
    let file = this.getFileByName(fileName);
    let pathArr = path.split("/"),
      ret: string[] | string;
    for (let key in pathArr) {
      let path = pathArr[key];
      if (ret == undefined) {
        ret = this.getElementsByOneTag(path, file);
      } else {
        if (ret instanceof Array) {
          let items: string[] = [];
          for (let key in ret) {
            let item = ret[key];
            items = items.concat(this.getElementsByOneTag(path, item));
          }
          ret = items;
        } else {
          ret = this.getElementsByOneTag(path, ret);
        }
      }
    }

    let elements: Element[] = [];

    for (let i = 0; i < ret.length; i++) {
      let ele = new Element(ret[i]);
      elements.push(ele);
    }

    return elements;
  }

  /** Text of a part (exact path, or the first path containing `name`). */
  getFileText(name: string): string {
    return this.getFileByName(name);
  }

  /**
   * @param name One of uploadfileList's name, search for file by this parameter
   * @retrun Select a file from uploadfileList
   */
  private getFileByName(name: string): string {
    if (name == null) return "";
    const exact = this.originFile[name];
    if (typeof exact === "string") return exact;
    for (let fileKey in this.originFile) {
      if (fileKey.indexOf(name) > -1) {
        const file = this.originFile[fileKey];
        return typeof file === "string" ? file : "";
      }
    }
    return "";
  }
}

const ATTRIBUTE_RE = /([^\s=/<>"']+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;

export class Element extends xmloperation {
  elementString: string;
  attributeList: IattributeList;
  value: string;
  container: string;
  constructor(str: string) {
    super();
    this.elementString = str;
    this.setValue();
    this.attributeList = {};
    const container = this.container ?? "";
    // attributes of the start tag (not of its name)
    const nameEnd = container.search(/[\s/>]/);
    ATTRIBUTE_RE.lastIndex = nameEnd > 0 ? nameEnd : 0;
    let m = ATTRIBUTE_RE.exec(container);
    while (m) {
      const value = m[2] !== undefined ? m[2] : m[3];
      if (m[1].length > 0) this.attributeList[m[1]] = value;
      m = ATTRIBUTE_RE.exec(container);
    }
  }

  /**
   * @param name Get attribute by key in element
   * @return Single attribute
   */
  get(name: string): string | number | boolean {
    return this.attributeList[name];
  }

  /**
   * @param tag Get elements by tag in elementString
   * @return Element group
   */
  getInnerElements(tag: string): Element[] {
    let ret = this.getElementsByOneTag(tag, this.elementString);
    let elements: Element[] = [];

    for (let i = 0; i < ret.length; i++) {
      let ele = new Element(ret[i]);
      elements.push(ele);
    }

    if (elements.length == 0) {
      return null;
    }
    return elements;
  }

  /**
   * @desc get xml dom value and container, <container>value</container>
   */
  private setValue() {
    const str = this.elementString;
    if (str.substr(str.length - 2, 2) == "/>") {
      this.value = "";
      this.container = str;
      return;
    }
    // the start tag ends at the first ">" outside quotes
    let quote = 0;
    let end = -1;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      if (quote) {
        if (ch === quote) quote = 0;
      } else if (ch === 34 || ch === 39) {
        quote = ch;
      } else if (ch === 62) {
        end = i + 1;
        break;
      }
    }
    if (end < 0) {
      this.container = str;
      this.value = "";
      return;
    }
    this.container = str.slice(0, end);
    const close = str.lastIndexOf("</");
    this.value = close >= end ? str.slice(end, close) : "";
  }
}

export interface IStyleCollections {
  [index: string]: Element[] | IattributeList;
}

function combineIndexedColor(
  indexedColorsInner: Element[],
  indexedColors: IattributeList
): IattributeList {
  let ret: IattributeList = {};
  if (indexedColorsInner == null || indexedColorsInner.length == 0) {
    return indexedColors;
  }
  for (let key in indexedColors) {
    let value = indexedColors[key],
      kn = parseInt(key);
    let inner = indexedColorsInner[kn];
    if (inner == null) {
      ret[key] = value;
    } else {
      let rgb = inner.attributeList.rgb;
      ret[key] = rgb;
    }
  }

  return ret;
}

//clrScheme:Element[]
export function getColor(
  color: Element,
  styles: IStyleCollections,
  type: string = "g"
) {
  let attrList = color.attributeList;
  let clrScheme = styles["clrScheme"] as Element[];
  let indexedColorsInner = styles["indexedColors"] as Element[];
  let mruColorsInner = styles["mruColors"];
  let indexedColorsList = combineIndexedColor(
    indexedColorsInner,
    indexedColors
  );
  let indexed = attrList.indexed,
    rgb = attrList.rgb,
    theme = attrList.theme,
    tint = attrList.tint;
  let bg;
  if (indexed != null) {
    let indexedNum = parseInt(indexed);
    bg = indexedColorsList[indexedNum];
    if (bg != null) {
      bg = bg.substring(bg.length - 6, bg.length);
      bg = "#" + bg;
    }
  } else if (rgb != null) {
    rgb = rgb.substring(rgb.length - 6, rgb.length);
    bg = "#" + rgb;
  } else if (theme != null) {
    let themeNum = parseInt(theme);
    if (themeNum == 0) {
      themeNum = 1;
    } else if (themeNum == 1) {
      themeNum = 0;
    } else if (themeNum == 2) {
      themeNum = 3;
    } else if (themeNum == 3) {
      themeNum = 2;
    }
    let clrSchemeElement = clrScheme[themeNum];
    if (clrSchemeElement != null) {
      let clrs = clrSchemeElement.getInnerElements("a:sysClr|a:srgbClr");
      if (clrs != null) {
        let clr = clrs[0];
        let clrAttrList = clr.attributeList;
        // console.log(clr.container, );
        if (clr.container.indexOf("sysClr") > -1) {
          // if(type=="g" && clrAttrList.val=="windowText"){
          //     bg = null;
          // }
          // else if((type=="t" || type=="b") && clrAttrList.val=="window"){
          //     bg = null;
          // }
          // else
          if (clrAttrList.lastClr != null) {
            bg = "#" + clrAttrList.lastClr;
          } else if (clrAttrList.val != null) {
            bg = "#" + clrAttrList.val;
          }
        } else if (clr.container.indexOf("srgbClr") > -1) {
          // console.log(clrAttrList.val);
          bg = "#" + clrAttrList.val;
        }
      }
    }
  }

  if (tint != null) {
    let tintNum = parseFloat(tint);
    if (bg != null) {
      bg = LightenDarkenColor(bg, tintNum);
    }
  }

  return bg;
}

/**
 * @dom xml attribute object
 * @attr attribute name
 * @d if attribute is null, return default value
 * @return attribute value
 */
export function getlineStringAttr(frpr: Element, attr: string): string {
  let attrEle = frpr.getInnerElements(attr),
    value;

  if (attrEle != null && attrEle.length > 0) {
    if (attr == "b" || attr == "i" || attr == "strike") {
      value = "1";
    } else if (attr == "u") {
      let v = attrEle[0].attributeList.val;
      if (v == "double") {
        value = "2";
      } else if (v == "singleAccounting") {
        value = "3";
      } else if (v == "doubleAccounting") {
        value = "4";
      } else {
        value = "1";
      }
    } else if (attr == "vertAlign") {
      let v = attrEle[0].attributeList.val;
      if (v == "subscript") {
        value = "1";
      } else if (v == "superscript") {
        value = "2";
      }
    } else {
      value = attrEle[0].attributeList.val;
    }
  }

  return value;
}
