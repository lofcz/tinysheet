import React, { useState } from "react";
import { CommentUser, parseCommentText } from "@lofcz/tinysheet-core";
import { avatarColor, initials } from "./useThreadedComments";

/** A user's picture, or their initials on a colour of their own. */
const Avatar: React.FC<{ user: CommentUser; size?: number }> = ({
  user,
  size = 28,
}) => {
  const [broken, setBroken] = useState(false);
  const style = { width: size, height: size, fontSize: size * 0.42 };
  if (user.avatar && !broken) {
    return (
      <img
        className="fortune-thread-avatar"
        src={user.avatar}
        alt=""
        style={style}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span
      className="fortune-thread-avatar"
      aria-hidden="true"
      style={{ ...style, backgroundColor: avatarColor(user.id || user.name) }}
    >
      {initials(user.name)}
    </span>
  );
};

export default Avatar;

/** A comment's text with its @mentions highlighted. */
export const CommentText: React.FC<{ text: string; className?: string }> = ({
  text,
  className,
}) => (
  <div className={className ?? "fortune-thread-text"}>
    {parseCommentText(text).map((seg, i) =>
      seg.type === "text" ? (
        // eslint-disable-next-line react/no-array-index-key
        <React.Fragment key={i}>{seg.text}</React.Fragment>
      ) : (
        <span
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          className="fortune-thread-mention"
          data-user-id={seg.id}
        >
          @{seg.name}
        </span>
      )
    )}
  </div>
);
