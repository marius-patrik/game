import { ZONES, type ZoneId } from "@game/shared";
import { motion } from "framer-motion";
import { Gamepad2, MapPin, Wifi, WifiOff } from "lucide-react";
import { CursorLockIndicator } from "./CursorLockIndicator";

type Status = "idle" | "connecting" | "connected" | "error";

/**
 * Top-left identity + status chip and the bottom click-controls hint.
 * Right-hand actions (stats, menu) live in ProgressBar + TopMenu now.
 */
export function HUD({
  status,
  playerCount,
  zoneId,
}: {
  status: Status;
  playerCount: number;
  zoneId: ZoneId;
}) {
  const connected = status === "connected";
  const zone = ZONES[zoneId];
  const label =
    status === "connected"
      ? `online · ${playerCount}`
      : status === "connecting"
        ? "connecting…"
        : status === "error"
          ? "offline"
          : "idle";

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="pointer-events-none absolute top-2 left-2 flex flex-wrap items-center gap-2 sm:top-4 sm:left-4"
      >
        <div className="rounded-lg border border-border/50 bg-background/40 px-3 py-1.5 text-xs backdrop-blur-md">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Gamepad2 className="size-3.5" />
            <span>game · dev</span>
          </div>
        </div>
        <div
          data-testid="net-status"
          className="rounded-lg border border-border/50 bg-background/40 px-3 py-1.5 text-xs backdrop-blur-md"
        >
          <div className="flex items-center gap-2">
            {connected ? (
              <Wifi className="size-3.5 text-emerald-500" />
            ) : (
              <WifiOff className="size-3.5 text-muted-foreground" />
            )}
            <span className={connected ? "text-foreground" : "text-muted-foreground"}>{label}</span>
          </div>
        </div>
        <div className="hidden rounded-lg border border-border/50 bg-background/40 px-3 py-1.5 text-xs backdrop-blur-md sm:block">
          <div className="flex items-center gap-1.5">
            <MapPin className="size-3.5 text-muted-foreground" />
            <span>{zone?.name ?? zoneId}</span>
          </div>
        </div>
        <CursorLockIndicator />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-2 sm:p-3"
      >
        <div className="hidden rounded-full border border-border/50 bg-background/40 px-4 py-1.5 text-[11px] text-muted-foreground backdrop-blur-md sm:block sm:text-xs">
          click ground to move · drag to rotate · ctrl to lock · 1-4 for abilities
        </div>
      </motion.div>
    </>
  );
}
