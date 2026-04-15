import { Route, Switch } from "wouter";
import { AdminLayout } from "./admin/AdminLayout";
import { AdminPlayers } from "./admin/routes/Players";
import { AdminOverview } from "./admin/routes/Overview";
import { AdminRooms } from "./admin/routes/Rooms";
import { GameView } from "./game/GameView";

export function App() {
  return (
    <Switch>
      <Route path="/" component={GameView} />
      <Route path="/admin" nest>
        <AdminLayout>
          <Switch>
            <Route path="/" component={AdminOverview} />
            <Route path="/players" component={AdminPlayers} />
            <Route path="/rooms" component={AdminRooms} />
          </Switch>
        </AdminLayout>
      </Route>
      <Route>
        <div className="flex h-full items-center justify-center text-muted-foreground">
          404
        </div>
      </Route>
    </Switch>
  );
}
