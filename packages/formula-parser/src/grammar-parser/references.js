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
