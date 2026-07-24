import fs from "fs";

const path = new URL("../src/ToFortuneSheet/FortuneSheet.ts", import.meta.url);
let s = fs.readFileSync(path, "utf8");

const startMarker =
  "  private renderChartSvg(chartFile: string, width: number, height: number) {";
const endMarker = "  private getChartSeriesColor(series: Element, index: number) {";
const start = s.indexOf(startMarker);
const end = s.indexOf(endMarker);
if (start < 0 || end < 0) {
  console.error("markers not found", start, end);
  process.exit(1);
}

const dollarRegexLine =
  "    let normalized = reference.replace(/\\$/g, \"\");";

const replacement = `  private buildChartSpec(
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
    if (seriesElements == null) {
      return {
        type: "bar",
        width: width,
        height: height,
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
        mode: mode,
      });
    }

    return {
      type: "bar",
      width: width,
      height: height,
      series: series,
    };
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
${dollarRegexLine}
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

`;

s = s.slice(0, start) + replacement + s.slice(end);
fs.writeFileSync(path, s);
console.log("ok", start, end);
console.log("dollar line:", dollarRegexLine);
