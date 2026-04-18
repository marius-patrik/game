import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  Coins,
  Info,
  ScrollText,
  Sparkles,
  Star,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import { toast as sonner } from "sonner";

type BaseOpts = {
  description?: string;
  duration?: number;
};

type LevelUpPayload = {
  level: number;
  pointsGained?: number;
};

type QuestReadyPayload = {
  title: string;
  xp: number;
  gold: number;
};

/**
 * Unified feedback surface — every user-facing notification in the app routes
 * through this module. Wraps sonner for the standard info/success/warning/error
 * variants and adds game-specific level-up + quest-ready visual variants that
 * previously lived in bespoke banner components.
 */
export const notify = {
  info(title: string, opts?: BaseOpts) {
    sonner(title, {
      ...opts,
      icon: <Info className="size-4 text-sky-400" />,
    });
  },
  success(title: string, opts?: BaseOpts) {
    sonner.success(title, {
      ...opts,
      icon: <CheckCircle2 className="size-4 text-emerald-500" />,
    });
  },
  warning(title: string, opts?: BaseOpts) {
    sonner.warning(title, {
      ...opts,
      icon: <AlertTriangle className="size-4 text-amber-500" />,
    });
  },
  error(title: string, opts?: BaseOpts) {
    sonner.error(title, {
      ...opts,
      icon: <XCircle className="size-4 text-destructive" />,
    });
  },
  levelUp({ level, pointsGained = 3 }: LevelUpPayload) {
    sonner.custom(
      (t) => (
        <FanfareToast
          accent="amber"
          icon={<Sparkles className="size-5 text-amber-400" />}
          title="Level up!"
          subtitle={
            <span className="flex items-center justify-center gap-1 font-bold text-xl">
              <Star className="size-4 text-amber-400" />
              <span>Lv {level}</span>
            </span>
          }
          caption={`+${pointsGained} stat points · HP + mana restored`}
          onDismiss={() => sonner.dismiss(t)}
        />
      ),
      { duration: 2200 },
    );
  },
  questReady({ title, xp, gold }: QuestReadyPayload) {
    sonner.custom(
      (t) => (
        <FanfareToast
          accent="amber"
          icon={<ScrollText className="size-5 text-amber-400" />}
          title="Quest ready"
          subtitle={<span className="font-semibold text-sm">{title}</span>}
          caption={
            <span className="flex items-center justify-center gap-2 text-xs">
              <span className="flex items-center gap-0.5">
                <Star className="size-3 text-amber-400" />+{xp}
              </span>
              <span className="flex items-center gap-0.5">
                <Coins className="size-3 text-amber-400" />+{gold}
              </span>
            </span>
          }
          onDismiss={() => sonner.dismiss(t)}
        />
      ),
      { duration: 3200 },
    );
  },
};

function FanfareToast({
  accent,
  icon,
  title,
  subtitle,
  caption,
  onDismiss,
}: {
  accent: "amber";
  icon: ReactNode;
  title: string;
  subtitle: ReactNode;
  caption?: ReactNode;
  onDismiss: () => void;
}) {
  const accentBorder = accent === "amber" ? "border-amber-400/70" : "border-amber-400/70";
  return (
    <button
      type="button"
      onClick={onDismiss}
      className={cn(
        "flex min-w-[240px] items-center gap-3 rounded-xl border-2 bg-background/95 px-4 py-3 text-center shadow-xl backdrop-blur-md",
        accentBorder,
      )}
    >
      <span className="shrink-0">{icon}</span>
      <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
        <div className="font-bold text-[10px] text-amber-400 uppercase tracking-widest">
          {title}
        </div>
        <div className="min-w-0 text-center">{subtitle}</div>
        {caption ? <div className="text-[11px] text-muted-foreground">{caption}</div> : null}
      </div>
      <span className="shrink-0">{icon}</span>
    </button>
  );
}
