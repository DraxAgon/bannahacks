"use client";

import { useState } from "react";
import { deleteAllLocalData } from "@/lib/store";

const tiny = "-my-2 py-2 transition-colors duration-150 ease-out hover:text-ink";

/** Tiny footer control with an inline confirm. Wipes every ladder, image and session in this browser. */
export function DeleteDataButton() {
  const [state, setState] = useState<"idle" | "confirm" | "busy" | "done">("idle");

  if (state === "done") {
    return <span role="status">Deleted</span>;
  }

  if (state === "confirm" || state === "busy") {
    return (
      <span className="inline-flex items-center gap-3">
        <span className="text-muted">Delete everything?</span>
        <button
          type="button"
          disabled={state === "busy"}
          className="-my-2 py-2 font-medium text-error transition-opacity duration-150 ease-out hover:opacity-75 disabled:opacity-40"
          onClick={async () => {
            setState("busy");
            await deleteAllLocalData();
            setState("done");
          }}
        >
          Yes
        </button>
        <button type="button" className={tiny} onClick={() => setState("idle")}>
          No
        </button>
      </span>
    );
  }

  return (
    <button type="button" className={tiny} onClick={() => setState("confirm")}>
      Delete my data
    </button>
  );
}
