import { AlertCircle, Keyboard, RotateCcw, Settings } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { cn } from "@/lib/utils";
import {
  formatKeybind,
  KEYBIND_CATEGORIES,
  type KeybindAction,
  type KeybindCategory,
  keybindActionLabel,
  normalizeKey,
} from "@/state/keybinds";
import { useCharacterKeybinds, useKeybindsStore } from "@/state/keybindsStore";
import { FOV_MAX, FOV_MIN } from "@/state/preferencesStore";

type Section = "gameplay" | "keybinds" | "audio" | "graphics";

export function SettingsPanel({
  tier,
  onTierChange,
  volume,
  onVolumeChange,
  skipCinematics,
  onSkipCinematicsChange,
  fov,
  onFovChange,
  autoPickup,
  onAutoPickupChange,
  characterId,
  externalOpen,
  onExternalOpenChange,
}: {
  tier: QualityTier | "auto";
  onTierChange: (tier: QualityTier | "auto") => void;
  volume: number; // 0..1
  onVolumeChange: (v: number) => void;
  skipCinematics: boolean;
  onSkipCinematicsChange: (v: boolean) => void;
  fov: number;
  onFovChange: (v: number) => void;
  autoPickup: boolean;
  onAutoPickupChange: (v: boolean) => void;
  characterId: string | null;
  /** Optional external open control for when the dialog trigger lives elsewhere. */
  externalOpen?: boolean;
  onExternalOpenChange?: (o: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen ?? internalOpen;
  const setOpen = onExternalOpenChange ?? setInternalOpen;
  const controlled = externalOpen !== undefined;
  const [section, setSection] = useState<Section>("gameplay");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {controlled ? null : (
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
      )}
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Tune gameplay, audio, graphics, and keybinds.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-1 border-border/40 border-b pb-2">
          {(
            [
              { id: "gameplay", label: "Gameplay" },
              { id: "keybinds", label: "Keybinds" },
              { id: "audio", label: "Audio" },
              { id: "graphics", label: "Graphics" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSection(t.id)}
              data-section={t.id}
              data-active={section === t.id}
              className={cn(
                "rounded-md px-3 py-1 text-xs transition-colors",
                section === t.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-transparent text-muted-foreground hover:bg-muted",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex min-h-[18rem] flex-col gap-5 overflow-y-auto py-2">
          {section === "gameplay" ? (
            <GameplaySection
              autoPickup={autoPickup}
              onAutoPickupChange={onAutoPickupChange}
              skipCinematics={skipCinematics}
              onSkipCinematicsChange={onSkipCinematicsChange}
              fov={fov}
              onFovChange={onFovChange}
            />
          ) : null}
          {section === "keybinds" ? <KeybindsSection characterId={characterId} /> : null}
          {section === "audio" ? (
            <AudioSection volume={volume} onVolumeChange={onVolumeChange} />
          ) : null}
          {section === "graphics" ? (
            <GraphicsSection tier={tier} onTierChange={onTierChange} />
          ) : null}
        </div>
        <DialogFooter>
          <Button onClick={() => setOpen(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GameplaySection({
  autoPickup,
  onAutoPickupChange,
  skipCinematics,
  onSkipCinematicsChange,
  fov,
  onFovChange,
}: {
  autoPickup: boolean;
  onAutoPickupChange: (v: boolean) => void;
  skipCinematics: boolean;
  onSkipCinematicsChange: (v: boolean) => void;
  fov: number;
  onFovChange: (v: number) => void;
}) {
  return (
    <>
      <section className="flex flex-col gap-2">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium">Auto-pickup drops</span>
          <input
            type="checkbox"
            checked={autoPickup}
            onChange={(e) => onAutoPickupChange(e.target.checked)}
            className="h-4 w-4 accent-primary"
            aria-label="Auto-pickup drops"
            data-testid="auto-pickup-toggle"
          />
        </label>
        <p className="text-muted-foreground text-xs">
          On: drops fly to you on contact with name-only labels. Off: press the Interact key next to
          a drop to pick it up.
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium">Skip cinematics</span>
          <input
            type="checkbox"
            checked={skipCinematics}
            onChange={(e) => onSkipCinematicsChange(e.target.checked)}
            className="h-4 w-4 accent-primary"
            aria-label="Skip cinematics"
          />
        </label>
        <p className="text-muted-foreground text-xs">
          Replaces portal transitions with a plain fade. Saves ~1s per zone swap.
        </p>
      </section>
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Field of view</span>
          <span className="text-muted-foreground">{Math.round(fov)}°</span>
        </div>
        <Slider
          value={[fov]}
          min={FOV_MIN}
          max={FOV_MAX}
          step={1}
          onValueChange={([v]) => onFovChange(v ?? fov)}
          aria-label="Field of view"
        />
        <p className="text-muted-foreground text-xs">
          Wider FOV shows more of the world; narrower feels like a zoom.
        </p>
      </section>
    </>
  );
}

function AudioSection({
  volume,
  onVolumeChange,
}: {
  volume: number;
  onVolumeChange: (v: number) => void;
}) {
  return (
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
  );
}

function GraphicsSection({
  tier,
  onTierChange,
}: {
  tier: QualityTier | "auto";
  onTierChange: (tier: QualityTier | "auto") => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Graphics quality</span>
        <span className="text-muted-foreground">{tier === "auto" ? "auto-detect" : tier}</span>
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
  );
}

function KeybindsSection({ characterId }: { characterId: string | null }) {
  const keybinds = useCharacterKeybinds(characterId);
  const setKeybind = useKeybindsStore((s) => s.setKeybind);
  const resetKeybinds = useKeybindsStore((s) => s.resetKeybinds);
  const [capturing, setCapturing] = useState<KeybindAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isCoarsePointer = useIsCoarsePointer();

  const handleRebind = useCallback(
    (action: KeybindAction, key: string) => {
      const result = setKeybind(characterId, action, key);
      if (result.ok) {
        setError(null);
        return true;
      }
      if (result.reason === "conflict") {
        setError(
          `"${formatKeybind(normalizeKey(key))}" is already bound to ${keybindActionLabel(
            result.conflictsWith,
          )}.`,
        );
      } else {
        setError(
          `"${formatKeybind(normalizeKey(key))}" is reserved by the browser and cannot be rebound.`,
        );
      }
      return false;
    },
    [characterId, setKeybind],
  );

  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setCapturing(null);
        setError(null);
        return;
      }
      if (e.key === "Control" || e.key === "Shift" || e.key === "Alt" || e.key === "Meta") {
        // allow modifier-only bindings; they arrive as "Control" etc.
      }
      const ok = handleRebind(capturing, e.key);
      if (ok) setCapturing(null);
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true } as EventListenerOptions);
  }, [capturing, handleRebind]);

  const categories = useMemo<readonly KeybindCategory[]>(() => KEYBIND_CATEGORIES, []);

  if (isCoarsePointer) {
    return (
      <section className="flex flex-col gap-3 rounded-md border border-dashed border-border/60 p-4 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Keyboard className="size-4" />
          <span className="font-medium">Keybinds are desktop-only</span>
        </div>
        <p className="text-muted-foreground text-xs">
          Touch devices drive actions through on-screen controls. Plug in a keyboard to customize
          bindings.
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-xs">
          Click Rebind and press any key. Esc cancels capture. Bindings are saved per character.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            resetKeybinds(characterId);
            setError(null);
            setCapturing(null);
          }}
          aria-label="Reset keybinds to defaults"
        >
          <RotateCcw className="mr-1 size-3" />
          Reset
        </Button>
      </div>
      {error ? (
        <div
          role="alert"
          data-testid="keybind-error"
          className="flex items-center gap-2 rounded-md border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-rose-300 text-xs"
        >
          <AlertCircle className="size-3.5" />
          {error}
        </div>
      ) : null}
      {categories.map((cat) => (
        <section key={cat.id} className="flex flex-col gap-1.5">
          <h4 className="px-1 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
            {cat.label}
          </h4>
          <div className="flex flex-col divide-y divide-border/40 rounded-md border border-border/40 bg-muted/20">
            {cat.actions.map(({ action, label, description }) => {
              const current = keybinds[action];
              const isCapturing = capturing === action;
              return (
                <div
                  key={action}
                  data-action={action}
                  className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{label}</div>
                    {description ? (
                      <div className="text-muted-foreground text-[11px]">{description}</div>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant={isCapturing ? "default" : "outline"}
                    size="sm"
                    className="h-7 min-w-[88px] px-2 font-mono text-xs"
                    aria-label={`Rebind ${label}`}
                    data-capturing={isCapturing}
                    onClick={() => {
                      setError(null);
                      setCapturing((prev) => (prev === action ? null : action));
                    }}
                  >
                    {isCapturing ? "press a key…" : formatKeybind(current)}
                  </Button>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function useIsCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: coarse)");
    setCoarse(mq.matches);
    const onChange = () => setCoarse(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return coarse;
}
