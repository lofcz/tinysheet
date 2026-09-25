import React, { useContext } from "react";
import {
  goToAdjacentThreadedComment,
  listThreadedComments,
  startThreadedComment,
  threadedCommentsLocale,
} from "@lofcz/tinysheet-core";
import WorkbookContext from "../../context";
import Combo from "../Toolbar/Combo";
import Select, { Option } from "../Toolbar/Select";

export const THREADED_COMMENT_ICON = "fortune-threaded-comment";

/** The toolbar icon (a speech bubble with a plus), as an SVG symbol. */
export const ThreadedCommentIconDefs: React.FC = () => (
  <svg
    width="0"
    height="0"
    style={{ position: "absolute", overflow: "hidden" }}
    aria-hidden="true"
  >
    <symbol viewBox="0 0 24 24" id={THREADED_COMMENT_ICON}>
      <path
        fill="currentColor"
        d="M20 3H4c-1.1 0-2 .9-2 2v16l4-4h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 12H5.17L4 16.17V5h16v10zM11 6h2v3h3v2h-3v3h-2v-3H8V9h3z"
      />
    </symbol>
  </svg>
);

/**
 * Review › Comments: New Comment (the button), and Previous / Next Comment
 * and the Comments pane in its menu.
 */
const ThreadedCommentsToolbarItem: React.FC<{ tooltip: string }> = ({
  tooltip,
}) => {
  const { context, setContext } = useContext(WorkbookContext);
  const t = threadedCommentsLocale(context);
  const hasThreads = listThreadedComments(context).length > 0;
  const run = (fn: Parameters<typeof setContext>[0]) =>
    setContext(fn, { noHistory: true });

  return (
    <>
      <ThreadedCommentIconDefs />
      <Combo
        iconId={THREADED_COMMENT_ICON}
        tooltip={tooltip || t.newComment}
        onClick={() => run((ctx) => startThreadedComment(ctx))}
      >
        {(setOpen) => (
          <Select>
            {context.allowEdit !== false && (
              <Option
                onClick={() => {
                  run((ctx) => startThreadedComment(ctx));
                  setOpen(false);
                }}
              >
                {t.newComment}
              </Option>
            )}
            {hasThreads && (
              <>
                <Option
                  onClick={() => {
                    run((ctx) => goToAdjacentThreadedComment(ctx, -1));
                    setOpen(false);
                  }}
                >
                  {t.previousComment}
                </Option>
                <Option
                  onClick={() => {
                    run((ctx) => goToAdjacentThreadedComment(ctx, 1));
                    setOpen(false);
                  }}
                >
                  {t.nextComment}
                </Option>
              </>
            )}
            <Option
              onClick={() => {
                run((ctx) => {
                  ctx.threadedCommentsPane = !ctx.threadedCommentsPane;
                });
                setOpen(false);
              }}
            >
              {context.threadedCommentsPane
                ? `✓ ${t.showComments}`
                : t.showComments}
            </Option>
          </Select>
        )}
      </Combo>
    </>
  );
};

export default ThreadedCommentsToolbarItem;
