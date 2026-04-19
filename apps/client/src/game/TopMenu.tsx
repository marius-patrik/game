import { ZONES, type ZoneId } from "@game/shared";
import {
  LogOut,
  MapPin,
  MoonStar,
  MoreVertical,
  Settings as SettingsIcon,
  Shield,
  Sun,
  SunMoon,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { signOut, tokenStore, useSession } from "@/auth/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/theme/theme-provider";

type Status = "idle" | "connecting" | "connected" | "error";

export function TopMenu({
  status,
  playerCount,
  zoneId,
  onTravel,
  onOpenSettings,
  onSignOut,
}: {
  status: Status;
  playerCount: number;
  zoneId: ZoneId;
  onTravel: (zoneId: ZoneId) => void;
  onOpenSettings: () => void;
  onSignOut: () => Promise<void>;
}) {
  const { data: session } = useSession();
  const isAdmin = ((session?.user as { role?: string } | undefined)?.role ?? "player") === "admin";
  const [, setLocation] = useLocation();
  const { theme, setTheme } = useTheme();
  const [signingOut, setSigningOut] = useState(false);

  async function doSignOut() {
    setSigningOut(true);
    await onSignOut();
    await signOut();
    tokenStore.clear();
    setSigningOut(false);
    setLocation("/login");
  }

  const connected = status === "connected";
  const statusLabel =
    status === "connected"
      ? `online · ${playerCount}`
      : status === "connecting"
        ? "connecting…"
        : status === "error"
          ? "offline"
          : "idle";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="pointer-events-auto backdrop-blur-md bg-background/40"
          aria-label="Game menu"
        >
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>{session?.user?.name ?? "game · dev"}</span>
          <span
            className={`flex items-center gap-1 text-[11px] ${
              connected ? "text-emerald-500" : "text-muted-foreground"
            }`}
          >
            {connected ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
            {statusLabel}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">
          Travel
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={zoneId} onValueChange={(v) => onTravel(v as ZoneId)}>
          {Object.values(ZONES).map((z) => (
            <DropdownMenuRadioItem key={z.id} value={z.id} className="gap-2">
              <MapPin className="size-3 text-muted-foreground" />
              <span>{z.name}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="font-normal text-xs text-muted-foreground">
          Theme
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as typeof theme)}>
          <DropdownMenuRadioItem value="light" className="gap-2">
            <Sun className="size-3" />
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" className="gap-2">
            <MoonStar className="size-3" />
            Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system" className="gap-2">
            <SunMoon className="size-3" />
            System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onOpenSettings} className="gap-2">
          <SettingsIcon className="size-3" />
          Graphics + Audio
        </DropdownMenuItem>
        {isAdmin ? (
          <Link href="/admin">
            <DropdownMenuItem className="gap-2">
              <Shield className="size-3" />
              Admin dashboard
            </DropdownMenuItem>
          </Link>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={doSignOut}
          disabled={signingOut}
          className="gap-2 text-destructive focus:text-destructive"
        >
          <LogOut className="size-3" />
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
