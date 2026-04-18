import {
  type ChatChannel,
  type EquipSlot,
  type SkillId,
  type SkillSlot,
  type StatKey,
  type WeaponSlotKey,
  ZONES,
} from "@game/shared";
import { Canvas } from "@react-three/fiber";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { QualityProvider, type QualityTier, useQuality } from "@/assets";
import { CinematicGate } from "@/cinematic";
import { emitFxEvent, triggerScreenShake, useScreenShakeDom } from "@/game/fx";
import { GAME_PALETTE } from "@/game/gamePalette";
import type { DropSnapshot, NpcSnapshot } from "@/net/useRoom";
import { useRoom } from "@/net/useRoom";
import { useCharacterStore } from "@/state/characterStore";
import { matchesKeybind } from "@/state/keybinds";
import { useCharacterKeybinds } from "@/state/keybindsStore";
import { usePreferencesStore } from "@/state/preferencesStore";
import { useTheme } from "@/theme/theme-provider";
import { ActionBar } from "./ActionBar";
import { BottomBars } from "./BottomBars";
import { Compass } from "./Compass";
import { setCameraProfile } from "./camera/cameraProfiles";
import { useCursorLockToggleKey } from "./camera/useCursorLock";
import { DeathOverlay } from "./DeathOverlay";
import { DialogUI } from "./DialogUI";
import { closeDialog, peekDialog, useDialogState } from "./dialog/dialogStore";
import { HitVignette } from "./HitVignette";
import { InteractionPrompt, type InteractionPromptKind } from "./InteractionPrompt";
import { PartyPanel } from "./PartyPanel";
import { Scene } from "./Scene";
import { SettingsPanel } from "./SettingsPanel";
import { StatPanel } from "./StatPanel";
import { getSfxVolume, playSfx, setSfxVolume } from "./sfx";
import { TopLeftPane } from "./TopLeftPane";
import { TopMenu } from "./TopMenu";
import { TopRightSidebar } from "./TopRightSidebar";
import { Tutorial } from "./Tutorial";
import { useTargetingInputHandlers } from "./targeting";
import { useAutoPickup } from "./useAutoPickup";
import { useClickControls } from "./useClickControls";
import { useGameSfx } from "./useGameSfx";
import { VendorPanel } from "./VendorPanel";
import { ZoneTransition } from "./ZoneTransition";

type Vec3 = { x: number; y: number; z: number };
type TierPref = QualityTier | "auto";
type InteractionTarget =
  | { kind: "npc"; npc: NpcSnapshot; dist: number }
  | { kind: "drop"; drop: DropSnapshot; dist: number };

const INTERACT_RADIUS = 2.2;

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

function findNearestInteractTarget(
  npcs: Map<string, NpcSnapshot>,
  drops: Map<string, DropSnapshot>,
  self: Vec3,
  preferDrops: boolean,
): InteractionTarget | undefined {
  const r2 = INTERACT_RADIUS * INTERACT_RADIUS;
  let nearest: InteractionTarget | undefined;
  let nearestDist = r2;
  if (preferDrops) {
    for (const d of drops.values()) {
      const dx = d.x - self.x;
      const dz = d.z - self.z;
      const dist = dx * dx + dz * dz;
      if (dist > r2) continue;
      if (!nearest || dist < nearestDist) {
        nearest = { kind: "drop", drop: d, dist };
        nearestDist = dist;
      }
    }
  }
  for (const n of npcs.values()) {
    const dx = n.x - self.x;
    const dz = n.z - self.z;
    const dist = dx * dx + dz * dz;
    if (dist > r2) continue;
    if (!nearest || dist < nearestDist) {
      nearest = { kind: "npc", npc: n, dist };
      nearestDist = dist;
    }
  }
  return nearest;
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
  const skipCinematics = usePreferencesStore((s) => s.skipCinematics);
  const setSkipCinematics = usePreferencesStore((s) => s.setSkipCinematics);
  const fov = usePreferencesStore((s) => s.fov);
  const setFov = usePreferencesStore((s) => s.setFov);
  const autoPickup = usePreferencesStore((s) => s.autoPickup);
  const setAutoPickup = usePreferencesStore((s) => s.setAutoPickup);
  const selectedCharacterId = useCharacterStore((s) => s.selectedCharacterId);
  const keybinds = useCharacterKeybinds(selectedCharacterId);
  const bg = resolved === "dark" ? "hsl(240 10% 3.9%)" : "hsl(0 0% 98%)";

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
  const onUseAbility = useCallback(
    (slot: WeaponSlotKey | SkillSlot) => {
      room.send("use-ability", { slot });
      playSfx("attack");
      const me = room.sessionId ? room.players.get(room.sessionId) : undefined;
      if (me) {
        emitFxEvent({
          kind: "ability-pulse",
          at: { x: me.x, z: me.z },
          color: GAME_PALETTE.abilityPulse,
        });
      }
    },
    [room.send, room.sessionId, room.players],
  );
  const onUseAbilityAt = useCallback(
    (slot: WeaponSlotKey | SkillSlot, target: Vec3) => {
      room.send("use-ability", { slot, target: { x: target.x, z: target.z } });
      playSfx("attack");
      const me = room.sessionId ? room.players.get(room.sessionId) : undefined;
      if (me) {
        emitFxEvent({
          kind: "ability-pulse",
          at: { x: me.x, z: me.z },
          color: GAME_PALETTE.abilityPulse,
        });
      }
    },
    [room.send, room.sessionId, room.players],
  );
  const onAllocateSkill = useCallback(
    (skillId: SkillId, slot: SkillSlot) => {
      room.send("allocate-skill", { skillId, slot });
    },
    [room.send],
  );
  const onUnbindSkill = useCallback(
    (slot: SkillSlot) => {
      room.send("unbind-skill", { slot });
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

  // Ctrl toggles pointer-lock once we're in the world. Disabled during
  // the intro cinematic so the camera flyaround isn't interrupted.
  useCursorLockToggleKey(canAct, keybinds.cursor_lock);

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
  const [interactionTarget, setInteractionTarget] = useState<InteractionTarget | undefined>();

  const selfPosRef = useClickControls({
    enabled: canAct,
    initial: { x: self?.x ?? zone.spawn.x, y: 0, z: self?.z ?? zone.spawn.z },
    zone,
    moveTarget,
    onArrive: clearMoveTarget,
    onSend: onMove,
  });

  const getTargetingOrigin = useCallback(
    () => ({ x: selfPosRef.current.x, y: selfPosRef.current.y, z: selfPosRef.current.z }),
    [selfPosRef],
  );
  useTargetingInputHandlers({ getOrigin: getTargetingOrigin });

  // Auto-pickup drops on proximity (toggleable via preferences).
  useAutoPickup({
    enabled: canAct && autoPickup,
    drops: room.drops,
    selfPosRef,
    onPickup,
  });

  // Track the nearest interactable — drops only count when auto-pickup is OFF
  // (otherwise they're grabbed on contact and should never need a prompt).
  useEffect(() => {
    if (!canAct) {
      setInteractionTarget(undefined);
      return;
    }
    const id = window.setInterval(() => {
      const selfPos = selfPosRef?.current;
      if (!selfPos) return;
      const next = findNearestInteractTarget(room.npcs, room.drops, selfPos, !autoPickup);
      setInteractionTarget((prev) => {
        if (!next) return prev === undefined ? prev : undefined;
        if (prev?.kind === "npc" && next.kind === "npc" && prev.npc.id === next.npc.id) return prev;
        if (prev?.kind === "drop" && next.kind === "drop" && prev.drop.id === next.drop.id)
          return prev;
        return next;
      });
    }, 150);
    return () => window.clearInterval(id);
  }, [canAct, room.npcs, room.drops, selfPosRef, autoPickup]);

  const onNpcInteract = useCallback(
    (npc: NpcSnapshot) => {
      // Keep the one-press quest-turn-in shortcut for quest-givers with a
      // completed quest ready — players expect that flow from pre-dialog.
      if (npc.kind === "questgiver") {
        const readyQuest = self?.quests.find((q) => q.status === "complete");
        if (readyQuest) {
          onTurnInQuest(readyQuest.id);
          return;
        }
      }
      // Everything else routes into the branching dialog system.
      room.send("dialog-start", { npcId: npc.id });
    },
    [onTurnInQuest, room.send, self],
  );

  const dialog = useDialogState();
  const onDialogChoose = useCallback(
    (choiceIndex: number) => {
      const current = peekDialog();
      if (!current.open || !current.node) return;
      room.send("dialog-choose", {
        npcId: current.node.npcId,
        nodeId: current.node.id,
        choiceIndex,
      });
    },
    [room.send],
  );
  const onDialogClose = useCallback(() => {
    closeDialog();
  }, []);

  useEffect(() => {
    if (dialog.open) {
      setCameraProfile("dialog");
    } else {
      setCameraProfile("combat");
    }
  }, [dialog.open]);

  useEffect(() => {
    const onOpenVendor = () => setVendorOpen(true);
    window.addEventListener("game:open-vendor", onOpenVendor);
    return () => window.removeEventListener("game:open-vendor", onOpenVendor);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (!matchesKeybind(e.key, keybinds.interact)) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (dialog.open) return;
      if (!interactionTarget) return;
      e.preventDefault();
      if (interactionTarget.kind === "npc") {
        onNpcInteract(interactionTarget.npc);
      } else {
        onPickup(interactionTarget.drop.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [interactionTarget, keybinds.interact, onNpcInteract, onPickup, dialog.open]);

  useEffect(() => {
    if (getSfxVolume() !== volume) setSfxVolume(volume);
  }, [volume]);

  const readyToTurnIn = Boolean(self?.quests.some((q) => q.status === "complete"));
  const promptInfo = buildPromptInfo(interactionTarget, readyToTurnIn);

  const shakeClass = useScreenShakeDom();

  return (
    <div className={`relative h-full w-full ${shakeClass}`.trim()} style={{ background: bg }}>
      <div className="absolute inset-0" data-theme="game">
        <Canvas
          shadows
          dpr={[1, budget.maxDPR]}
          camera={{ position: [4, 4, 8], fov }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
        >
          <Suspense fallback={null}>
            <Scene
              players={room.players}
              drops={room.drops}
              mobs={room.mobs}
              npcs={room.npcs}
              hazards={room.hazards}
              bolts={room.bolts}
              sessionId={room.sessionId}
              zoneId={room.zoneId}
              moveTarget={moveTarget}
              lastAttack={room.lastAttack}
              lastAbility={room.lastAbility}
              lastTelegraph={room.lastTelegraph}
              selfPosRef={selfPosRef}
              cinematicActive={cinematicActive}
              portalCinematicActive={
                !skipCinematics && (room.status === "connecting" || room.status === "idle")
              }
              onCinematicComplete={finishCinematic}
              onGroundClick={onGroundClick}
              onPickup={onPickup}
              onNpcInteract={onNpcInteract}
            />
          </Suspense>
        </Canvas>
      </div>

      {!cinematicActive && room.sessionId ? (
        <>
          {dialog.open ? null : (
            <>
              <Compass cinematicActive={cinematicActive} />
              <TopLeftPane
                zoneId={room.zoneId}
                players={room.players}
                mobs={room.mobs}
                npcs={room.npcs}
                hazards={room.hazards}
                sessionId={room.sessionId}
                chat={room.chat}
                onSendChat={onSendChat}
                quests={self?.quests ?? []}
                dailyQuests={self?.dailyQuests ?? []}
                onTurnInQuest={onTurnInQuest}
                canTurnIn={readyToTurnIn}
                self={self}
                onAllocateStat={onAllocateStat}
                onUnequipSlot={onUnequipSlot}
                onUse={onUse}
                onEquip={onEquip}
                onEquipSlot={onEquipSlot}
                onDrop={onDropItem}
                onAllocateSkill={onAllocateSkill}
                onUnbindSkill={onUnbindSkill}
              />
              <TopRightSidebar player={self} zoneId={room.zoneId} />
              <div className="pointer-events-auto absolute top-2 right-2 z-20 sm:top-4 sm:right-4">
                <TopMenu
                  status={room.status}
                  playerCount={room.players.size}
                  zoneId={room.zoneId}
                  onTravel={room.travel}
                  onOpenSettings={() => setSettingsOpen(true)}
                />
              </div>
              <PartyPanel players={room.players} sessionId={room.sessionId} />
            </>
          )}
          <BottomBars player={self} />
          <ActionBar
            player={self}
            enabled={canAct && !dialog.open}
            onUseAbility={onUseAbility}
            onUseAbilityAt={onUseAbilityAt}
            onUse={onUse}
            onEquipSlot={onEquipSlot}
          />
          <InteractionPrompt
            visible={promptInfo !== null && !dialog.open}
            label={promptInfo?.label ?? ""}
            keyBinding={keybinds.interact}
            verb={promptInfo?.verb ?? "interact with"}
            kind={promptInfo?.kind ?? "npc"}
          />
          <DialogUI onChoose={onDialogChoose} onClose={onDialogClose} />
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
            onUnequipSlot={onUnequipSlot}
          />
          <SettingsPanelController
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            tier={tier}
            onTierChange={onTierChange}
            volume={volume}
            onVolumeChange={onVolumeChange}
            skipCinematics={skipCinematics}
            onSkipCinematicsChange={setSkipCinematics}
            fov={fov}
            onFovChange={setFov}
            autoPickup={autoPickup}
            onAutoPickupChange={setAutoPickup}
            characterId={selectedCharacterId}
          />
          <Tutorial />
        </>
      ) : null}

      <CinematicGate
        active={cinematicActive}
        onSkip={finishCinematic}
        skipKey={keybinds.cinematic_skip}
      />

      <DeathOverlay
        dead={!alive && !cinematicActive}
        respawnDelayMs={CLIENT_RESPAWN_DELAY_MS}
        deathAt={deathAtRef.current}
        cause={room.lastDied?.cause}
      />
      <HitVignette self={self} />
      <ZoneTransition status={room.status} zoneId={room.zoneId} skipCinematics={skipCinematics} />
    </div>
  );
}

function buildPromptInfo(
  target: InteractionTarget | undefined,
  readyToTurnIn: boolean,
): { label: string; verb: string; kind: InteractionPromptKind } | null {
  if (!target) return null;
  if (target.kind === "drop") {
    return { label: target.drop.itemId, verb: "pick up", kind: "drop" };
  }
  const { npc } = target;
  if (npc.kind === "vendor") {
    return { label: npc.name, verb: "trade with", kind: "vendor" };
  }
  if (npc.kind === "questgiver") {
    return {
      label: npc.name,
      verb: readyToTurnIn ? "turn in to" : "talk to",
      kind: "questgiver",
    };
  }
  return { label: npc.name, verb: "talk to", kind: "npc" };
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
  skipCinematics,
  onSkipCinematicsChange,
  fov,
  onFovChange,
  autoPickup,
  onAutoPickupChange,
  characterId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tier: TierPref;
  onTierChange: (t: TierPref) => void;
  volume: number;
  onVolumeChange: (v: number) => void;
  skipCinematics: boolean;
  onSkipCinematicsChange: (v: boolean) => void;
  fov: number;
  onFovChange: (v: number) => void;
  autoPickup: boolean;
  onAutoPickupChange: (v: boolean) => void;
  characterId: string | null;
}) {
  if (!open) return null;
  return (
    <SettingsPanel
      tier={tier}
      onTierChange={onTierChange}
      volume={volume}
      onVolumeChange={onVolumeChange}
      skipCinematics={skipCinematics}
      onSkipCinematicsChange={onSkipCinematicsChange}
      fov={fov}
      onFovChange={onFovChange}
      autoPickup={autoPickup}
      onAutoPickupChange={onAutoPickupChange}
      characterId={characterId}
      externalOpen={open}
      onExternalOpenChange={onOpenChange}
    />
  );
}
