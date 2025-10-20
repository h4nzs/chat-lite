import React from "react";
import clsx from "clsx";

export function MessageBubble({ m }: any) {
  if (!m || typeof m.content !== "string" || !m.content.trim()) return null;

  const mine = m.mine ?? m.isMine ?? false;

  return (
    <div
      className={clsx(
        "bubble px-3 py-2 rounded-2xl my-1",
        mine ? "bg-blue-600 text-white ml-auto" : "bg-gray-700 text-gray-100 mr-auto"
      )}
    >
      {m.content}
    </div>
  );
}