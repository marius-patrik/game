import { AnimatePresence, motion } from "framer-motion";
import { Coins, Hand, Swords, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const TUTORIAL_KEY = "tutorial.v1.seen";

export function Tutorial() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem(TUTORIAL_KEY) === "1";
    if (!seen) setOpen(true);
  }, []);

  const dismiss = () => {
    setOpen(false);
    if (typeof window !== "undefined") window.localStorage.setItem(TUTORIAL_KEY, "1");
  };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="pointer-events-auto absolute bottom-24 left-1/2 z-30 flex w-[92%] max-w-md -translate-x-1/2 flex-col gap-3 rounded-xl border border-amber-500/50 bg-background/90 p-4 shadow-xl backdrop-blur-md sm:bottom-28"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base text-amber-400">Welcome to the alpha</h3>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss tutorial"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
          <ul className="flex flex-col gap-2 text-sm">
            <Tip icon={<Hand className="size-4 text-sky-400" />}>
              <strong>Click the ground</strong> — your character walks there.
            </Tip>
            <Tip icon={<Swords className="size-4 text-rose-400" />}>
              <strong>Click an enemy</strong> — you attack. The nearest target in range gets hit.
            </Tip>
            <Tip icon={<Coins className="size-4 text-amber-400" />}>
              <strong>Click loot</strong> — picks it up. Equip weapons from the hotbar at the
              bottom.
            </Tip>
          </ul>
          <p className="text-muted-foreground text-xs">
            Walk into a glowing portal to travel to a new zone. Press{" "}
            <kbd className="rounded border border-border/60 bg-muted px-1">T</kbd> for chat. Open{" "}
            <strong>settings</strong> (top-right) to tune graphics + volume.
          </p>
          <div className="flex justify-end">
            <Button size="sm" onClick={dismiss}>
              Got it
            </Button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Tip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-0.5">{icon}</span>
      <span>{children}</span>
    </li>
  );
}
