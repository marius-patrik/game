import { QualityProvider, type QualityTier, useQuality } from "@/assets";
import { CinematicGate } from "@/cinematic";
import type { NpcSnapshot } from "@/net/useRoom";
import { useRoom } from "@/net/useRoom";
import { useTheme } from "@/theme/theme-provider";
import { type ChatChannel, type EquipSlot, type SkillId, type StatKey, ZONES } from "@game/shared";
import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ChatPanel } from "./ChatPanel";
import { DeathOverlay } from "./DeathOverlay";
import { HUD } from "./HUD";
import { InventoryBar } from "./InventoryBar";
import { InventoryPanel } from "./InventoryPanel";
import { Minimap } from "./Minimap";
import { ProgressBar } from "./ProgressBar";
import { QuestPanel } from "./QuestPanel";
import { Scene } from "./Scene";
import { SettingsPanel } from "./SettingsPanel";
import { SkillBar } from "./SkillBar";
import { StatPanel } from "./StatPanel";
import { Tutorial } from "./Tutorial";
import { VendorPanel } from "./VendorPanel";
import { getSfxVolume, playSfx, setSfxVolume } from "./sfx";
import { useClickControls } from "./useClickControls";
import { useGameSfx } from "./useGameSfx";

type Vec3 = { x: number; y: number; z: number };
type TierPref = QualityTier | "auto";

const CINEMATIC_STORAGE_KEY = "cinematic.intro.played";
const CLIENT_RESPAWN_DELAY_MS = 2500;
const ATTACK_COOLDOWN_MS = 400;
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
  const onUnequipSlot = useCallback(
    (slot: EquipSlot) => room.send("unequipSlot", { slot }),
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
  const onChat = useCallback(
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

  const lastAttackClickRef = useRef(0);
  const onAttack = useCallback(() => {
    if (!canAct) return;
    const now = performance.now();
    if (now - lastAttackClickRef.current < ATTACK_COOLDOWN_MS) return;
    lastAttackClickRef.current = now;
    room.send("attack");
    playSfx("attack");
  }, [canAct, room.send]);

  // NPC click → open the right panel
  const [vendorOpen, setVendorOpen] = useState(false);
  const [questOpen, setQuestOpen] = useState(false);
  const onNpcClick = useCallback((npc: NpcSnapshot) => {
    if (npc.kind === "vendor") setVendorOpen(true);
    else if (npc.kind === "questgiver") setQuestOpen(true);
  }, []);

  const selfPosRef = useClickControls({
    enabled: canAct,
    initial: { x: self?.x ?? zone.spawn.x, y: 0, z: self?.z ?? zone.spawn.z },
    zone,
    moveTarget,
    onArrive: clearMoveTarget,
    onSend: onMove,
  });

  useEffect(() => {
    if (getSfxVolume() !== volume) setSfxVolume(volume);
  }, [volume]);

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
            sessionId={room.sessionId}
            zoneId={room.zoneId}
            moveTarget={moveTarget}
            lastAttack={room.lastAttack}
            selfPosRef={selfPosRef}
            cinematicActive={cinematicActive}
            onCinematicComplete={finishCinematic}
            onGroundClick={onGroundClick}
            onAttack={onAttack}
            onPickup={onPickup}
            onNpcClick={onNpcClick}
          />
          {budget.postFX ? (
            <EffectComposer multisampling={0}>
              <Bloom intensity={0.6} luminanceThreshold={0.85} mipmapBlur />
              <Vignette eskil={false} offset={0.15} darkness={0.6} />
            </EffectComposer>
          ) : null}
        </Suspense>
      </Canvas>
      <HUD
        status={room.status}
        playerCount={room.players.size}
        zoneId={room.zoneId}
        onTravel={room.travel}
        settingsSlot={
          <div className="flex items-center gap-2">
            <StatPanel player={self} onAllocate={onAllocateStat} />
            <InventoryPanel
              player={self}
              onEquipSlot={onEquipSlot}
              onUnequipSlot={onUnequipSlot}
              onUse={onUse}
              onDrop={onDropItem}
            />
            <QuestPanel player={self} onTurnIn={onTurnInQuest} />
            <SettingsPanel
              tier={tier}
              onTierChange={onTierChange}
              volume={volume}
              onVolumeChange={onVolumeChange}
            />
          </div>
        }
      />
      <CinematicGate active={cinematicActive} onSkip={finishCinematic} />
      {!cinematicActive && room.sessionId ? (
        <>
          <ProgressBar player={self} />
          <Minimap
            zoneId={room.zoneId}
            players={room.players}
            mobs={room.mobs}
            sessionId={room.sessionId}
          />
          <InventoryBar player={self} onUse={onUse} onEquip={onEquip} />
          <SkillBar enabled={canAct} mana={Math.floor(self?.mana ?? 0)} onCast={onCast} />
          <ChatPanel entries={room.chat} onSend={onChat} enabled={Boolean(room.sessionId)} />
          <VendorPanel
            open={vendorOpen}
            onOpenChange={setVendorOpen}
            player={self}
            onBuy={onBuy}
            onSell={onSell}
          />
          <Tutorial />
        </>
      ) : null}
      {/* QuestPanel dialog is rendered as the trigger in HUD; the external open
          state is controlled by NPC click. We mount a dedicated wrapper below
          so NPC-opened dialog works even if the user never hit the HUD button. */}
      {!cinematicActive && room.sessionId ? (
        <QuestPanel
          player={self}
          onTurnIn={onTurnInQuest}
          externalOpen={questOpen}
          onExternalOpenChange={setQuestOpen}
        />
      ) : null}
      <DeathOverlay
        dead={!alive && !cinematicActive}
        respawnDelayMs={CLIENT_RESPAWN_DELAY_MS}
        deathAt={deathAtRef.current}
      />
    </div>
  );
}
