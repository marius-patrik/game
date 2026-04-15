import { useEffect, useState } from "react";
import { type AdminPlayer, type AdminRoom, adminFetch } from "../api";

export function AdminOverview() {
  const [players, setPlayers] = useState<AdminPlayer[] | null>(null);
  const [rooms, setRooms] = useState<AdminRoom[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      adminFetch<{ players: AdminPlayer[] }>("/admin/api/players"),
      adminFetch<{ rooms: AdminRoom[] }>("/admin/api/rooms"),
    ])
      .then(([p, r]) => {
        setPlayers(p.players);
        setRooms(r.rooms);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const onlineClients = rooms?.reduce((n, r) => n + r.clients, 0) ?? 0;

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">overview</h1>
      <p className="mb-6 text-sm text-muted-foreground">live metrics and health signals.</p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="grid grid-cols-3 gap-4">
        <Metric label="registered players" value={players?.length ?? "—"} />
        <Metric label="active rooms" value={rooms?.length ?? "—"} />
        <Metric label="connected clients" value={rooms ? onlineClients : "—"} />
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card p-5">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  );
}
