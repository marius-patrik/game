import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notify } from "@/components/ui/unified-toast";
import { charactersApi } from "@/lib/charactersApi";
import { useCharacterStore } from "@/state/characterStore";
import { useState } from "react";
import { useLocation } from "wouter";

const PRESET_COLORS = [
  "#66c0f4", // Blue
  "#4bb050", // Green
  "#ff5722", // Orange
  "#e91e63", // Pink
  "#9c27b0", // Purple
  "#fbc02d", // Yellow
  "#795548", // Brown
  "#607d8b", // Grey-Blue
];

export function CharacterNew() {
  const [, setLocation] = useLocation();
  const setSelectedCharacterId = useCharacterStore((s) => s.setSelectedCharacterId);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]!);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 3) {
      notify.error("Name must be at least 3 characters");
      return;
    }
    setIsCreating(true);
    try {
      const char = (await charactersApi.create(name.trim(), color)) as {
        id: string;
        name: string;
      };
      setSelectedCharacterId(char.id!);
      notify.success(`Character ${char.name!} created!`);
      setLocation("/");
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Failed to create character");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex h-full items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create Character</CardTitle>
          <CardDescription>Customize your adventurer.</CardDescription>
        </CardHeader>
        <form onSubmit={handleCreate}>
          <CardContent className="space-y-6">
            <div className="flex justify-center py-4">
              <div
                className="h-24 w-24 rounded-lg shadow-lg transition-colors duration-300"
                style={{ backgroundColor: color }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Character Name</Label>
              <Input
                id="name"
                placeholder="Enter name..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={24}
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">3 to 24 characters.</p>
            </div>

            <div className="space-y-2">
              <Label>Sphere Color</Label>
              <div className="grid grid-cols-4 gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Choose character color ${c}`}
                    className={`h-10 w-full rounded-md border-2 transition-all ${
                      color === c ? "border-primary scale-110" : "border-transparent opacity-80"
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                    data-color={c}
                  />
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button
              variant="ghost"
              type="button"
              className="flex-1"
              onClick={() => setLocation("/characters")}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isCreating}>
              {isCreating ? "Creating..." : "Create Character"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
