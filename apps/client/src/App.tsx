import { Redirect, Route, Switch } from "wouter";
import { AdminLayout } from "./admin/AdminLayout";
import { AdminOverview } from "./admin/routes/Overview";
import { AdminPlayers } from "./admin/routes/Players";
import { AdminRooms } from "./admin/routes/Rooms";
import { AuthForm } from "./auth/AuthForm";
import { useSession } from "./auth/client";
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
        <Protected>
          <AdminLayout>
            <AdminOverview />
          </AdminLayout>
        </Protected>
      </Route>
      <Route path="/admin/players">
        <Protected>
          <AdminLayout>
            <AdminPlayers />
          </AdminLayout>
        </Protected>
      </Route>
      <Route path="/admin/rooms">
        <Protected>
          <AdminLayout>
            <AdminRooms />
          </AdminLayout>
        </Protected>
      </Route>
      <Route>
        <div className="flex h-full items-center justify-center text-muted-foreground">404</div>
      </Route>
    </Switch>
  );
}
