import { act, fireEvent, render, waitFor } from "@testing-library/react";
import React from "react";
import type { Sheet } from "@lofcz/tinysheet-core";
import Workbook, { WorkbookInstance } from "../src/components/Workbook";
import { registerContextMenuItem } from "../src/components/ContextMenu/actions";

const ann = { id: "ann", name: "Ann Lee" };
const bob = { id: "bob", name: "Bob Stone", email: "bob@example.com" };

const sheetWithThread = (): Sheet => ({
  name: "Sheet1",
  id: "s1",
  celldata: [{ r: 0, c: 0, v: { v: "x", m: "x" } }],
  threadedComments: [
    {
      id: "t1",
      r: 2,
      c: 1,
      author: bob,
      created: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      text: "Check this, @[Ann Lee](ann)",
      replies: [],
    },
    {
      id: "t2",
      r: 5,
      c: 0,
      author: ann,
      created: new Date().toISOString(),
      text: "Done",
      replies: [],
      resolved: true,
    },
  ],
});

function renderBook(extra: Record<string, any> = {}) {
  const ref = React.createRef<WorkbookInstance>();
  const onCommentChange = jest.fn();
  const onMention = jest.fn();
  const utils = render(
    <Workbook
      ref={ref}
      lang="en"
      data={[sheetWithThread()]}
      currentUser={ann}
      users={[ann, bob]}
      hooks={{ onCommentChange, onMention }}
      {...extra}
    />
  );
  return { ...utils, ref, onCommentChange, onMention };
}

const threads = (ref: React.RefObject<WorkbookInstance>) =>
  ref.current!.getSheet().threadedComments ?? [];

function openCellMenu(
  container: HTMLElement,
  ref: React.RefObject<WorkbookInstance>,
  r: number,
  c: number
) {
  act(() => {
    ref.current!.setSelection([{ row: [r, r], column: [c, c] }]);
  });
  fireEvent.keyDown(container.querySelector(".fortune-container")!, {
    key: "F10",
    shiftKey: true,
  });
  return container.querySelector(".fortune-cell-menu") as HTMLElement;
}

describe("threaded comments UI", () => {
  it("New Comment from the cell menu posts a thread with mentions", async () => {
    const { container, ref, onCommentChange, onMention } = renderBook();
    const menu = openCellMenu(container, ref, 0, 3);
    const item = menu.querySelector('[data-key="new-comment"]') as HTMLElement;
    expect(item.textContent).toContain("New Comment");
    // notes keep their own entry
    expect(menu.querySelector('[data-key="insert-note"]')).toBeTruthy();
    fireEvent.click(item);

    const card = await waitFor(() => {
      const el = container.querySelector(".fortune-thread-card");
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });
    const box = card.querySelector("textarea")!;
    // "@" opens the people picker
    fireEvent.change(box, {
      target: { value: "Hi @Bo", selectionStart: 6 },
    });
    const option = await waitFor(() => {
      const el = card.querySelector(".fortune-mention-option");
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });
    expect(option.textContent).toContain("Bob Stone");
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() => expect(box.value).toBe("Hi @Bob Stone "));
    fireEvent.change(box, { target: { value: "Hi @Bob Stone please" } });
    fireEvent.keyDown(box, { key: "Enter", ctrlKey: true });

    await waitFor(() => expect(threads(ref)).toHaveLength(3));
    const added = threads(ref).find((t) => t.r === 0 && t.c === 3)!;
    expect(added.text).toBe("Hi @[Bob Stone](bob) please");
    expect(added.author).toEqual(ann);
    expect(onCommentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "add",
        sheetId: "s1",
        threadId: added.id,
      })
    );
    expect(onMention).toHaveBeenCalledWith(
      expect.objectContaining({ threadId: added.id }),
      [bob]
    );
    // the card now shows the thread, with the mention highlighted
    await waitFor(() =>
      expect(
        container.querySelector(".fortune-thread-card .fortune-thread-mention")
          ?.textContent
      ).toBe("@Bob Stone")
    );

    // undo removes it again
    act(() => {
      ref.current!.handleUndo();
    });
    await waitFor(() => expect(threads(ref)).toHaveLength(2));
  });

  it("replies, resolves and deletes from the card", async () => {
    const { container, ref, onCommentChange } = renderBook();
    const menu = openCellMenu(container, ref, 2, 1);
    expect(menu.querySelector('[data-key="new-comment"]')).toBeNull();
    fireEvent.click(menu.querySelector('[data-key="reply-comment"]')!);
    const card = await waitFor(() => {
      const el = container.querySelector(".fortune-thread-card");
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });
    expect(card.textContent).toContain("Bob Stone");
    expect(card.textContent).toContain("5 minutes ago");
    // not Ann's post: no edit / delete
    expect(card.querySelector(".fortune-thread-link")).toBeNull();

    const box = card.querySelector("textarea")!;
    fireEvent.change(box, { target: { value: "On it" } });
    fireEvent.click(
      card.querySelector(".fortune-thread-button-primary") as HTMLElement
    );
    await waitFor(() =>
      expect(threads(ref).find((t) => t.id === "t1")!.replies).toHaveLength(1)
    );
    expect(onCommentChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "reply", threadId: "t1" })
    );

    // Ann edits her reply
    await waitFor(() =>
      expect(card.querySelector(".fortune-thread-link")).toBeTruthy()
    );
    fireEvent.click(card.querySelector(".fortune-thread-link")!);
    const editBox = card.querySelector(
      ".fortune-thread-edit textarea"
    ) as HTMLTextAreaElement;
    fireEvent.change(editBox, { target: { value: "On it now" } });
    fireEvent.keyDown(editBox, { key: "Enter", ctrlKey: true });
    await waitFor(() => {
      const reply = threads(ref).find((t) => t.id === "t1")!.replies[0];
      expect(reply.text).toBe("On it now");
      expect(reply.edited).toBeTruthy();
    });

    fireEvent.click(card.querySelector('[aria-label="Resolve thread"]')!);
    await waitFor(() =>
      expect(threads(ref).find((t) => t.id === "t1")!.resolved).toBe(true)
    );
    expect(onCommentChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "resolve", threadId: "t1" })
    );
    fireEvent.click(
      container.querySelector(
        '.fortune-thread-card [aria-label="Delete thread"]'
      )!
    );
    await waitFor(() => expect(threads(ref)).toHaveLength(1));
    expect(container.querySelector(".fortune-thread-card")).toBeNull();
  });

  it("the Comments pane lists and filters threads and navigates", async () => {
    const { container, ref, getByText } = renderBook();
    act(() => {
      ref.current!.setContext(
        (ctx) => {
          ctx.threadedCommentsPane = true;
        },
        { noHistory: true }
      );
    });
    const pane = await waitFor(() => {
      const el = container.querySelector(".fortune-comments-pane");
      expect(el).toBeTruthy();
      return el as HTMLElement;
    });
    const items = () =>
      Array.from(pane.querySelectorAll(".fortune-comments-item")).map(
        (el) => el.querySelector(".fortune-comments-item-cell")!.textContent
      );
    expect(items()).toEqual(["B3", "A6"]);
    fireEvent.click(getByText("Resolved", { selector: "button" }));
    expect(items()).toEqual(["A6"]);
    fireEvent.click(getByText("Active", { selector: "button" }));
    expect(items()).toEqual(["B3"]);
    fireEvent.click(pane.querySelector(".fortune-comments-item")!);
    await waitFor(() =>
      expect(ref.current!.getSelection()?.[0]).toMatchObject({
        row: [2, 2],
        column: [1, 1],
      })
    );
    await waitFor(() =>
      expect(
        container
          .querySelector(".fortune-thread-card")
          ?.getAttribute("data-cell")
      ).toBe("2_1")
    );
  });

  it("Delete Comment from the cell menu", async () => {
    const { container, ref, onCommentChange } = renderBook();
    const menu = openCellMenu(container, ref, 5, 0);
    fireEvent.click(menu.querySelector('[data-key="delete-comment"]')!);
    await waitFor(() => expect(threads(ref).map((t) => t.id)).toEqual(["t1"]));
    expect(onCommentChange).toHaveBeenCalledWith(
      expect.objectContaining({ type: "deleteThread", threadId: "t2" })
    );
  });
});

describe("registerContextMenuItem", () => {
  it("adds entries named in settings.cellContextMenu", () => {
    const onSelect = jest.fn();
    const off = registerContextMenuItem("my-item", ({ r, c }) => [
      { key: "my-item", label: `Mine ${r},${c}`, onSelect },
    ]);
    const { container, ref } = renderBook({
      cellContextMenu: ["copy", "my-item"],
    });
    const menu = openCellMenu(container, ref, 1, 2);
    const item = menu.querySelector('[data-key="my-item"]') as HTMLElement;
    expect(item.textContent).toContain("Mine 1,2");
    fireEvent.click(item);
    expect(onSelect).toHaveBeenCalled();
    off();
  });
});
