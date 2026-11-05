import { commentTextWithMentions } from "@lofcz/tinysheet-core";
import { cellAddress } from "../common/formulaText";
import type { SheetExportContext } from "./buildWorkbook";

const GUID_RE =
  /^\{?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}?$/i;

function hash32(text: string, seed: number) {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** A GUID for `key`: the key itself when it is one, else derived from it. */
export function excelGuid(key: string) {
  if (GUID_RE.test(key)) {
    return `{${key.replace(/[{}]/g, "").toUpperCase()}}`;
  }
  const hex = [0x811c9dc5, 0x01000193, 0x2545f491, 0x9e3779b9]
    .map((seed) => hash32(key, seed))
    .join("");
  const v4 = `${hex.slice(0, 12)}4${hex.slice(13, 16)}${(
    (parseInt(hex[16], 16) & 3) |
    8
  ).toString(16)}${hex.slice(17, 32)}`;
  return `{${v4.slice(0, 8)}-${v4.slice(8, 12)}-${v4.slice(12, 16)}-${v4.slice(
    16,
    20
  )}-${v4.slice(20, 32)}}`.toUpperCase();
}

/** Conversations and people share the workbook's identity registry. */
export function writeThreadedComments(ctx: SheetExportContext) {
  const used = new Set(
    ctx.workbook.worksheets.flatMap((sheet) =>
      sheet.commentThreads.flatMap((thread) =>
        thread.comments.map((comment) => comment.id)
      )
    )
  );
  const idFor = (key: string) => {
    let n = 0;
    let id = excelGuid(key);
    while (used.has(id)) id = excelGuid(`${key}#${++n}`);
    used.add(id);
    return id;
  };
  const person = (user: { id?: string; name?: string }) => {
    const key = String(user?.id ?? user?.name ?? "");
    const id = excelGuid(`person:${key}`);
    ctx.workbook.addPerson({
      id,
      displayName: user?.name || key,
      userId: key,
      providerId: "None",
    });
    return id;
  };
  const cells = new Set<string>();
  for (const thread of ctx.sheet?.threadedComments ?? []) {
    if (!thread || thread.r == null || thread.c == null) continue;
    const ref = cellAddress(thread.r, thread.c);
    if (cells.has(ref)) continue;
    cells.add(ref);
    const comments = [thread, ...(thread.replies ?? [])].map((post) => {
      const { text, mentions } = commentTextWithMentions(post.text ?? "");
      const date = Date.parse(post.created);
      return {
        id: idFor(String(post.id)),
        personId: person(post.author),
        ...(Number.isNaN(date)
          ? {}
          : { date: new Date(date).toISOString().slice(0, 22) }),
        text,
        mentions: mentions.map((mention) => ({
          personId: person({ id: mention.id, name: mention.name }),
          mentionId: idFor(`${post.id}:mention:${mention.start}`),
          startIndex: mention.start,
          length: mention.length,
        })),
      };
    });
    ctx.worksheet.addCommentThread({
      ref,
      resolved: !!thread.resolved,
      comments,
    });
  }
  const shown = ctx.post.visibleNotes?.[ctx.worksheet.id];
  if (shown)
    ctx.post.visibleNotes![ctx.worksheet.id] = shown.filter(
      ({ r, c }) => !cells.has(cellAddress(r, c))
    );
}
