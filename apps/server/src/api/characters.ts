import { Router } from "express";
import { createCharacter, listCharacters, softDeleteCharacter } from "../db/character";
import { log } from "../logger";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth(), async (req, res) => {
  try {
    const characters = await listCharacters(req.user!.id);
    res.json({ characters });
  } catch (err) {
    log.error({ err, userId: req.user?.id }, "failed to list characters");
    res.status(500).json({ error: "failed to list characters" });
  }
});

router.post("/", requireAuth(), async (req, res) => {
  const { name, color } = req.body;
  if (typeof name !== "string" || name.trim().length < 3 || name.trim().length > 24) {
    res.status(400).json({ error: "name must be between 3 and 24 characters" });
    return;
  }
  // Basic hex color validation
  if (typeof color !== "string" || !/^#[0-9A-F]{6}$/i.test(color)) {
    res.status(400).json({ error: "invalid color" });
    return;
  }

  try {
    const existing = await listCharacters(req.user!.id);
    if (existing.some((c) => c.name.toLowerCase() === name.trim().toLowerCase())) {
      res.status(400).json({ error: "character name already exists for this user" });
      return;
    }

    const char = await createCharacter({
      userId: req.user!.id,
      name: name.trim(),
      color,
    });
    res.json({ character: char });
  } catch (err) {
    log.error({ err, userId: req.user?.id }, "failed to create character");
    res.status(500).json({ error: "failed to create character" });
  }
});

router.delete("/:id", requireAuth(), async (req, res) => {
  const { id: characterId } = req.params;
  if (typeof characterId !== "string") {
    res.status(400).json({ error: "characterId must be a string" });
    return;
  }
  try {
    // TODO: check if character is currently in-game if we want to follow the plan strictly.
    // For now, soft-delete is enough.
    await softDeleteCharacter(characterId, req.user!.id);
    res.json({ ok: true });
  } catch (err) {
    log.error({ err, userId: req.user?.id, characterId }, "failed to delete character");
    res.status(500).json({ error: "failed to delete character" });
  }
});

export default router;
