/**
 * Static reference extraction from a formula AST (for dependency tracking).
 */
import { referenceInfo } from "./evaluator";

function bindingKey(node) {
  if (node.type === "name" || (node.type === "cell" && node.key)) {
    return node.key;
  }

  return null;
}

function sameSheet(a, b) {
  if (a == null || b == null) {
    return a == null && b == null;
  }

  return String(a).toUpperCase() === String(b).toUpperCase();
}

// Bounding box of reference descriptors on one sheet (-1 = whole span).
function boundingInfo(infos) {
  const first = infos[0];
  const box = { ...first };

  for (let i = 1; i < infos.length; i++) {
    const info = infos[i];

    if (!sameSheet(first.sheetName, info.sheetName)) {
      return null;
    }
    if (box.startRow === -1 || info.startRow === -1) {
      box.startRow = -1;
      box.endRow = -1;
    } else {
      box.startRow = Math.min(box.startRow, info.startRow);
      box.endRow = Math.max(box.endRow, info.endRow);
    }
    if (box.startColumn === -1 || info.startColumn === -1) {
      box.startColumn = -1;
      box.endColumn = -1;
    } else {
      box.startColumn = Math.min(box.startColumn, info.startColumn);
      box.endColumn = Math.max(box.endColumn, info.endColumn);
    }
  }

  return box;
}

function walk(node, bound, out) {
  if (!node || typeof node !== "object") {
    return;
  }
  switch (node.type) {
    case "cell":
      if (!(node.key && bound.has(node.key))) {
        out.push(referenceInfo(node.rect));
      }
      break;
    case "range":
    case "wholeRange":
      out.push(referenceInfo(node.rect));
      break;
    case "binary":
    case "intersect":
      walk(node.left, bound, out);
      walk(node.right, bound, out);
      break;
    case "union":
      node.items.forEach((item) => walk(item, bound, out));
      break;
    case "rangeRef": {
      // A1:INDEX(B:B,5) spans the bounding box of the references it is
      // built from, which a dependency tracker must watch as a whole.
      const inner = [];

      walk(node.left, bound, inner);
      walk(node.right, bound, inner);
      out.push(...inner);
      if (inner.length > 1) {
        const box = boundingInfo(inner);

        if (box) {
          out.push(box);
        }
      }
      break;
    }
    case "negate":
    case "plus":
    case "percent":
    case "implicit":
      walk(node.value, bound, out);
      break;
    case "invoke":
      walk(node.callee, bound, out);
      node.args.forEach((arg) => walk(arg, bound, out));
      break;
    case "call": {
      const { key, args } = node;

      if ((key === "LET" || key === "LAMBDA") && args.length > 0) {
        const inner = new Set(bound);

        if (key === "LET") {
          for (let i = 0; i + 1 < args.length; i += 2) {
            walk(args[i + 1], inner, out);
            const name = bindingKey(args[i]);

            if (name) {
              inner.add(name);
            }
          }
          walk(args[args.length - 1], inner, out);
        } else {
          args.slice(0, -1).forEach((arg) => {
            const name = bindingKey(arg);

            if (name) {
              inner.add(name);
            }
          });
          walk(args[args.length - 1], inner, out);
        }
        break;
      }
      args.forEach((arg) => walk(arg, bound, out));
      break;
    }
    default:
      break;
  }
}

/**
 * @param {Object} ast
 * @returns {Array} Reference descriptors in source order.
 */
export function collectReferences(ast) {
  const out = [];

  walk(ast, new Set(), out);

  return out;
}
