import { and, eq } from "drizzle-orm";
import { db as defaultDb } from "./client";
import { character, characterDailyProgress, characterInventory, characterProgress } from "./schema";

type DB = typeof defaultDb;

const E2E_CHARACTER_START_GOLD_ENV = "GAME_E2E_CHARACTER_START_GOLD";

function getE2ECharacterStartGold(): number | undefined {
  const raw = process.env[E2E_CHARACTER_START_GOLD_ENV];
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return parsed;
}

export type CharacterRow = {
  id: string;
  userId: string;
  name: string;
  color: string;
  createdAt: Date;
  lastPlayedAt: Date;
  isDeleted: boolean;
};

export type CharacterProgressRow = {
  characterId: string;
  level: number;
  xp: number;
  equippedItemId: string;
  gold: number;
  mana: number;
  maxMana: number;
  strength: number;
  dexterity: number;
  vitality: number;
  intellect: number;
  statPoints: number;
  equipmentJson: string;
  questsJson: string;
  skillCooldownsJson: string;
  skillsEquippedJson: string;
  ultimateSkill: string;
  skillPoints: number;
  updatedAt: Date;
};

export type CharacterInventoryRow = { slotIndex: number; itemId: string; qty: number };

export type DailyProgressRow = {
  characterId: string;
  date: string;
  questId: string;
  progress: number;
  completedAt: Date | null;
};

export type LoadedCharacter = {
  character: CharacterRow | undefined;
  progress: CharacterProgressRow | undefined;
  inventory: CharacterInventoryRow[];
};

export async function loadDailyProgress(
  characterId: string,
  date: string,
  db: DB = defaultDb,
): Promise<DailyProgressRow[]> {
  return db
    .select()
    .from(characterDailyProgress)
    .where(
      and(
        eq(characterDailyProgress.characterId, characterId),
        eq(characterDailyProgress.date, date),
      ),
    );
}

export async function saveDailyProgress(
  row: {
    characterId: string;
    date: string;
    questId: string;
    progress: number;
    completedAt?: Date | null;
  },
  db: DB = defaultDb,
): Promise<void> {
  await db
    .insert(characterDailyProgress)
    .values({
      ...row,
      completedAt: row.completedAt ?? null,
    })
    .onConflictDoUpdate({
      target: [
        characterDailyProgress.characterId,
        characterDailyProgress.date,
        characterDailyProgress.questId,
      ],
      set: {
        progress: row.progress,
        completedAt: row.completedAt ?? null,
      },
    });
}

export async function listCharacters(
  userId: string,
  db: DB = defaultDb,
): Promise<(CharacterRow & { level: number })[]> {
  const rows = await db
    .select({
      character: character,
      level: characterProgress.level,
    })
    .from(character)
    .innerJoin(characterProgress, eq(character.id, characterProgress.characterId))
    .where(and(eq(character.userId, userId), eq(character.isDeleted, false)))
    .orderBy(character.lastPlayedAt);

  return rows.map((r) => ({
    ...r.character,
    level: r.level,
  }));
}

export async function createCharacter(
  input: { userId: string; name: string; color: string },
  db: DB = defaultDb,
): Promise<CharacterRow> {
  const id = `c_${crypto.randomUUID().replace(/-/g, "").substring(0, 16)}`;
  const now = new Date();
  const startGold = getE2ECharacterStartGold();
  const charRow = {
    id,
    userId: input.userId,
    name: input.name,
    color: input.color,
    createdAt: now,
    lastPlayedAt: now,
    isDeleted: false,
  };

  await db.transaction(async (tx) => {
    await tx.insert(character).values(charRow);
    await tx.insert(characterProgress).values({
      characterId: id,
      ...(startGold !== undefined ? { gold: startGold } : {}),
      updatedAt: now,
    });
  });

  return charRow;
}

export async function softDeleteCharacter(
  characterId: string,
  userId: string,
  db: DB = defaultDb,
): Promise<void> {
  await db
    .update(character)
    .set({ isDeleted: true })
    .where(and(eq(character.id, characterId), eq(character.userId, userId)));
}

export async function loadCharacter(
  characterId: string,
  db: DB = defaultDb,
): Promise<LoadedCharacter> {
  const charRows = await db.select().from(character).where(eq(character.id, characterId)).limit(1);

  const char = charRows[0];
  if (!char || char.isDeleted) {
    return { character: undefined, progress: undefined, inventory: [] };
  }

  const progressRows = await db
    .select()
    .from(characterProgress)
    .where(eq(characterProgress.characterId, characterId))
    .limit(1);

  const invRows = await db
    .select({
      slotIndex: characterInventory.slotIndex,
      itemId: characterInventory.itemId,
      qty: characterInventory.qty,
    })
    .from(characterInventory)
    .where(eq(characterInventory.characterId, characterId));

  invRows.sort((a, b) => a.slotIndex - b.slotIndex);

  return { character: char, progress: progressRows[0], inventory: invRows };
}

export type SaveCharacterInput = {
  characterId: string;
  level: number;
  xp: number;
  equippedItemId: string;
  gold?: number;
  mana?: number;
  maxMana?: number;
  strength?: number;
  dexterity?: number;
  vitality?: number;
  intellect?: number;
  statPoints?: number;
  equipmentJson?: string;
  questsJson?: string;
  skillCooldownsJson?: string;
  skillsEquippedJson?: string;
  ultimateSkill?: string;
  skillPoints?: number;
  inventory: readonly { itemId: string; qty: number }[];
  now?: Date;
};

export async function saveCharacter(input: SaveCharacterInput, db: DB = defaultDb): Promise<void> {
  const now = input.now ?? new Date();
  const progressRow = {
    gold: input.gold ?? 0,
    mana: input.mana ?? 50,
    maxMana: input.maxMana ?? 50,
    strength: input.strength ?? 5,
    dexterity: input.dexterity ?? 5,
    vitality: input.vitality ?? 5,
    intellect: input.intellect ?? 5,
    statPoints: input.statPoints ?? 0,
    equipmentJson: input.equipmentJson ?? "{}",
    questsJson: input.questsJson ?? "{}",
    skillCooldownsJson: input.skillCooldownsJson ?? "{}",
    skillsEquippedJson: input.skillsEquippedJson ?? "[]",
    ultimateSkill: input.ultimateSkill ?? "",
    skillPoints: input.skillPoints ?? 0,
  };

  await db.transaction(async (tx) => {
    // Update last played at
    await tx
      .update(character)
      .set({ lastPlayedAt: now })
      .where(eq(character.id, input.characterId));

    // Update progress
    await tx
      .insert(characterProgress)
      .values({
        characterId: input.characterId,
        level: input.level,
        xp: input.xp,
        equippedItemId: input.equippedItemId,
        ...progressRow,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: characterProgress.characterId,
        set: {
          level: input.level,
          xp: input.xp,
          equippedItemId: input.equippedItemId,
          ...progressRow,
          updatedAt: now,
        },
      });

    // Update inventory
    await tx
      .delete(characterInventory)
      .where(eq(characterInventory.characterId, input.characterId));

    if (input.inventory.length > 0) {
      await tx.insert(characterInventory).values(
        input.inventory.map((slot, slotIndex) => ({
          characterId: input.characterId,
          slotIndex,
          itemId: slot.itemId,
          qty: slot.qty,
          updatedAt: now,
        })),
      );
    }
  });
}
