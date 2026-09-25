import React, { useCallback, useEffect, useRef, useState } from "react";
import { Meta, StoryFn } from "@storybook/react";
import {
  CommentUser,
  Sheet,
  ThreadedCommentChange,
} from "@lofcz/tinysheet-core";
import { Workbook, WorkbookInstance } from "@lofcz/tinysheet-react";

/**
 * Threaded comments (Excel's "Comments"): right-click a cell › New Comment
 * (or Ctrl+Shift+F2), type "@" to mention someone, Ctrl+Enter to post.
 * Hover a purple corner to preview a thread; the toolbar's Comments button
 * has Previous / Next Comment and the Comments pane. The log below the sheet
 * shows `hooks.onCommentChange` and `hooks.onMention`.
 */
export default {
  title: "Features/Threaded Comments",
  component: Workbook,
} as Meta<typeof Workbook>;

declare global {
  interface Window {
    __tinysheet?: WorkbookInstance | null;
    __commentEvents?: { type: string; detail: unknown }[];
  }
}

const users: CommentUser[] = [
  { id: "ann", name: "Ann Lee", email: "ann@example.com" },
  { id: "bob", name: "Bob Stone", email: "bob@example.com" },
  { id: "chen", name: "Chen Wu", email: "chen@example.com" },
  { id: "dana", name: "Dana Ortiz", email: "dana@example.com" },
];

const minutesAgo = (m: number) =>
  new Date(Date.now() - m * 60 * 1000).toISOString();

const sheet = (): Sheet => ({
  name: "Budget",
  id: "budget",
  order: 0,
  status: 1,
  row: 60,
  column: 20,
  celldata: [
    { r: 0, c: 0, v: { v: "Item", m: "Item" } },
    { r: 0, c: 1, v: { v: "Q1", m: "Q1" } },
    { r: 1, c: 0, v: { v: "Rent", m: "Rent" } },
    { r: 1, c: 1, v: { v: 1200, m: "1200", ct: { fa: "General", t: "n" } } },
    { r: 2, c: 0, v: { v: "Travel", m: "Travel" } },
    { r: 2, c: 1, v: { v: 640, m: "640", ct: { fa: "General", t: "n" } } },
    {
      r: 3,
      c: 0,
      v: {
        v: "Software",
        m: "Software",
        ps: {
          left: null,
          top: null,
          width: null,
          height: null,
          value: "A classic note",
          isShow: false,
        },
      },
    },
  ],
  threadedComments: [
    {
      id: "t-travel",
      r: 2,
      c: 1,
      author: users[1],
      created: minutesAgo(90),
      text: "Is this before or after the conference refund, @[Ann Lee](ann)?",
      replies: [
        {
          id: "t-travel-1",
          author: users[0],
          created: minutesAgo(12),
          text: "Before. I'll update it next week.",
        },
      ],
    },
    {
      id: "t-rent",
      r: 1,
      c: 1,
      author: users[2],
      created: minutesAgo(60 * 26),
      text: "Confirmed with the landlord.",
      replies: [],
      resolved: true,
    },
  ],
});

const Template: StoryFn<typeof Workbook> = (args) => {
  const ref = useRef<WorkbookInstance>(null);
  const [data, setData] = useState<Sheet[]>(() => [sheet()]);
  const [log, setLog] = useState<string[]>([]);
  const onChange = useCallback((d: Sheet[]) => setData(d), []);
  const push = useCallback((type: string, detail: unknown) => {
    window.__commentEvents = [
      ...(window.__commentEvents ?? []),
      { type, detail },
    ];
    setLog((l) => [`${type}: ${JSON.stringify(detail)}`, ...l].slice(0, 6));
  }, []);
  useEffect(() => {
    window.__commentEvents = [];
    Object.defineProperty(window, "__tinysheet", {
      configurable: true,
      get: () => ref.current,
    });
    return () => {
      delete window.__tinysheet;
    };
  }, []);
  const hooks = React.useMemo(
    () => ({
      onCommentChange: (change: ThreadedCommentChange) =>
        push("change", { type: change.type, threadId: change.threadId }),
      onMention: (_c: unknown, mentioned: CommentUser[]) =>
        push(
          "mention",
          mentioned.map((u) => u.id)
        ),
    }),
    [push]
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Workbook
          ref={ref}
          currentUser={users[0]}
          users={users}
          {...args}
          hooks={hooks}
          data={data}
          onChange={onChange}
        />
      </div>
      <pre
        style={{
          margin: 0,
          height: 64,
          overflow: "auto",
          fontSize: 11,
          padding: "4px 8px",
        }}
      >
        {log.join("\n")}
      </pre>
    </div>
  );
};

export const Light = Template.bind({});
Light.args = {};

export const Dark = Template.bind({});
Dark.args = { theme: "dark" };
