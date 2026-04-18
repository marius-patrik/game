import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type AdminPlayer, adminFetch } from "../api";

export function AdminPlayers() {
  const [players, setPlayers] = useState<AdminPlayer[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<{ players: AdminPlayer[] }>("/admin/api/players")
      .then((d) => setPlayers(d.players))
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">players</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {players ? `${players.length} registered` : "loading…"}
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="overflow-hidden rounded-xl border border-border/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>name</TableHead>
              <TableHead>email</TableHead>
              <TableHead>role</TableHead>
              <TableHead>joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {players?.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.name}</TableCell>
                <TableCell className="text-muted-foreground">{p.email}</TableCell>
                <TableCell>
                  <span
                    className={
                      p.role === "admin"
                        ? "rounded-md bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary"
                        : "rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    }
                  >
                    {p.role}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(p.createdAt).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
