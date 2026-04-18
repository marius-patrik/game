import { useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useDialogState } from "./dialog/dialogStore";
import { useTypewriter } from "./dialog/typewriter";

export function DialogUI({
  onChoose,
  onClose,
}: {
  onChoose: (choiceIndex: number) => void;
  onClose: () => void;
}) {
  const { open, header, node } = useDialogState();
  const text = node?.text ?? "";
  const { visible, done, skip } = useTypewriter(text);

  const chooseIfAvailable = useCallback(
    (index: number) => {
      if (!node) return;
      const choice = node.choices[index];
      if (!choice?.available) return;
      onChoose(index);
    },
    [node, onChoose],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === " " || e.code === "Space") {
        if (!done) {
          e.preventDefault();
          skip();
        }
        return;
      }
      // Number keys 1-9 select choices.
      const n = Number.parseInt(e.key, 10);
      if (Number.isFinite(n) && n >= 1 && n <= 9) {
        e.preventDefault();
        chooseIfAvailable(n - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, done, skip, chooseIfAvailable, onClose]);

  if (!open || !node) return null;

  const speakerName = header?.speakerName || "Stranger";
  const portraitId = header?.portraitId || "stranger";

  return (
    <div
      data-testid="dialog-ui"
      className="pointer-events-auto fixed inset-0 z-40 flex items-end justify-center bg-background/20 backdrop-blur-[2px] sm:items-center"
    >
      {/* Backdrop click skips text if still typing, otherwise does nothing
          (players close via explicit Farewell choice or Esc). */}
      <button
        type="button"
        aria-label={done ? "Dialog backdrop" : "Reveal text"}
        className="absolute inset-0 cursor-default"
        onClick={() => {
          if (!done) skip();
        }}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Dialog with ${speakerName}`}
        className={cn(
          "relative z-50 m-0 flex w-full max-w-2xl flex-col gap-4 border border-border/50 bg-background/95 p-4 shadow-2xl",
          "rounded-t-xl sm:rounded-xl sm:m-4",
        )}
      >
        <header className="flex items-center gap-3">
          <DialogPortrait portraitId={portraitId} />
          <div className="flex min-w-0 flex-col">
            <h2 className="truncate font-semibold text-base leading-tight">{speakerName}</h2>
            <p className="text-muted-foreground text-xs">{done ? "Choose a response" : "…"}</p>
          </div>
        </header>
        <div
          data-testid="dialog-text"
          className="min-h-[3.5rem] whitespace-pre-wrap text-sm leading-relaxed sm:text-base"
        >
          {visible}
          {!done ? <span className="ml-0.5 animate-pulse">▌</span> : null}
        </div>
        <div className="flex flex-col gap-1.5">
          {node.choices.map((c, i) => (
            <button
              key={`${node.id}-${i}-${c.text}`}
              type="button"
              data-testid={`dialog-choice-${i}`}
              data-available={c.available ? "1" : "0"}
              onClick={() => chooseIfAvailable(i)}
              disabled={!c.available}
              title={c.available ? undefined : c.reason}
              className={cn(
                "group flex min-h-[44px] w-full items-center gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                c.available
                  ? "border-border/60 bg-muted/30 hover:bg-muted/60"
                  : "cursor-not-allowed border-border/30 bg-muted/10 text-muted-foreground/60",
              )}
            >
              <kbd className="shrink-0 rounded border border-border/60 bg-muted px-1.5 py-0.5 font-mono text-[10px] tabular-nums">
                {i + 1}
              </kbd>
              <span className="flex-1">{c.text}</span>
              {!c.available && c.reason ? (
                <span className="shrink-0 text-[11px] italic">{c.reason}</span>
              ) : null}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

/**
 * Placeholder portrait — deterministic colour pair derived from the portrait
 * id. Future work swaps this for real artwork; the visual anchor is
 * intentional so a dialog never opens with a blank corner.
 */
function DialogPortrait({ portraitId }: { portraitId: string }) {
  const hue = hashHue(portraitId);
  const gradient = `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 40) % 360} 60% 35%))`;
  const initial = (portraitId[0] ?? "?").toUpperCase();
  return (
    <div
      data-testid="dialog-portrait"
      className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-border/40 font-semibold text-lg text-white shadow sm:size-14"
      style={{ background: gradient }}
    >
      {initial}
    </div>
  );
}

function hashHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}
