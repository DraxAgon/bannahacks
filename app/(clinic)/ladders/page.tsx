"use client";

import { ArrowRight, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Eyebrow, LinkButton, buttonClass } from "@/components/ui";
import { DEMOS, demoId } from "@/lib/demo";
import { mainRungs } from "@/lib/pipeline/buildLadder";
import { deleteLadder, listLadders } from "@/lib/store";
import type { Ladder } from "@/lib/types";

export default function LaddersPage() {
  const [ladders, setLadders] = useState<Ladder[] | null>(null);
  useEffect(() => {
    listLadders().then(setLadders);
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-5 pb-10 pt-12 sm:px-8 sm:pt-16">
      <Eyebrow>Stored in this browser only</Eyebrow>
      <h1 className="font-display mt-3 text-[38px] leading-tight sm:text-[48px]">My ladders</h1>

      <div className="mt-10 space-y-3">
        {ladders === null && <p className="text-muted">Loading…</p>}
        {ladders?.length === 0 && (
          <div className="rounded-[12px] border border-line bg-surface p-6">
            <p className="text-ink">No ladders yet.</p>
            <p className="mt-1 text-[15px] text-muted">Build one for a patient, or open a demo ladder to see every screen.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <LinkButton href="/new">Build a ladder</LinkButton>
              {DEMOS.map((d) => (
                <Link key={d.slug} href={`/ladder/${demoId(d.slug)}`} className={buttonClass("secondary")}>
                  Demo: {d.label}
                </Link>
              ))}
            </div>
          </div>
        )}
        {ladders?.map((l) => {
          const main = mainRungs(l);
          return (
            <div key={l.id} className="flex items-center gap-4 rounded-[12px] border border-line bg-surface p-4">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[12px] uppercase tracking-wider text-muted">
                  {l.source === "demo" ? "Demo" : l.alias} · {new Date(l.createdAt).toLocaleDateString()}
                </p>
                <Link href={`/ladder/${l.id}`} className="mt-1 block truncate text-[17px] font-medium text-ink hover:text-primary">
                  {l.subject.name || l.fear} ladder · {main.length} rungs
                </Link>
              </div>
              <Button
                variant="ghost"
                aria-label={`Delete ${l.subject.name || l.fear} ladder`}
                onClick={async () => {
                  await deleteLadder(l.id);
                  setLadders((cur) => cur?.filter((x) => x.id !== l.id) ?? null);
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
              <Link href={`/ladder/${l.id}`} className={buttonClass("secondary")} aria-label="Open">
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
