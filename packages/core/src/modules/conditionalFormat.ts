import type { SingleRange } from "../types";

export function cfSplitRange(
  range1: SingleRange,
  range2: SingleRange,
  range3: SingleRange,
  type: string
) {
  let range: SingleRange[] = [];

  const offset_r = range3.row[0] - range2.row[0];
  const offset_c = range3.column[0] - range2.column[0];

  const r1 = range1.row[0];
  const r2 = range1.row[1];
  const c1 = range1.column[0];
  const c2 = range1.column[1];

  if (
    r1 >= range2.row[0] &&
    r2 <= range2.row[1] &&
    c1 >= range2.column[0] &&
    c2 <= range2.column[1]
  ) {
    if (type === "allPart") {
      range = [
        {
          row: [r1 + offset_r, r2 + offset_r],
          column: [c1 + offset_c, c2 + offset_c],
        },
      ];
    } else if (type === "restPart") {
      range = [];
    } else if (type === "operatePart") {
      range = [
        {
          row: [r1 + offset_r, r2 + offset_r],
          column: [c1 + offset_c, c2 + offset_c],
        },
      ];
    }
  } else if (
    r1 >= range2.row[0] &&
    r1 <= range2.row[1] &&
    c1 >= range2.column[0] &&
    c2 <= range2.column[1]
  ) {
    if (type === "allPart") {
      range = [
        { row: [range2.row[1] + 1, r2], column: [c1, c2] },
        {
          row: [r1 + offset_r, range2.row[1] + offset_r],
          column: [c1 + offset_c, c2 + offset_c],
        },
      ];
    } else if (type === "restPart") {
      range = [{ row: [range2.row[1] + 1, r2], column: [c1, c2] }];
    } else if (type === "operatePart") {
      range = [
        {
          row: [r1 + offset_r, range2.row[1] + offset_r],
          column: [c1 + offset_c, c2 + offset_c],
        },
      ];
    }
  } else if (
    r2 >= range2.row[0] &&
    r2 <= range2.row[1] &&
    c1 >= range2.column[0] &&
    c2 <= range2.column[1]
  ) {
    if (type === "allPart") {
      range = [
        { row: [r1, range2.row[0] - 1], column: [c1, c2] },
        {
          row: [range2.row[0] + offset_r, r2 + offset_r],
          column: [c1 + offset_c, c2 + offset_c],
        },
      ];
    } else if (type === "restPart") {
      range = [{ row: [r1, range2.row[0] - 1], column: [c1, c2] }];
    } else if (type === "operatePart") {
      range = [
        {
          row: [range2.row[0] + offset_r, r2 + offset_r],
          column: [c1 + offset_c, c2 + offset_c],
        },
      ];
    }
  } else if (
    r1 < range2.row[0] &&
    r2 > range2.row[1] &&
    c1 >= range2.column[0] &&
    c2 <= range2.column[1]
  ) {
    if (type === "allPart") {
      range = [
        { row: [r1, range2.row[0] - 1], column: [c1, c2] },
        { row: [range2.row[1] + 1, r2], column: [c1, c2] },
        {
          row: [range2.row[0] + offset_r, range2.row[1] + offset_r],
          column: [c1 + offset_c, c2 + offset_c],
        },
      ];
    } else if (type === "restPart") {
      range = [
        { row: [r1, range2.row[0] - 1], column: [c1, c2] },
        { row: [range2.row[1] + 1, r2], column: [c1, c2] },
      ];
    } else if (type === "operatePart") {
      range = [
        {
          row: [range2.row[0] + offset_r, range2.row[1] + offset_r],
          column: [c1 + offset_c, c2 + offset_c],
        },
      ];
    }
  } else if (
    c1 >= range2.column[0] &&
    c1 <= range2.column[1] &&
    r1 >= range2.row[0] &&
    r2 <= range2.row[1]
  ) {
    if (type === "allPart") {
      range = [
        { row: [r1, r2], column: [range2.column[1] + 1, c2] },
        {
          row: [r1 + offset_r, r2 + offset_r],
          column: [c1 + offset_c, range2.column[1] + offset_c],
        },
      ];
    } else if (type === "restPart") {
      range = [{ row: [r1, r2], column: [range2.column[1] + 1, c2] }];
    } else if (type === "operatePart") {
      range = [
        {
          row: [r1 + offset_r, r2 + offset_r],
          column: [c1 + offset_c, range2.column[1] + offset_c],
        },
      ];
    }
  } else if (
    c2 >= range2.column[0] &&
    c2 <= range2.column[1] &&
    r1 >= range2.row[0] &&
    r2 <= range2.row[1]
  ) {
    if (type === "allPart") {
      range = [
        { row: [r1, r2], column: [c1, range2.column[0] - 1] },
        {
          row: [r1 + offset_r, r2 + offset_r],
          column: [range2.column[0] + offset_c, c2 + offset_c],
        },
      ];
    } else if (type === "restPart") {
      range = [{ row: [r1, r2], column: [c1, range2.column[0] - 1] }];
    } else if (type === "operatePart") {
      range = [
        {
          row: [r1 + offset_r, r2 + offset_r],
          column: [range2.column[0] + offset_c, c2 + offset_c],
        },
      ];
    }
  } else if (
    c1 < range2.column[0] &&
    c2 > range2.column[1] &&
    r1 >= range2.row[0] &&
    r2 <= range2.row[1]
  ) {
    if (type === "allPart") {
      range = [
        { row: [r1, r2], column: [c1, range2.column[0] - 1] },
        { row: [r1, r2], column: [range2.column[1] + 1, c2] },
        {
          row: [r1 + offset_r, r2 + offset_r],
          column: [range2.column[0] + offset_c, range2.column[1] + offset_c],
        },
      ];
    } else if (type === "restPart") {
      range = [
        { row: [r1, r2], column: [c1, range2.column[0] - 1] },
        { row: [r1, r2], column: [range2.column[1] + 1, c2] },
      ];
    } else if (type === "operatePart") {
      range = [
        {
          row: [r1 + offset_r, r2 + offset_r],
          column: [range2.column[0] + offset_c, range2.column[1] + offset_c],
        },
      ];
    }
  } else if (
    r1 >= range2.row[0] &&
    r1 <= range2.row[1] &&
    c1 >= range2.column[0] &&
    c1 <= range2.column[1]
  ) {
    if (type === "allPart") {
      range = [
        { row: [r1, range2.row[1]], column: [range2.column[1] + 1, c2] },
        { row: [range2.row[1] + 1, r2], column: [c1, c2] },
        {
          row: [r1 + offset_r, range2.row[1] + offset_r],
          column: [c1 + offset_c, range2.column[1] + offset_c],
        },
      ];
    } else if (type === "restPart") {
      range = [
        { row: [r1, range2.row[1]], column: [range2.column[1] + 1, c2] },
        { row: [range2.row[1] + 1, r2], column: [c1, c2] },
      ];
    } else if (type === "operatePart") {
      range = [
        {
          row: [r1 + offset_r, range2.row[1] + offset_r],
          column: [c1 + offset_c, range2.column[1] + offset_c],
        },
      ];
    }
  } else if (
    r1 >= range2.row[0] &&
    r1 <= range2.row[1] &&
    c2 >= range2.column[0] &&
    c2 <= range2.column[1]
  ) {
    if (type === "allPart") {
      range = [
        { row: [r1, range2.row[1]], column: [c1, range2.column[0] - 1] },
        { row: [range2.row[1] + 1, r2], column: [c1, c2] },
        {
          row: [r1 + offset_r, range2.row[1] + offset_r],
          column: [range2.column[0] + offset_c, c2 + offset_c],
        },
      ];
    } else if (type === "restPart") {
      range = [
        { row: [r1, range2.row[1]], column: [c1, range2.column[0] - 1] },
        { row: [range2.row[1] + 1, r2], column: [c1, c2] },
      ];
    } else if (type === "operatePart") {
      range = [
        {
          row: [r1 + offset_r, range2.row[1] + offset_r],
          column: [range2.column[0] + offset_c, c2 + offset_c],
        },
      ];
    }
  } else if (
    r2 >= range2.row[0] &&
    r2 <= range2.row[1] &&
    c1 >= range2.column[0] &&
    c1 <= range2.column[1]
  ) {
    if (type === "allPart") {
      range = [
        { row: [r1, range2.row[0] - 1], column: [c1, c2] },
        { row: [range2.row[0], r2], column: [range2.column[1] + 1, c2] },
        {
          row: [range2.row[0] + offset_r, r2 + offset_r],
          column: [c1 + offset_c, range2.column[1] + offset_c],
        },
      ];
    } else if (type === "restPart") {
      range = [
        { row: [r1, range2.row[0] - 1], column: [c1, c2] },
        { row: [range2.row[0], r2], column: [range2.column[1] + 1, c2] },
      ];
    } else if (type === "operatePart") {
      range = [
        {
          row: [range2.row[0] + offset_r, r2 + offset_r],
          column: [c1 + offset_c, range2.column[1] + offset_c],
        },
      ];
    }
  } else if (
    r2 >= range2.row[0] &&
    r2 <= range2.row[1] &&
    c2 >= range2.column[0] &&
    c2 <= range2.column[1]
  ) {
    if (type === "allPart") {
      range = [
        { row: [r1, range2.row[0] - 1], column: [c1, c2] },
        { row: [range2.row[0], r2], column: [c1, range2.column[0] - 1] },
        {
          row: [range2.row[0] + offset_r, r2 + offset_r],
          column: [range2.column[0] + offset_c, c2 + offset_c],
        },
      ];
    } else if (type === "restPart") {
      range = [
        { row: [r1, range2.row[0] - 1], column: [c1, c2] },
        { row: [range2.row[0], r2], column: [c1, range2.column[0] - 1] },
      ];
    } else if (type === "operatePart") {
      range = [
        {
          row: [range2.row[0] + offset_r, r2 + offset_r],
          column: [range2.column[0] + offset_c, c2 + offset_c],
        },
      ];
    }
  } else if (
    r1 < range2.row[0] &&
    r2 > range2.row[1] &&
    c1 >= range2.column[0] &&
    c1 <= range2.column[1]
  ) {
    if (type === "allPart") {
      range = [
        { row: [r1, range2.row[0] - 1], column: [c1, c2] },
        {
          row: [range2.row[0], range2.row[1]],
          column: [range2.column[1] + 1, c2],
        },
        { row: [range2.row[1] + 1, r2], column: [c1, c2] },
        {
          row: [range2.row[0] + offset_r, range2.row[1] + offset_r],
          column: [c1 + offset_c, range2.column[1] + offset_c],
        },
      ];
    } else if (type === "restPart") {
      range = [
        { row: [r1, range2.row[0] - 1], column: [c1, c2] },
        {
          row: [range2.row[0], range2.row[1]],
          column: [range2.column[1] + 1, c2],
        },
        { row: [range2.row[1] + 1, r2], column: [c1, c2] },
      ];
    } else if (type === "operatePart") {
      range = [
        {
          row: [range2.row[0] + offset_r, range2.row[1] + offset_r],
          column: [c1 + offset_c, range2.column[1] + offset_c],
        },
      ];
    }
  } else if (
    r1 < range2.row[0] &&
    r2 > range2.row[1] &&
    c2 >= range2.column[0] &&
    c2 <= range2.column[1]
  ) {
    if (type === "allPart") {
      range = [
        { row: [r1, range2.row[0] - 1], column: [c1, c2] },
        {
          row: [range2.row[0], range2.row[1]],
          column: [c1, range2.column[0] - 1],
        },
        { row: [range2.row[1] + 1, r2], column: [c1, c2] },
        {
          row: [range2.row[0] + offset_r, range2.row[1] + offset_r],
          column: [range2.column[0] + offset_c, c2 + offset_c],
        },
      ];
    } else if (type === "restPart") {
      range = [
        { row: [r1, range2.row[0] - 1], column: [c1, c2] },
        {
          row: [range2.row[0], range2.row[1]],
          column: [c1, range2.column[0] - 1],
        },
        { row: [range2.row[1] + 1, r2], column: [c1, c2] },
      ];
    } else if (type === "operatePart") {
      range = [
        {
          row: [range2.row[0] + offset_r, range2.row[1] + offset_r],
          column: [range2.column[0] + offset_c, c2 + offset_c],
        },
      ];
    }
  } else if (
    c1 < range2.column[0] &&
    c2 > range2.column[1] &&
    r1 >= range2.row[0] &&
    r1 <= range2.row[1]
  ) {
    if (type === "allPart") {
      range = [
        { row: [r1, range2.row[1]], column: [c1, range2.column[0] - 1] },
        { row: [r1, range2.row[1]], column: [range2.column[1] + 1, c2] },
        { row: [range2.row[1] + 1, r2], column: [c1, c2] },
        {
          row: [r1 + offset_r, range2.row[1] + offset_r],
          column: [range2.column[0] + offset_c, range2.column[1] + offset_c],
        },
      ];
    } else if (type === "restPart") {
      range = [
        { row: [r1, range2.row[1]], column: [c1, range2.column[0] - 1] },
        { row: [r1, range2.row[1]], column: [range2.column[1] + 1, c2] },
        { row: [range2.row[1] + 1, r2], column: [c1, c2] },
      ];
    } else if (type === "operatePart") {
      range = [
        {
          row: [r1 + offset_r, range2.row[1] + offset_r],
          column: [range2.column[0] + offset_c, range2.column[1] + offset_c],
        },
      ];
    }
  } else if (
    c1 < range2.column[0] &&
    c2 > range2.column[1] &&
    r2 >= range2.row[0] &&
    r2 <= range2.row[1]
  ) {
    if (type === "allPart") {
      range = [
        { row: [r1, range2.row[0] - 1], column: [c1, c2] },
        { row: [range2.row[0], r2], column: [c1, range2.column[0] - 1] },
        { row: [range2.row[0], r2], column: [range2.column[1] + 1, c2] },
        {
          row: [range2.row[0] + offset_r, r2 + offset_r],
          column: [range2.column[0] + offset_c, range2.column[1] + offset_c],
        },
      ];
    } else if (type === "restPart") {
      range = [
        { row: [r1, range2.row[0] - 1], column: [c1, c2] },
        { row: [range2.row[0], r2], column: [c1, range2.column[0] - 1] },
        { row: [range2.row[0], r2], column: [range2.column[1] + 1, c2] },
      ];
    } else if (type === "operatePart") {
      range = [
        {
          row: [range2.row[0] + offset_r, r2 + offset_r],
          column: [range2.column[0] + offset_c, range2.column[1] + offset_c],
        },
      ];
    }
  } else if (
    r1 < range2.row[0] &&
    r2 > range2.row[1] &&
    c1 < range2.column[0] &&
    c2 > range2.column[1]
  ) {
    if (type === "allPart") {
      range = [
        { row: [r1, range2.row[0] - 1], column: [c1, c2] },
        {
          row: [range2.row[0], range2.row[1]],
          column: [c1, range2.column[0] - 1],
        },
        {
          row: [range2.row[0], range2.row[1]],
          column: [range2.column[1] + 1, c2],
        },
        { row: [range2.row[1] + 1, r2], column: [c1, c2] },
        {
          row: [range2.row[0] + offset_r, range2.row[1] + offset_r],
          column: [range2.column[0] + offset_c, range2.column[1] + offset_c],
        },
      ];
    } else if (type === "restPart") {
      range = [
        { row: [r1, range2.row[0] - 1], column: [c1, c2] },
        {
          row: [range2.row[0], range2.row[1]],
          column: [c1, range2.column[0] - 1],
        },
        {
          row: [range2.row[0], range2.row[1]],
          column: [range2.column[1] + 1, c2],
        },
        { row: [range2.row[1] + 1, r2], column: [c1, c2] },
      ];
    } else if (type === "operatePart") {
      range = [
        {
          row: [range2.row[0] + offset_r, range2.row[1] + offset_r],
          column: [range2.column[0] + offset_c, range2.column[1] + offset_c],
        },
      ];
    }
  } else {
    if (type === "allPart") {
      range = [{ row: [r1, r2], column: [c1, c2] }];
    } else if (type === "restPart") {
      range = [{ row: [r1, r2], column: [c1, c2] }];
    } else if (type === "operatePart") {
      range = [];
    }
  }

  return range;
}
