import { useEffect, useState } from "react";
import { Redirect, Route, Switch } from "wouter";
import { AdminLayout } from "./admin/AdminLayout";
import { AdminOverview } from "./admin/routes/Overview";
import { AdminPlayers } from "./admin/routes/Players";
import { AdminRooms } from "./admin/routes/Rooms";
import { AdminSessions } from "./admin/routes/Sessions";
import { AudioProvider } from "./audio";
import { AuthForm } from "./auth/AuthForm";
import { RequireRole } from "./auth/RequireRole";
import { useSession } from "./auth/client";
import { Toaster } from "./components/ui/sonner";
import { GameView } from "./game/GameView";
import { charactersApi } from "./lib/charactersApi";
import { CharacterNew } from "./routes/CharacterNew";
import { CharacterSelect } from "./routes/CharacterSelect";
import { useCharacterStore } from "./state/characterStore";

function Protected({ children }: { children: React.ReactNode }) {
  const { data, isPending } = useSession();
  if (isPending) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">…</div>;
  }
  if (!data) return <Redirect to="/login" />;
  return <>{children}</>;
}

function CharacterGuard({ children }: { children: React.ReactNode }) {
  const { selectedCharacterId } = useCharacterStore();
  const [hasCharacters, setHasCharacters] = useState<boolean | null>(null);

  useEffect(() => {
    charactersApi
      .list()
      .then((chars) => {
        setHasCharacters(chars.length > 0);
      })
      .catch(() => setHasCharacters(false));
  }, []);

  if (selectedCharacterId) return <>{children}</>;
  if (hasCharacters === null)
    return <div className="flex h-full items-center justify-center text-muted-foreground">…</div>;
  if (!hasCharacters) return <Redirect to="/characters/new" />;
  return <Redirect to="/characters" />;
}

export function App() {
  return (
    <AudioProvider>
      <Toaster position="top-right" richColors closeButton />
      <Switch>
        <Route path="/login">
          <AuthForm mode="sign-in" />
        </Route>
        <Route path="/signup">
          <AuthForm mode="sign-up" />
        </Route>
        <Route path="/characters">
          <Protected>
            <CharacterSelect />
          </Protected>
        </Route>
        <Route path="/characters/new">
          <Protected>
            <CharacterNew />
          </Protected>
        </Route>
        <Route path="/">
          <Protected>
            <CharacterGuard>
              <GameView />
            </CharacterGuard>
          </Protected>
        </Route>
        <Route path="/admin">
          <RequireRole allow="admin">
            <AdminLayout>
              <AdminOverview />
            </AdminLayout>
          </RequireRole>
        </Route>
        <Route path="/admin/players">
          <RequireRole allow="admin">
            <AdminLayout>
              <AdminPlayers />
            </AdminLayout>
          </RequireRole>
        </Route>
        <Route path="/admin/rooms">
          <RequireRole allow="admin">
            <AdminLayout>
              <AdminRooms />
            </AdminLayout>
          </RequireRole>
        </Route>
        <Route path="/admin/sessions">
          <RequireRole allow="admin">
            <AdminLayout>
              <AdminSessions />
            </AdminLayout>
          </RequireRole>
        </Route>
        <Route>
          <div className="flex h-full items-center justify-center text-muted-foreground">404</div>
        </Route>
      </Switch>
    </AudioProvider>
  );
}
