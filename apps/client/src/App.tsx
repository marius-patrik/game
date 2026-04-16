import { Redirect, Route, Switch } from "wouter";
import { AdminLayout } from "./admin/AdminLayout";
import { AdminOverview } from "./admin/routes/Overview";
import { AdminPlayers } from "./admin/routes/Players";
import { AdminRooms } from "./admin/routes/Rooms";
import { AudioProvider } from "./audio";
import { AuthForm } from "./auth/AuthForm";
import { RequireRole } from "./auth/RequireRole";
import { useSession } from "./auth/client";
import { Toaster } from "./components/ui/sonner";
import { GameView } from "./game/GameView";

function Protected({ children }: { children: React.ReactNode }) {
  const { data, isPending } = useSession();
  if (isPending) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">…</div>;
  }
  if (!data) return <Redirect to="/login" />;
  return <>{children}</>;
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
        <Route path="/">
          <Protected>
            <GameView />
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
        <Route>
          <div className="flex h-full items-center justify-center text-muted-foreground">404</div>
        </Route>
      </Switch>
    </AudioProvider>
  );
}
