import { Route, Switch } from "wouter";
import { AdminLayout } from "./admin/AdminLayout";
import { AdminOverview } from "./admin/routes/Overview";
import { AdminPlayers } from "./admin/routes/Players";
import { AdminRooms } from "./admin/routes/Rooms";
import { GameView } from "./game/GameView";

export function App() {
  return (
    <Switch>
      <Route path="/" component={GameView} />
      <Route path="/admin">
        <AdminLayout>
          <AdminOverview />
        </AdminLayout>
      </Route>
      <Route path="/admin/players">
        <AdminLayout>
          <AdminPlayers />
        </AdminLayout>
      </Route>
      <Route path="/admin/rooms">
        <AdminLayout>
          <AdminRooms />
        </AdminLayout>
      </Route>
      <Route>
        <div className="flex h-full items-center justify-center text-muted-foreground">404</div>
      </Route>
    </Switch>
  );
}
