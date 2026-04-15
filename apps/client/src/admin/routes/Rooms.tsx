import { useEffect, useState } from "react";
import { type AdminRoom, adminFetch } from "../api";

export function AdminRooms() {
  const [rooms, setRooms] = useState<AdminRoom[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      adminFetch<{ rooms: AdminRoom[] }>("/admin/api/rooms")
        .then((d) => {
          if (!cancelled) setRooms(d.rooms);
        })
        .catch((e) => {
          if (!cancelled) setError(String(e));
        });
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">rooms</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {rooms ? `${rooms.length} active` : "loading…"} · auto-refresh 3s
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="overflow-hidden rounded-xl border border-border/50">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">room</th>
              <th className="px-4 py-2 text-left font-medium">id</th>
              <th className="px-4 py-2 text-left font-medium">clients</th>
              <th className="px-4 py-2 text-left font-medium">locked</th>
              <th className="px-4 py-2 text-left font-medium">created</th>
            </tr>
          </thead>
          <tbody>
            {rooms?.map((r) => (
              <tr key={r.roomId} className="border-t border-border/50">
                <td className="px-4 py-2">{r.name}</td>
                <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{r.roomId}</td>
                <td className="px-4 py-2">
                  {r.clients}/{r.maxClients}
                </td>
                <td className="px-4 py-2 text-muted-foreground">{r.locked ? "yes" : "no"}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {new Date(r.createdAt).toLocaleTimeString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
