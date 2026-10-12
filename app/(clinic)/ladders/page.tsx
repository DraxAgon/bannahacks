"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AiLabel, LinkButton } from "@/components/ui";
import { mainRungs } from "@/lib/pipeline/buildLadder";
import { deleteLadder, listLadders } from "@/lib/store";
import type { Ladder } from "@/lib/types";

const nameOf = (l: Ladder) => {
  const n = (l.subject.name || l.fear || "Untitled").trim();
  return n.charAt(0).toUpperCase() + n.slice(1);
};

export default function LaddersPage() {
  const [ladders, setLadders] = useState<Ladder[] | null>(null);

  useEffect(() => {
    let alive = true;
    listLadders().then((all) => {
      if (alive) setLadders(all);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 pb-16 pt-12 sm:px-8 md:pt-[88px]">
      <h1 className="text-[34px] font-semibold leading-[1.05] tracking-[-0.03em] text-ink sm:text-[48px]">Your ladders</h1>

      <div className="mt-10">
        {ladders === null && (
          <ul aria-busy className="space-y-1">
            {[0, 1, 2].map((i) => (
              <li key={i} className="flex items-center gap-4 py-3">
                <div className="loading-sheen h-14 w-14 shrink-0 rounded-xl" />
                <div className="loading-sheen h-4 w-40 rounded-full" />
              </li>
            ))}
          </ul>
        )}

        {ladders?.length === 0 && (
          <div className="flex flex-col items-start gap-5">
            <p className="text-[15px] text-muted">Nothing here yet.</p>
            <LinkButton href="/new">Build your own</LinkButton>
          </div>
        )}

        {ladders && ladders.length > 0 && (
          <ul className="-mx-3 space-y-1">
            {ladders.map((l) => (
              <Row
                key={l.id}
                ladder={l}
                onDelete={async () => {
                  await deleteLadder(l.id);
                  setLadders((cur) => cur?.filter((x) => x.id !== l.id) ?? null);
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Row({ ladder, onDelete }: { ladder: Ladder; onDelete: () => Promise<void> }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const main = mainRungs(ladder);
  const thumb = main[0]?.image;
  const name = nameOf(ladder);

  return (
    <li className="group flex items-center gap-2 rounded-2xl pr-2 transition-colors duration-150 ease-out hover:bg-subtle">
      <Link href={`/ladder/${ladder.id}`} className="flex min-w-0 flex-1 items-center gap-4 rounded-2xl! py-3 pl-3">
        <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-subtle">
          {thumb && (
            <img
              src={thumb}
              alt=""
              draggable={false}
              className="h-full w-full scale-125 object-cover"
              style={{ filter: "blur(8px) saturate(0.85)" }}
            />
          )}
          {thumb && <AiLabel compact className="absolute bottom-1 left-1 px-1.5! text-[10px]!" />}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[16px] font-medium text-ink">{name}</span>
          <span className="tabular block text-[14px] text-muted">
            {main.length} {main.length === 1 ? "step" : "steps"}
          </span>
        </span>
      </Link>

      {confirm ? (
        <button
          type="button"
          disabled={busy}
          autoFocus
          onBlur={() => !busy && setConfirm(false)}
          onClick={async () => {
            setBusy(true);
            await onDelete();
          }}
          className="h-9 shrink-0 rounded-full! px-3 text-[14px] font-medium text-error transition-opacity duration-150 ease-out hover:opacity-75 disabled:opacity-40"
        >
          Delete
        </button>
      ) : (
        <button
          type="button"
          aria-label={`Delete ${name}`}
          onClick={() => setConfirm(true)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full! text-faint transition-colors duration-150 ease-out hover:bg-line hover:text-ink"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </button>
      )}
    </li>
  );
}
