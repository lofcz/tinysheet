/**
 * xlsx -> threaded comments (`sheet.threadedComments`).
 *
 * Reads the sheet's `threadedComment` parts and the workbook's person list
 * (display names, user ids). The legacy "[Threaded comment]" notes Excel
 * writes next to them are skipped by the notes reader; notes without a
 * thread stay notes.
 */
import { commentTextFromMentions } from "@lofcz/tinysheet-core";
import { getcellrange } from "../common/method";
import type { SheetImportContext } from "./importFeatures";

type Files = SheetImportContext["files"];

/** Internal relationships of a part, targets resolved to zip paths. */
function partRelationships(files: Files, partPath: string) {
  const slash = partPath.lastIndexOf("/");
  const dir = partPath.slice(0, slash);
  const xml = files[`${dir}/_rels/${partPath.slice(slash + 1)}.rels`];
  if (!xml) return [];
  return (xml.match(/<Relationship\b[^>]*>/g) || [])
    .filter((el) => !/TargetMode="External"/.test(el))
    .map((el) => {
      const type = /\bType="([^"]*)"/.exec(el)?.[1] ?? "";
      const target = /\bTarget="([^"]*)"/.exec(el)?.[1] ?? "";
      const parts = target.startsWith("/") ? [] : dir.split("/");
      target.split("/").forEach((seg) => {
        if (seg === "..") parts.pop();
        else if (seg && seg !== ".") parts.push(seg);
      });
      return { type, target: parts.filter(Boolean).join("/") };
    });
}

const THREADED_REL = /\/threadedComment$/;
const PERSON_REL = /\/person$/;

export function xmlText(s: string) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
      String.fromCodePoint(parseInt(h, 16))
    )
    .replace(/&amp;/g, "&");
}

function attrs(tag: string) {
  const out: Record<string, string> = {};
  const re = /([\w:]+)\s*=\s*"([^"]*)"/g;
  let m = re.exec(tag);
  while (m) {
    out[m[1].replace(/^\w+:/, "")] = xmlText(m[2]);
    m = re.exec(tag);
  }
  return out;
}

const stripGuid = (id: string) => id.replace(/^\{|\}$/g, "");

type Person = { id: string; name: string };

/** The workbook's persons: Excel person id -> TinySheet user. */
export function readPersons(files: Files) {
  const persons = new Map<string, Person>();
  const paths = partRelationships(files, "xl/workbook.xml")
    .filter((rel) => PERSON_REL.test(rel.type))
    .map((rel) => rel.target);
  if (paths.length === 0 && files["xl/persons/person.xml"]) {
    paths.push("xl/persons/person.xml");
  }
  paths.forEach((path) => {
    const xml = files[path];
    if (!xml) return;
    (xml.match(/<(?:\w+:)?person\b[^>]*>/g) || []).forEach((tag) => {
      const a = attrs(tag);
      if (!a.id) return;
      persons.set(a.id, {
        // keep the host's user id when the file came from TinySheet (or a
        // directory provider); fall back to the person's own id
        id: a.userId || stripGuid(a.id),
        name: a.displayName || a.userId || "",
      });
    });
  });
  return persons;
}

function parseDate(dT: string | undefined) {
  if (!dT) return new Date(0).toISOString();
  const withZone = /(Z|[+-]\d\d:?\d\d)$/.test(dT) ? dT : `${dT}Z`;
  const time = Date.parse(withZone);
  return Number.isNaN(time)
    ? new Date(0).toISOString()
    : new Date(time).toISOString();
}

type RawPost = {
  ref: string;
  id: string;
  parentId?: string;
  personId?: string;
  dT?: string;
  done: boolean;
  text: string;
  mentions: { personId: string; start: number; length: number }[];
};

/** The posts of a threadedComment part, in document order. */
export function parseThreadedCommentsXml(xml: string): RawPost[] {
  const out: RawPost[] = [];
  const re =
    /<(?:\w+:)?threadedComment\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?threadedComment>)/g;
  let m = re.exec(xml);
  while (m) {
    const a = attrs(m[1]);
    const body = m[2] ?? "";
    const text = /<(?:\w+:)?text>([\s\S]*?)<\/(?:\w+:)?text>/.exec(body)?.[1];
    const mentions = (body.match(/<(?:\w+:)?mention\b[^>]*>/g) || []).map(
      (tag) => {
        const ma = attrs(tag);
        return {
          personId: ma.mentionpersonId ?? "",
          start: Number(ma.startIndex ?? -1),
          length: Number(ma.length ?? 0),
        };
      }
    );
    if (a.ref && a.id) {
      out.push({
        ref: a.ref,
        id: a.id,
        parentId: a.parentId,
        personId: a.personId,
        dT: a.dT,
        done: a.done === "1" || a.done === "true",
        text: xmlText(text ?? "").replace(/\r\n/g, "\n"),
        mentions,
      });
    }
    m = re.exec(xml);
  }
  return out;
}

/** Cells ("r_c") of a sheet that have a threaded comment. */
export function threadedCommentCells(ctx: SheetImportContext) {
  const cells = new Set<string>();
  partRelationships(ctx.files, ctx.sheetFile)
    .filter((rel) => THREADED_REL.test(rel.type) && ctx.files[rel.target])
    .forEach((rel) => {
      parseThreadedCommentsXml(ctx.files[rel.target]).forEach((p) => {
        const range = getcellrange(p.ref);
        if (range) cells.add(`${range.row[0]}_${range.column[0]}`);
      });
    });
  return cells;
}

/** Threaded comment parts -> `sheet.threadedComments`. */
export function readThreadedComments(ctx: SheetImportContext) {
  const rels = partRelationships(ctx.files, ctx.sheetFile).filter(
    (rel) => THREADED_REL.test(rel.type) && ctx.files[rel.target]
  );
  if (rels.length === 0) return;
  const persons = readPersons(ctx.files);
  const person = (id: string | undefined) => {
    const p = id ? persons.get(id) : undefined;
    if (p) return { ...p };
    const bare = id ? stripGuid(id) : "unknown";
    return { id: bare, name: bare };
  };

  const threads: any[] = [];
  const byId = new Map<string, any>();
  const cells = new Set<string>();
  rels.forEach((rel) => {
    parseThreadedCommentsXml(ctx.files[rel.target]).forEach((p) => {
      const range = getcellrange(p.ref);
      if (!range) return;
      const text = commentTextFromMentions(
        p.text,
        p.mentions.map((m) => {
          const who = person(m.personId);
          return { ...who, start: m.start, length: m.length };
        })
      );
      const post = {
        id: stripGuid(p.id),
        author: person(p.personId),
        created: parseDate(p.dT),
        text,
      };
      const parent = p.parentId ? byId.get(p.parentId) : undefined;
      if (parent) {
        parent.replies.push(post);
        return;
      }
      const r = range.row[0];
      const c = range.column[0];
      const key = `${r}_${c}`;
      if (cells.has(key)) {
        // a second root on the same cell: keep it as a reply
        const first = threads.find((t) => t.r === r && t.c === c);
        first.replies.push(post);
        byId.set(p.id, first);
        return;
      }
      cells.add(key);
      const thread: any = { ...post, r, c, replies: [] };
      if (p.done) thread.resolved = true;
      threads.push(thread);
      byId.set(p.id, thread);
    });
  });
  if (threads.length > 0) (ctx.sheet as any).threadedComments = threads;
}
