/**
 * Structured references (`Table1[Col]`, `[@Col]`) between TinySheet and
 * the xlsx format.
 *
 * Inside a table, TinySheet (like Excel's formula bar) writes references to
 * that table unqualified: `[Sales]`, `[@Price]`. The xlsx format stores
 * them qualified, with `@` spelled out: `Table1[Sales]`,
 * `Table1[[#This Row],[Price]]`.
 */

const IDENT_CHAR = /[A-Za-z0-9_.\\À-￿]/;

/** Index of the `]` closing the `[` at `start` (brackets nest, `'` escapes). */
function closingBracket(text: string, start: number) {
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "'") i += 1;
    else if (ch === "[") depth += 1;
    else if (ch === "]") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Walk a formula, calling `onRef(content, before)` for every top-level
 * `[...]` (outside string literals and quoted sheet names), with the text
 * written before it. A returned `text` replaces the brackets, after
 * dropping the last `cut` characters written; null keeps them.
 */
function mapBrackets(
  formula: string,
  onRef: (
    content: string,
    before: string
  ) => { text: string; cut?: number } | null
) {
  let out = "";
  let i = 0;
  while (i < formula.length) {
    const ch = formula[i];
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < formula.length) {
        if (formula[j] === ch && formula[j + 1] === ch) j += 2;
        else if (formula[j] === ch) break;
        else j += 1;
      }
      out += formula.slice(i, j + 1);
      i = j + 1;
    } else if (ch === "[") {
      const end = closingBracket(formula, i);
      if (end < 0) {
        out += formula.slice(i);
        break;
      }
      const content = formula.slice(i + 1, end);
      const mapped = onRef(content, out);
      if (mapped) {
        out = out.slice(0, out.length - (mapped.cut ?? 0)) + mapped.text;
      } else {
        out += formula.slice(i, end + 1);
      }
      i = end + 1;
    } else {
      out += ch;
      i += 1;
    }
  }
  return out;
}

/**
 * Qualify the structured references of a formula written inside table
 * `tableName` (`[Col]` -> `Table1[Col]`) and spell out `@` (`[@Col]` ->
 * `Table1[[#This Row],[Col]]`), as the xlsx format requires.
 */
export function qualifyStructuredReferences(
  formula: string,
  tableName: string
) {
  return mapBrackets(formula, (content, before) => {
    const last = before[before.length - 1];
    const prefix = last && IDENT_CHAR.test(last) ? "" : tableName;
    const trimmed = content.trim();
    if (!trimmed.startsWith("@")) return { text: `${prefix}[${content}]` };
    const rest = trimmed.slice(1).trim();
    if (!rest) return { text: `${prefix}[#This Row]` };
    const cols = rest.startsWith("[") ? rest : `[${rest}]`;
    return { text: `${prefix}[[#This Row],${cols}]` };
  });
}

/**
 * The reverse, for formulas inside table `tableName` read from xlsx:
 * `Table1[Col]` -> `[Col]`, `Table1[[#This Row],[Col]]` -> `[@Col]`.
 * References to other tables are left alone.
 */
export function unqualifyStructuredReferences(
  formula: string,
  tableName: string
) {
  const name = tableName.toUpperCase();
  return mapBrackets(formula, (content, before) => {
    const head = before.slice(before.length - name.length);
    const prev = before[before.length - name.length - 1];
    if (
      head.toUpperCase() !== name ||
      (prev != null && (IDENT_CHAR.test(prev) || prev === "!"))
    ) {
      return null;
    }
    const cut = name.length;
    const m = /^\s*\[#This Row\]\s*(?:,\s*([\s\S]*))?$/i.exec(content);
    if (!m) {
      if (/^\s*#This Row\s*$/i.test(content)) return { text: "[@]", cut };
      return { text: `[${content}]`, cut };
    }
    const rest = (m[1] ?? "").trim();
    if (!rest) return { text: "[@]", cut };
    // a single plain column: [@Col]; otherwise [@[Col1]:[Col2]]
    const single = /^\[((?:[^'[\]]|'.)*)\]$/.exec(rest);
    if (single && /^[A-Za-z_À-￿][\w.À-￿]*$/.test(single[1])) {
      return { text: `[@${single[1]}]`, cut };
    }
    return { text: `[@${rest}]`, cut };
  });
}
