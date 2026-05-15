import { useEffect, useRef, useState } from "react";
import type {
  CaseNarrative,
  NarrativeStep,
} from "@workspace/framework/replay/narrative";
import { Play, Pause, RotateCcw, BookOpen, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const AUTOPLAY_INTERVAL_MS = 4500;

/** Map narrative beats to in-page section ids so the page scrolls. */
const LAYER_SECTION_ID: Record<NarrativeStep["highlightLayer"], string> = {
  ingestion: "timeline",
  agents: "timeline",
  cognition: "timeline",
  propagation: "propagation",
  disagreement: "disagreement",
  "org-fit": "org-fit",
  escalation: "escalations",
  calibration: "calibration",
  recommendation: "decision",
};

/**
 * Guided narrative panel rendered above the replay timeline.
 *
 * The narrative is data-driven (per case) and read aloud through six
 * beats. Autoplay scrolls the page to the matching section as it
 * advances. The panel is collapsible so power users can hide it.
 */
export function NarrativePanel({
  narrative,
  caseId,
}: {
  narrative: CaseNarrative;
  caseId: string;
}) {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Reset when the case changes.
  const lastCase = useRef(caseId);
  useEffect(() => {
    if (lastCase.current !== caseId) {
      setActive(0);
      setPlaying(false);
      lastCase.current = caseId;
    }
  }, [caseId]);

  // Autoplay.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setActive((cur) => {
        const next = cur + 1;
        if (next >= narrative.steps.length) {
          setPlaying(false);
          // Fire-and-forget completion event for analytics.
          const base = import.meta.env.BASE_URL.replace(/\/$/, "");
          fetch(`${base}/api/analytics/event`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: `replay:completed:${caseId}` }),
          }).catch(() => {});
          return narrative.steps.length - 1;
        }
        return next;
      });
    }, AUTOPLAY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [playing, narrative.steps.length, caseId]);

  // Scroll the matching section into view when the active beat changes.
  useEffect(() => {
    const beat = narrative.steps[active];
    if (!beat) return undefined;
    const id = LAYER_SECTION_ID[beat.highlightLayer];
    if (!id) return undefined;
    const el = document.getElementById(id);
    if (!el) return undefined;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.add("ring-2", "ring-primary/40");
    const t = setTimeout(() => {
      el.classList.remove("ring-2", "ring-primary/40");
    }, 1800);
    return () => clearTimeout(t);
  }, [active, narrative.steps]);

  const current = narrative.steps[active];

  return (
    <section className="rounded-lg border border-primary/30 bg-primary/[0.04] p-5 space-y-4">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-widest text-primary">
            <Sparkles className="size-3" /> Guided narrative
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
            {narrative.hook}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPlaying((p) => !p)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold",
              playing
                ? "bg-amber-500/15 text-amber-200 border border-amber-500/40"
                : "bg-primary text-primary-foreground hover:opacity-90",
            )}
          >
            {playing ? (
              <>
                <Pause className="size-3" /> Pause
              </>
            ) : (
              <>
                <Play className="size-3" /> Autoplay
              </>
            )}
          </button>
          <button
            onClick={() => {
              setActive(0);
              setPlaying(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs"
            title="Restart narrative"
          >
            <RotateCcw className="size-3" />
          </button>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs"
            title={collapsed ? "Expand" : "Collapse"}
          >
            <BookOpen className="size-3" />
            {collapsed ? "Show" : "Hide"}
          </button>
        </div>
      </header>

      {!collapsed && (
        <>
          {/* Progress strip */}
          <div className="flex gap-1">
            {narrative.steps.map((s, i) => (
              <button
                key={s.beat}
                onClick={() => {
                  setActive(i);
                  setPlaying(false);
                }}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  i === active
                    ? "bg-primary"
                    : i < active
                      ? "bg-primary/40"
                      : "bg-border",
                )}
                title={s.title}
              />
            ))}
          </div>

          {/* Active beat */}
          {current && (
            <div className="rounded-md border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-primary">
                <span>{active + 1}</span>
                <span>·</span>
                <span>{current.beat.replace(/-/g, " ")}</span>
                <span className="ml-auto rounded border border-primary/30 px-1.5 py-0.5 text-[10px] text-primary/80">
                  {current.highlightLayer}
                </span>
              </div>
              <h3 className="mt-2 text-lg font-semibold tracking-tight">
                {current.title}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {current.body}
              </p>
            </div>
          )}

          {/* Full beat list (compact) */}
          <ol className="grid gap-1 md:grid-cols-2">
            {narrative.steps.map((s, i) => (
              <li key={s.beat}>
                <button
                  onClick={() => {
                    setActive(i);
                    setPlaying(false);
                  }}
                  className={cn(
                    "w-full text-left rounded border px-3 py-2 text-xs leading-snug transition-colors",
                    i === active
                      ? "border-primary/50 bg-primary/10 text-foreground"
                      : "border-border/60 bg-background/30 text-muted-foreground hover:border-border hover:text-foreground",
                  )}
                >
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/80 mr-2">
                    {i + 1}
                  </span>
                  {s.title}
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
