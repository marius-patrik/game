import { signOut, tokenStore, useSession } from "@/auth/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/theme/theme-toggle";
import { ZONES, type ZoneId } from "@game/shared";
import { motion } from "framer-motion";
import { Gamepad2, LogOut, MapPin, Shield, Wifi, WifiOff } from "lucide-react";
import { Link, useLocation } from "wouter";

export function HUD({
  status,
  playerCount,
  zoneId,
  onTravel,
}: {
  status: "idle" | "connecting" | "connected" | "error";
  playerCount: number;
  zoneId: ZoneId;
  onTravel: (zoneId: ZoneId) => void;
}) {
  const { data: session } = useSession();
  const isAdmin = ((session?.user as { role?: string } | undefined)?.role ?? "player") === "admin";
  const [, setLocation] = useLocation();
  async function onSignOut() {
    await signOut();
    tokenStore.clear();
    setLocation("/login");
  }
  const connected = status === "connected";
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
        className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-4"
      >
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-xs backdrop-blur-md">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Gamepad2 className="size-3.5" />
              <span>game · dev</span>
            </div>
          </div>
          <div
            data-testid="net-status"
            className="rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-xs backdrop-blur-md"
          >
            <div className="flex items-center gap-2">
              {connected ? (
                <Wifi className="size-3.5 text-emerald-500" />
              ) : (
                <WifiOff className="size-3.5 text-muted-foreground" />
              )}
              <span className={connected ? "text-foreground" : "text-muted-foreground"}>
                {label}
              </span>
            </div>
          </div>
          <div
            data-testid="zone-select"
            className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-background/40 px-3 py-1.5 text-xs backdrop-blur-md"
          >
            <MapPin className="size-3.5 text-muted-foreground" />
            <select
              aria-label="Zone"
              value={zoneId}
              onChange={(e) => onTravel(e.target.value as ZoneId)}
              className="bg-transparent text-foreground outline-none"
            >
              {Object.values(ZONES).map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          {session?.user?.name ? (
            <div className="rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-xs backdrop-blur-md">
              {session.user.name}
            </div>
          ) : null}
          <ThemeToggle />
          {isAdmin ? (
            <Link href="/admin">
              <Button variant="outline" size="sm" className="backdrop-blur-md bg-background/40">
                <Shield />
                admin
              </Button>
            </Link>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className="backdrop-blur-md bg-background/40"
            onClick={onSignOut}
          >
            <LogOut />
            sign out
          </Button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-4"
      >
        <div className="rounded-full border border-border/50 bg-background/40 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur-md">
          WASD to move · drag to orbit · scroll to zoom
        </div>
      </motion.div>
    </>
  );
}
