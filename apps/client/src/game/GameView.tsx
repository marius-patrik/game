import { QualityProvider, type QualityTier, useQuality } from "@/assets";
import { CinematicGate } from "@/cinematic";
import type { NpcSnapshot } from "@/net/useRoom";
import { useRoom } from "@/net/useRoom";
import { useTheme } from "@/theme/theme-provider";
import { type ChatChannel, type EquipSlot, type SkillId, type StatKey, ZONES } from "@game/shared";
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ActionBar } from "./ActionBar";
import { DeathOverlay } from "./DeathOverlay";
import { HUD } from "./HUD";
import { HitVignette } from "./HitVignette";
import { LevelUpBanner } from "./LevelUpBanner";
import { ProgressBar } from "./ProgressBar";
import { QuestToast } from "./QuestToast";
import { QuestTracker } from "./QuestTracker";
import { Scene } from "./Scene";
import { SettingsPanel } from "./SettingsPanel";
import { SidePanel } from "./SidePanel";
import { StatPanel } from "./StatPanel";
import { TopMenu } from "./TopMenu";
import { Tutorial } from "./Tutorial";
import { VendorPanel } from "./VendorPanel";
import { ZoneTransition } from "./ZoneTransition";
import { getSfxVolume, playSfx, setSfxVolume } from "./sfx";
import { useAutoPickup } from "./useAutoPickup";
import { useClickControls } from "./useClickControls";
import { useGameSfx } from "./useGameSfx";
import { useNearestNpc } from "./useNearestNpc";

type Vec3 = { x: number; y: number; z: number };
type TierPref = QualityTier | "auto";

const CINEMATIC_STORAGE_KEY = "cinematic.intro.played";
const CLIENT_RESPAWN_DELAY_MS = 2500;
const SETTINGS_TIER_KEY = "settings.qualityTier";
const SETTINGS_VOLUME_KEY = "settings.volume";

function loadTier(): TierPref {
  if (typeof window === "undefined") return "auto";
  const v = window.localStorage.getItem(SETTINGS_TIER_KEY);
  if (v === "low" || v === "medium" || v === "high" || v === "auto") return v;
  return "auto";
}

function loadVolume(): number {
  if (typeof window === "undefined") return 0.5;
  const raw = window.localStorage.getItem(SETTINGS_VOLUME_KEY);
  if (raw == null) return 0.5;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.5;
}

export function GameView() {
  const [tier, setTier] = useState<TierPref>(loadTier);
  const [volume, setVolume] = useState<number>(() => {
    const v = loadVolume();
    setSfxVolume(v);
    return v;
  });
  const persistTier = useCallback((t: TierPref) => {
    setTier(t);
    if (typeof window !== "undefined") window.localStorage.setItem(SETTINGS_TIER_KEY, t);
  }, []);
  const persistVolume = useCallback((v: number) => {
    setVolume(v);
    setSfxVolume(v);
    if (typeof window !== "undefined") window.localStorage.setItem(SETTINGS_VOLUME_KEY, String(v));
  }, []);

  const providedTier = tier === "auto" ? undefined : tier;

  return (
    <QualityProvider tier={providedTier}>
      <GameViewInner
        tier={tier}
        onTierChange={persistTier}
        volume={volume}
        onVolumeChange={persistVolume}
      />
    </QualityProvider>
  );
}

function GameViewInner({
  tier,
  onTierChange,
  volume,
  onVolumeChange,
}: {
  tier: TierPref;
  onTierChange: (t: TierPref) => void;
  volume: number;
  onVolumeChange: (v: number) => void;
}) {
  const { resolved } = useTheme();
  const { budget } = useQuality();
  const room = useRoom();
  const bg = resolved === "dark" ? "#09090b" : "#fafafa";

  useGameSfx(room);

  const [cinematicActive, setCinematicActive] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(CINEMATIC_STORAGE_KEY) !== "1";
  });
  const finishCinematic = useCallback(() => {
    setCinematicActive(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CINEMATIC_STORAGE_KEY, "1");
    }
  }, []);

  const onMove = useCallback((pos: Vec3) => room.send("move", pos), [room.send]);
  const onPickup = useCallback((dropId: string) => room.send("pickup", { dropId }), [room.send]);
  const onUse = useCallback((itemId: string) => room.send("use", { itemId }), [room.send]);
  const onEquip = useCallback((itemId: string) => room.send("equip", { itemId }), [room.send]);
  const onEquipSlot = useCallback(
    (slot: EquipSlot, itemId: string) => room.send("equipSlot", { slot, itemId }),
    [room.send],
  );
  const onAllocateStat = useCallback(
    (stat: StatKey) => room.send("allocateStat", { stat }),
    [room.send],
  );
  const onCast = useCallback(
    (skillId: SkillId) => {
      room.send("cast", { skillId });
      playSfx("attack");
    },
    [room.send],
  );
  const onBuy = useCallback(
    (itemId: string, qty: number) => room.send("buy", { itemId, qty }),
    [room.send],
  );
  const onSell = useCallback(
    (itemId: string, qty: number) => room.send("sell", { itemId, qty }),
    [room.send],
  );
  const onTurnInQuest = useCallback(
    (questId: string) => room.send("turnInQuest", { questId }),
    [room.send],
  );
  const onDropItem = useCallback(
    (itemId: string, qty: number) => room.send("drop", { itemId, qty }),
    [room.send],
  );
  const onSendChat = useCallback(
    (channel: ChatChannel, text: string) => room.send("chat", { channel, text }),
    [room.send],
  );

  const self = room.sessionId ? room.players.get(room.sessionId) : undefined;
  const alive = self?.alive ?? true;
  const canAct = Boolean(room.sessionId) && !cinematicActive && alive;
  const zone = ZONES[room.zoneId];

  const deathAtRef = useRef<number | undefined>(undefined);
  const lastAliveRef = useRef(true);
  useEffect(() => {
    if (lastAliveRef.current && !alive) {
      deathAtRef.current = Date.now();
      playSfx("death");
    }
    if (!lastAliveRef.current && alive) deathAtRef.current = undefined;
    lastAliveRef.current = alive;
  }, [alive]);

  const [moveTarget, setMoveTarget] = useState<Vec3 | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps are intentional triggers only
  useEffect(() => {
    setMoveTarget(null);
  }, [room.zoneId, self?.alive]);
  const clearMoveTarget = useCallback(() => setMoveTarget(null), []);

  const onGroundClick = useCallback(
    (pos: Vec3) => {
      if (!canAct) return;
      setMoveTarget({ x: pos.x, y: 0, z: pos.z });
    },
    [canAct],
  );

  const [statOpen, setStatOpen] = useState(false);
  const [vendorOpen, setVendorOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const selfPosRef = useClickControls({
    enabled: canAct,
    initial: { x: self?.x ?? zone.spawn.x, y: 0, z: self?.z ?? zone.spawn.z },
    zone,
    moveTarget,
    onArrive: clearMoveTarget,
    onSend: onMove,
  });

  // Auto-pickup drops on proximity.
  useAutoPickup({ enabled: canAct, drops: room.drops, selfPosRef, onPickup });

  // Track nearest NPC + bind interact key.
  const nearestNpc = useNearestNpc({ enabled: canAct, npcs: room.npcs, selfPosRef });
  const onNpcInteract = useCallback((npc: NpcSnapshot) => {
    if (npc.kind === "vendor") setVendorOpen(true);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key !== "e" && e.key !== "E") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (!nearestNpc) return;
      e.preventDefault();
      onNpcInteract(nearestNpc);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nearestNpc, onNpcInteract]);

  useEffect(() => {
    if (getSfxVolume() !== volume) setSfxVolume(volume);
  }, [volume]);

  const canTurnIn = nearestNpc?.kind === "questgiver";

  return (
    <div className="relative h-full w-full" style={{ background: bg }}>
      <Canvas
        shadows
        dpr={[1, budget.maxDPR]}
        camera={{ position: [4, 4, 8], fov: 55 }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <Suspense fallback={null}>
          <Scene
            players={room.players}
            drops={room.drops}
            mobs={room.mobs}
            npcs={room.npcs}
            bolts={room.bolts}
            sessionId={room.sessionId}
            zoneId={room.zoneId}
            moveTarget={moveTarget}
            lastAttack={room.lastAttack}
            lastTelegraph={room.lastTelegraph}
            selfPosRef={selfPosRef}
            cinematicActive={cinematicActive}
            onCinematicComplete={finishCinematic}
            onGroundClick={onGroundClick}
            onPickup={onPickup}
            onNpcInteract={onNpcInteract}
            interactionTargetId={nearestNpc?.id}
          />
          {budget.postFX ? (
            <EffectComposer multisampling={0}>
              <Bloom intensity={0.6} luminanceThreshold={0.85} mipmapBlur />
              <Vignette eskil={false} offset={0.15} darkness={0.6} />
            </EffectComposer>
          ) : null}
        </Suspense>
      </Canvas>

      <HUD status={room.status} playerCount={room.players.size} zoneId={room.zoneId} />

      {!cinematicActive && room.sessionId ? (
        <>
          <ProgressBar player={self} onClick={() => setStatOpen(true)} />
          <div className="pointer-events-auto absolute top-2 right-[220px] sm:top-4 sm:right-[260px]">
            <TopMenu
              status={room.status}
              playerCount={room.players.size}
              zoneId={room.zoneId}
              onTravel={room.travel}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          </div>
          <QuestTracker player={self} />
          <SidePanel
            zoneId={room.zoneId}
            players={room.players}
            mobs={room.mobs}
            npcs={room.npcs}
            sessionId={room.sessionId}
            chat={room.chat}
            onSendChat={onSendChat}
            quests={self?.quests ?? []}
            onTurnInQuest={onTurnInQuest}
            canTurnIn={canTurnIn}
          />
          <ActionBar
            player={self}
            enabled={canAct}
            onCast={onCast}
            onUse={onUse}
            onEquip={onEquip}
            onEquipSlot={onEquipSlot}
            onDrop={onDropItem}
          />
          {nearestNpc ? (
            <div className="pointer-events-none absolute bottom-28 left-1/2 -translate-x-1/2 rounded-full border border-amber-400/60 bg-background/80 px-4 py-1 text-xs shadow backdrop-blur-md">
              Press <kbd className="rounded border border-border/60 bg-muted px-1">E</kbd> to{" "}
              {nearestNpc.kind === "vendor" ? "trade" : "talk"} with{" "}
              <strong>{nearestNpc.name}</strong>
            </div>
          ) : null}
          <VendorPanel
            open={vendorOpen}
            onOpenChange={setVendorOpen}
            player={self}
            onBuy={onBuy}
            onSell={onSell}
          />
          <StatPanel
            player={self}
            open={statOpen}
            onOpenChange={setStatOpen}
            onAllocate={onAllocateStat}
          />
          <SettingsPanelController
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            tier={tier}
            onTierChange={onTierChange}
            volume={volume}
            onVolumeChange={onVolumeChange}
          />
          <Tutorial />
        </>
      ) : null}

      <CinematicGate active={cinematicActive} onSkip={finishCinematic} />

      <DeathOverlay
        dead={!alive && !cinematicActive}
        respawnDelayMs={CLIENT_RESPAWN_DELAY_MS}
        deathAt={deathAtRef.current}
        cause={room.lastDied?.cause}
      />
      <HitVignette self={self} />
      <LevelUpBanner self={self} />
      <QuestToast room={room} />
      <ZoneTransition status={room.status} />
    </div>
  );
}

/** SettingsPanel was originally built as its own button + dialog. Here we strip
 * the trigger so it can be opened from the TopMenu dropdown instead. */
function SettingsPanelController({
  open,
  onOpenChange,
  tier,
  onTierChange,
  volume,
  onVolumeChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tier: TierPref;
  onTierChange: (t: TierPref) => void;
  volume: number;
  onVolumeChange: (v: number) => void;
}) {
  if (!open) return null;
  return (
    <SettingsPanel
      tier={tier}
      onTierChange={onTierChange}
      volume={volume}
      onVolumeChange={onVolumeChange}
      externalOpen={open}
      onExternalOpenChange={onOpenChange}
    />
  );
}
