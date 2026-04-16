import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>room</TableHead>
              <TableHead>id</TableHead>
              <TableHead>clients</TableHead>
              <TableHead>locked</TableHead>
              <TableHead>created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rooms?.map((r) => (
              <TableRow key={r.roomId}>
                <TableCell>{r.name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {r.roomId}
                </TableCell>
                <TableCell>
                  {r.clients}/{r.maxClients}
                </TableCell>
                <TableCell className="text-muted-foreground">{r.locked ? "yes" : "no"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(r.createdAt).toLocaleTimeString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
