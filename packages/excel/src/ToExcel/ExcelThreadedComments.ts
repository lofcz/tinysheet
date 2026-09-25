/**
 * Threaded comments -> xlsx.
 *
 * Excel stores a threaded comment three times over:
 *
 * - `xl/threadedComments/threadedCommentN.xml`: the thread (first post and
 *   replies, time, author, resolved flag, @mentions), related from the sheet;
 * - `xl/persons/person.xml`: the authors and mentioned people, related from
 *   the workbook;
 * - a legacy note ("[Threaded comment] ... Comment: ... Reply: ...") in the
 *   sheet's comments part, whose author is `tc={thread id}`, for versions of
 *   Excel without threaded comments.
 *
 * The sheet writer adds the legacy notes through ExcelJS (which writes the
 * comments and VML parts) and records the threads; `writeThreadedCommentParts`
 * then adds the threaded comment and person parts to the zip and points the
 * legacy notes at their threads.
 */
import type JSZip from "jszip";
import { commentTextWithMentions } from "@lofcz/tinysheet-core";
import type { SheetExportContext } from "./buildWorkbook";
import type { XlsxPostProcessInfo } from "./postProcess";

function xmlEscape(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type User = { id: string; name: string; email?: string };

type Post = {
  id: string;
  author: User;
  created: string;
  text: string;
};

type Thread = Post & {
  r: number;
  c: number;
  replies: Post[];
  resolved?: boolean;
};

/** A thread ready to be written (ids as Excel GUIDs). */
export type ExportedThread = {
  ref: string;
  resolved: boolean;
  posts: {
    id: string;
    parentId?: string;
    personKey: string;
    date: string;
    text: string;
    mentions: {
      personKey: string;
      mentionId: string;
      start: number;
      length: number;
    }[];
  }[];
};

export type ThreadedCommentExportInfo = {
  /** worksheet id -> its threads */
  sheets: Record<number, ExportedThread[]>;
  /** person key (user id) -> person */
  persons: Record<string, { name: string; userId: string }>;
  /** GUIDs already used */
  usedIds: string[];
};

export const THREADED_COMMENT_PLACEHOLDER =
  "[Threaded comment]\n\nYour version of Excel allows you to read this " +
  "threaded comment; however, any edits to it will get removed if the file " +
  "is opened in a newer version of Excel. Learn more: " +
  "https://go.microsoft.com/fwlink/?linkid=870924";

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

function columnName(c: number) {
  let n = c + 1;
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** The text older Excel versions show in the legacy note of a thread. */
export function legacyThreadText(thread: Thread) {
  const plain = (text: string) =>
    commentTextWithMentions(text).text.replace(/\n/g, "\n    ");
  const lines = [THREADED_COMMENT_PLACEHOLDER, "", "Comment:"];
  lines.push(`    ${plain(thread.text)}`);
  thread.replies.forEach((reply) => {
    lines.push("Reply:", `    ${plain(reply.text)}`);
  });
  return lines.join("\n");
}

/** Excel's `dT` format: local-less ISO time with hundredths of seconds. */
function excelDate(iso: string) {
  const time = Date.parse(iso);
  const d = Number.isNaN(time) ? new Date() : new Date(time);
  return d.toISOString().slice(0, 22);
}

function exportInfo(post: XlsxPostProcessInfo): ThreadedCommentExportInfo {
  if (!post.threadedComments) {
    post.threadedComments = { sheets: {}, persons: {}, usedIds: [] };
  }
  return post.threadedComments;
}

/** Sheet writer: legacy notes for the threads, and the threads to write. */
export function writeThreadedComments(ctx: SheetExportContext) {
  const threads: Thread[] = ctx.sheet?.threadedComments ?? [];
  if (!Array.isArray(threads) || threads.length === 0) return;
  const info = exportInfo(ctx.post);
  const used = new Set(info.usedIds);
  const uniqueId = (key: string) => {
    let id = excelGuid(key);
    let n = 1;
    while (used.has(id)) {
      id = excelGuid(`${key}#${n}`);
      n += 1;
    }
    used.add(id);
    return id;
  };
  const person = (user: User) => {
    const key = String(user?.id ?? user?.name ?? "");
    if (!info.persons[key]) {
      info.persons[key] = { name: user?.name || key, userId: key };
    }
    return key;
  };

  const out: ExportedThread[] = [];
  const cells = new Set<string>();
  threads.forEach((thread) => {
    if (thread == null || thread.r == null || thread.c == null) return;
    const key = `${thread.r}_${thread.c}`;
    if (cells.has(key)) return; // one thread per cell
    cells.add(key);
    const ref = `${columnName(thread.c)}${thread.r + 1}`;
    const rootId = uniqueId(thread.id);
    const posts = [thread, ...(thread.replies ?? [])].map((p, i) => {
      const { text, mentions } = commentTextWithMentions(p.text ?? "");
      return {
        id: i === 0 ? rootId : uniqueId(p.id),
        parentId: i === 0 ? undefined : rootId,
        personKey: person(p.author),
        date: excelDate(p.created),
        text,
        mentions: mentions.map((m) => ({
          personKey: person({ id: m.id, name: m.name }),
          mentionId: uniqueId(`${p.id}:mention:${m.start}`),
          start: m.start,
          length: m.length,
        })),
      };
    });
    out.push({ ref, resolved: !!thread.resolved, posts });
    ctx.worksheet.getCell(thread.r + 1, thread.c + 1).note =
      legacyThreadText(thread);
  });
  info.usedIds = [...used];
  if (out.length === 0) return;
  info.sheets[ctx.worksheet.id] = out;
  // a thread's placeholder note is never shown permanently
  const shown = ctx.post.visibleNotes?.[ctx.worksheet.id];
  if (shown) {
    ctx.post.visibleNotes![ctx.worksheet.id] = shown.filter(
      ({ r, c }) => !cells.has(`${r}_${c}`)
    );
  }
}

const NS =
  'xmlns="http://schemas.microsoft.com/office/spreadsheetml/2018/threadedcomments" ' +
  'xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const THREADED_REL =
  "http://schemas.microsoft.com/office/2017/10/relationships/threadedComment";
const PERSON_REL =
  "http://schemas.microsoft.com/office/2017/10/relationships/person";
const COMMENTS_REL =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments";
const THREADED_TYPE = "application/vnd.ms-excel.threadedcomments+xml";
const PERSON_TYPE = "application/vnd.ms-excel.person+xml";

function threadedCommentsXml(
  threads: ExportedThread[],
  personId: (key: string) => string
) {
  const items = threads.flatMap((thread) =>
    thread.posts.map((p, i) => {
      const attrs = [
        `ref="${thread.ref}"`,
        `dT="${p.date}"`,
        `personId="${personId(p.personKey)}"`,
        `id="${p.id}"`,
      ];
      if (p.parentId) attrs.push(`parentId="${p.parentId}"`);
      if (i === 0 && thread.resolved) attrs.push('done="1"');
      const mentions = p.mentions.length
        ? `<mentions>${p.mentions
            .map(
              (m) =>
                `<mention mentionpersonId="${personId(
                  m.personKey
                )}" mentionId="${m.mentionId}" startIndex="${
                  m.start
                }" length="${m.length}"/>`
            )
            .join("")}</mentions>`
        : "";
      return `<threadedComment ${attrs.join(" ")}><text>${xmlEscape(
        p.text
      )}</text>${mentions}</threadedComment>`;
    })
  );
  return `${XML_HEAD}<ThreadedComments ${NS}>${items.join(
    ""
  )}</ThreadedComments>`;
}

function personsXml(
  persons: ThreadedCommentExportInfo["persons"],
  personId: (key: string) => string
) {
  const items = Object.entries(persons).map(
    ([key, p]) =>
      `<person displayName="${xmlEscape(p.name)}" id="${personId(
        key
      )}" userId="${xmlEscape(p.userId)}" providerId="None"/>`
  );
  return `${XML_HEAD}<personList ${NS}>${items.join("")}</personList>`;
}

function nextRelId(rels: string, prefix: string) {
  let n = 1;
  while (rels.includes(`Id="${prefix}${n}"`)) n += 1;
  return `${prefix}${n}`;
}

function addRelationship(
  rels: string,
  prefix: string,
  type: string,
  target: string
) {
  const id = nextRelId(rels, prefix);
  return rels.replace(
    "</Relationships>",
    `<Relationship Id="${id}" Type="${type}" Target="${target}"/></Relationships>`
  );
}

function resolveTarget(target: string) {
  if (target.startsWith("/")) return target.slice(1);
  const parts = ["xl", "worksheets"];
  target.split("/").forEach((seg) => {
    if (seg === "..") parts.pop();
    else if (seg && seg !== ".") parts.push(seg);
  });
  return parts.join("/");
}

/** Point the legacy notes of the threads at them (author `tc={id}`). */
function linkLegacyNotes(xml: string, threads: ExportedThread[]) {
  const byRef = new Map(threads.map((t) => [t.ref, t.posts[0].id]));
  const authors = ["Author"];
  const index = new Map<string, number>();
  const out = xml.replace(/<comment\b([^>]*)>/g, (tag, attrs: string) => {
    const ref = /\bref="([^"]*)"/.exec(attrs)?.[1];
    const id = ref ? byRef.get(ref) : undefined;
    if (!id) return tag;
    if (!index.has(id)) {
      index.set(id, authors.length);
      authors.push(`tc=${id}`);
    }
    return tag.replace(/\bauthorId="\d+"/, `authorId="${index.get(id)}"`);
  });
  return out.replace(
    /<authors>[\s\S]*?<\/authors>/,
    `<authors>${authors
      .map((a) => `<author>${xmlEscape(a)}</author>`)
      .join("")}</authors>`
  );
}

/** Zip post-processing: threaded comment and person parts. */
export async function writeThreadedCommentParts(
  zip: JSZip,
  info: XlsxPostProcessInfo
) {
  const data = info.threadedComments;
  if (!data) return;
  const sheets = Object.entries(data.sheets).filter(([, t]) => t.length > 0);
  if (sheets.length === 0) return;
  const personIds = new Map<string, string>();
  const personId = (key: string) => {
    if (!personIds.has(key)) personIds.set(key, excelGuid(`person:${key}`));
    return personIds.get(key)!;
  };

  const typesPath = "[Content_Types].xml";
  let types = (await zip.file(typesPath)?.async("string")) ?? "";
  const override = (part: string, type: string) => {
    if (!types.includes(`PartName="${part}"`)) {
      types = types.replace(
        "</Types>",
        `<Override PartName="${part}" ContentType="${type}"/></Types>`
      );
    }
  };

  await Promise.all(
    sheets.map(async ([id, threads]) => {
      const relsPath = `xl/worksheets/_rels/sheet${id}.xml.rels`;
      let rels =
        (await zip.file(relsPath)?.async("string")) ??
        `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
      const part = `xl/threadedComments/threadedComment${id}.xml`;
      zip.file(part, threadedCommentsXml(threads, personId));
      override(`/${part}`, THREADED_TYPE);
      rels = addRelationship(
        rels,
        "rIdTc",
        THREADED_REL,
        `../threadedComments/threadedComment${id}.xml`
      );
      zip.file(relsPath, rels);

      // the legacy comments part ExcelJS wrote for the placeholders
      const rel = (rels.match(/<Relationship\b[^>]*>/g) ?? []).find((el) =>
        el.includes(`Type="${COMMENTS_REL}"`)
      );
      const target = rel && /Target="([^"]*)"/.exec(rel)?.[1];
      if (!target) return;
      const commentsPath = resolveTarget(target);
      const file = zip.file(commentsPath);
      if (!file) return;
      zip.file(
        commentsPath,
        linkLegacyNotes(await file.async("string"), threads)
      );
    })
  );

  // every person, once per workbook
  sheets.forEach(([, threads]) =>
    threads.forEach((t) =>
      t.posts.forEach((p) => {
        personId(p.personKey);
        p.mentions.forEach((m) => personId(m.personKey));
      })
    )
  );
  zip.file("xl/persons/person.xml", personsXml(data.persons, personId));
  override("/xl/persons/person.xml", PERSON_TYPE);
  zip.file(typesPath, types);

  const wbRelsPath = "xl/_rels/workbook.xml.rels";
  const wbRels = await zip.file(wbRelsPath)?.async("string");
  if (wbRels && !wbRels.includes(PERSON_REL)) {
    zip.file(
      wbRelsPath,
      addRelationship(wbRels, "rIdPerson", PERSON_REL, "persons/person.xml")
    );
  }
}
