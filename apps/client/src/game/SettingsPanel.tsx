import type { QualityTier } from "@/assets";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Settings } from "lucide-react";
import { useState } from "react";

export function SettingsPanel({
  tier,
  onTierChange,
  volume,
  onVolumeChange,
}: {
  tier: QualityTier | "auto";
  onTierChange: (tier: QualityTier | "auto") => void;
  volume: number; // 0..1
  onVolumeChange: (v: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="backdrop-blur-md bg-background/40"
          aria-label="Settings"
        >
          <Settings />
          <span className="hidden sm:inline">settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Tune graphics and audio to your rig.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5 py-2">
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Graphics quality</span>
              <span className="text-muted-foreground">
                {tier === "auto" ? "auto-detect" : tier}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {(["auto", "low", "medium", "high"] as const).map((t) => (
                <Button
                  key={t}
                  type="button"
                  variant={tier === t ? "default" : "outline"}
                  size="sm"
                  onClick={() => onTierChange(t)}
                >
                  {t}
                </Button>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              Lower tiers reduce draw calls, shadow resolution, and post-FX for weaker devices.
            </p>
          </section>
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Master volume</span>
              <span className="text-muted-foreground">{Math.round(volume * 100)}%</span>
            </div>
            <Slider
              value={[volume * 100]}
              min={0}
              max={100}
              step={1}
              onValueChange={([v]) => onVolumeChange((v ?? 0) / 100)}
            />
          </section>
        </div>
        <DialogFooter>
          <Button onClick={() => setOpen(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
