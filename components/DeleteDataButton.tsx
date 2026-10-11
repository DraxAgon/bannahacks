"use client";

import { useState } from "react";
import { deleteAllLocalData } from "@/lib/store";

export function DeleteDataButton() {
  const [state, setState] = useState<"idle" | "confirm" | "done">("idle");

  if (state === "done") {
    return <p className="text-ink">All local data deleted.</p>;
  }

  if (state === "confirm") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-ink">Delete every ladder, image and session in this browser?</span>
        <button
          type="button"
          className="min-h-11 rounded-full border border-error px-4 text-error hover:bg-error hover:text-surface"
          onClick={async () => {
            await deleteAllLocalData();
            setState("done");
          }}
        >
          Delete
        </button>
        <button type="button" className="min-h-11 px-3 underline underline-offset-4" onClick={() => setState("idle")}>
          Keep
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="min-h-11 underline underline-offset-4 hover:text-ink"
      onClick={() => setState("confirm")}
    >
      Delete all local data
    </button>
  );
}
