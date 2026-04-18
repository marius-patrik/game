import type {
  DropSnapshot,
  HazardSnapshot,
  MobSnapshot,
  NpcSnapshot,
  PlayerSnapshot,
  RoomState,
} from "@/net/useRoom";
import { ZONES, type ZoneId } from "@game/shared";

type E2EPoint = { x: number; y?: number; z: number };
type E2EViewportPoint = { x: number; y: number };

export type GameE2ESnapshot = {
  status: RoomState["status"];
  error?: string;
  zoneId: ZoneId;
  sessionId?: string;
  playerCount: number;
  self?: PlayerSnapshot;
  players: PlayerSnapshot[];
  mobs: MobSnapshot[];
  npcs: NpcSnapshot[];
  drops: DropSnapshot[];
  hazards: HazardSnapshot[];
  portals: Array<{ to: ZoneId; x: number; y: number; z: number; radius: number }>;
};

type Projector = (point: E2EPoint) => E2EViewportPoint | null;

type GameE2EApi = {
  snapshot: () => GameE2ESnapshot | null;
  worldToViewport: (point: E2EPoint) => E2EViewportPoint | null;
};

type GameE2EWindow = Window &
  typeof globalThis & {
    __GAME_E2E_ENABLED__?: boolean;
    __gameE2E?: GameE2EApi;
  };

let latestSnapshot: GameE2ESnapshot | null = null;
let projector: Projector | null = null;

function getWindow(): GameE2EWindow | undefined {
  if (typeof window === "undefined") return undefined;
  return window as GameE2EWindow;
}

export function isGameE2EEnabled(): boolean {
  return getWindow()?.__GAME_E2E_ENABLED__ === true;
}

function installBridge() {
  const win = getWindow();
  if (!win || !isGameE2EEnabled()) return;
  if (win.__gameE2E) return;
  win.__gameE2E = {
    snapshot: () => latestSnapshot,
    worldToViewport: (point) => projector?.(point) ?? null,
  };
}

export function publishGameE2ESnapshot(input: {
  status: RoomState["status"];
  error?: string;
  zoneId: ZoneId;
  sessionId?: string;
  self?: PlayerSnapshot;
  players: Map<string, PlayerSnapshot>;
  mobs: Map<string, MobSnapshot>;
  npcs: Map<string, NpcSnapshot>;
  drops: Map<string, DropSnapshot>;
  hazards: Map<string, HazardSnapshot>;
}) {
  if (!isGameE2EEnabled()) return;
  installBridge();
  latestSnapshot = {
    status: input.status,
    error: input.error,
    zoneId: input.zoneId,
    sessionId: input.sessionId,
    playerCount: input.players.size,
    self: input.self,
    players: [...input.players.values()],
    mobs: [...input.mobs.values()],
    npcs: [...input.npcs.values()],
    drops: [...input.drops.values()],
    hazards: [...input.hazards.values()],
    portals: ZONES[input.zoneId].portals.map((portal) => ({
      to: portal.to,
      x: portal.pos.x,
      y: portal.pos.y,
      z: portal.pos.z,
      radius: portal.radius,
    })),
  };
}

export function clearGameE2ESnapshot() {
  if (!isGameE2EEnabled()) return;
  latestSnapshot = null;
}

export function setGameE2EProjector(next: Projector | null) {
  if (!isGameE2EEnabled()) return;
  installBridge();
  projector = next;
}
