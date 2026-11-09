type Anchor = "full" | "start" | "end" | "any";
type Token = { literal: string } | "*" | "?";

// RegExp's non-Unicode case folding operates on UTF-16 code units and does
// not fold non-ASCII characters into ASCII (for example the long s).
function fold(char: string): string {
  const upper = char.toUpperCase();
  return upper.length !== 1 ||
    (char.charCodeAt(0) >= 128 && upper.charCodeAt(0) < 128)
    ? char
    : upper;
}

/** Excel wildcards with bounded O(pattern length × text length) matching. */
export function createWildcardMatcher(
  pattern: string,
  anchor: Anchor = "any",
  matchCase = false
) {
  const tokens: Token[] = [];
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    if (char === "~" && "*?~".includes(pattern[i + 1] ?? "\0")) {
      const literal = pattern[++i];
      tokens.push({ literal: matchCase ? literal : fold(literal) });
    } else if (char === "*" || char === "?") {
      if (char !== "*" || tokens[tokens.length - 1] !== "*") tokens.push(char);
    } else tokens.push({ literal: matchCase ? char : fold(char) });
  }
  const atStart = anchor === "start" || anchor === "full";
  const atEnd = anchor === "end" || anchor === "full";
  if (tokens.every((token) => typeof token === "object")) {
    const literal = tokens
      .map((token) => (token as { literal: string }).literal)
      .join("");
    const escaped = literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const source = `${atStart ? "^" : ""}${escaped}${atEnd ? "$(?![\\s\\S])" : ""}`;
    const flags = matchCase ? "" : "i";
    const re = new RegExp(source, flags);
    const all = new RegExp(source, flags + "g");
    return {
      test: (text: string) => re.test(text),
      replace: (text: string, replacement: string) =>
        text.replace(all, () => replacement),
    };
  }

  // For each starting offset, retain the furthest successful ending offset.
  // This preserves greedy replacement without retrying exponential paths.
  const endings = (text: string) => {
    let next = new Int32Array(text.length + 1);
    let current = new Int32Array(text.length + 1);
    for (let i = 0; i <= text.length; i += 1)
      next[i] = atEnd && i !== text.length ? -1 : i;
    const chars = matchCase ? text.split("") : text.split("").map(fold);
    for (let p = tokens.length - 1; p >= 0; p -= 1) {
      const token = tokens[p];
      current[text.length] = token === "*" ? next[text.length] : -1;
      for (let i = text.length - 1; i >= 0; i -= 1) {
        current[i] =
          token === "*"
            ? Math.max(next[i], current[i + 1])
            : token === "?" || token.literal === chars[i]
              ? next[i + 1]
              : -1;
      }
      [current, next] = [next, current];
    }
    return next;
  };
  return {
    test(text: string): boolean {
      const ends = endings(text);
      return atStart ? ends[0] >= 0 : ends.some((end) => end >= 0);
    },
    replace(text: string, replacement: string): string {
      const ends = endings(text);
      const parts: string[] = [];
      let copied = 0;
      for (let i = 0; i <= (atStart ? 0 : text.length); i += 1) {
        const end = ends[i];
        if (end < 0) continue;
        parts.push(text.slice(copied, i), replacement);
        copied = end;
        if (end > i) i = end - 1;
      }
      parts.push(text.slice(copied));
      return parts.join("");
    },
  };
}
