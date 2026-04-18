import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { notify } from "@/components/ui/unified-toast";
import { type Character, charactersApi } from "@/lib/charactersApi";
import { useCharacterStore } from "@/state/characterStore";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";

export function CharacterSelect() {
  const [, setLocation] = useLocation();
  const { selectedCharacterId, setSelectedCharacterId } = useCharacterStore();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    charactersApi
      .list()
      .then(setCharacters)
      .catch((err) => notify.error("Failed to load characters"))
      .finally(() => setIsLoading(false));
  }, []);

  const handlePlay = (charId: string) => {
    setSelectedCharacterId(charId);
    setLocation("/");
  };

  const handleDelete = async (charId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      await charactersApi.delete(charId);
      setCharacters((prev) => prev.filter((c) => c.id !== charId));
      if (selectedCharacterId === charId) {
        setSelectedCharacterId(null);
      }
      notify.success("Character deleted");
    } catch (err) {
      notify.error("Failed to delete character");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Characters</h1>
            <p className="text-muted-foreground">Select a character to play or create a new one.</p>
          </div>
          <Button onClick={() => setLocation("/characters/new")}>
            <Plus className="mr-2 h-4 w-4" /> New Character
          </Button>
        </div>

        {characters.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center">
            <div className="mb-4 rounded-full bg-muted p-4">
              <Plus className="h-8 w-8 text-muted-foreground" />
            </div>
            <CardTitle>No characters found</CardTitle>
            <CardDescription className="mt-2">
              You haven't created any adventurers yet. Start your journey now!
            </CardDescription>
            <Button className="mt-6" onClick={() => setLocation("/characters/new")}>
              Create First Character
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {characters.map((char) => (
              <Card
                key={char.id}
                className={`overflow-hidden transition-all hover:ring-2 hover:ring-primary/50 ${
                  selectedCharacterId === char.id ? "ring-2 ring-primary" : ""
                }`}
              >
                <div
                  className="h-24 w-full flex items-center justify-center"
                  style={{ backgroundColor: char.color }}
                >
                  <div className="h-12 w-12 rounded bg-white/20 backdrop-blur-sm" />
                </div>
                <CardHeader>
                  <CardTitle>{char.name}</CardTitle>
                  <CardDescription>Level {char.level}</CardDescription>
                </CardHeader>
                <CardFooter className="flex gap-2">
                  <Button className="flex-1" onClick={() => handlePlay(char.id)}>
                    Play
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(char.id, char.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
