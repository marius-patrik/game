import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useEffect, useState } from "react";
import { adminFetch } from "../api";

type LiveSession = {
  roomId: string;
  zoneId: string;
  zoneName: string;
  clients: number;
  clientIds: string[];
};

type SessionsResponse = {
  totalRooms: number;
  totalClients: number;
  registered: number;
  sessions: LiveSession[];
};

export function AdminSessions() {
  const [data, setData] = useState<SessionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = () =>
      adminFetch<SessionsResponse>("/admin/api/sessions")
        .then((d) => {
          if (!cancelled) setData(d);
        })
        .catch((e) => {
          if (!cancelled) setError(String(e));
        });
    tick();
    const id = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">live sessions</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {data
          ? `${data.totalClients} connected across ${data.totalRooms} room${
              data.totalRooms === 1 ? "" : "s"
            } · ${data.registered} total registered`
          : "loading…"}
        · auto-refresh 3s
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="overflow-hidden rounded-xl border border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>zone</TableHead>
              <TableHead>room</TableHead>
              <TableHead>clients</TableHead>
              <TableHead>client ids</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  No one online right now.
                </TableCell>
              </TableRow>
            ) : (
              data?.sessions.map((s) => (
                <TableRow key={s.roomId}>
                  <TableCell>{s.zoneName || s.zoneId}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {s.roomId}
                  </TableCell>
                  <TableCell>{s.clients}</TableCell>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">
                    {s.clientIds.length > 0 ? s.clientIds.join(", ") : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
