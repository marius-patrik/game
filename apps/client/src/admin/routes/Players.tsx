import { useEffect, useState } from "react";
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
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">name</th>
              <th className="px-4 py-2 text-left font-medium">email</th>
              <th className="px-4 py-2 text-left font-medium">role</th>
              <th className="px-4 py-2 text-left font-medium">joined</th>
            </tr>
          </thead>
          <tbody>
            {players?.map((p) => (
              <tr key={p.id} className="border-t border-border/50">
                <td className="px-4 py-2">{p.name}</td>
                <td className="px-4 py-2 text-muted-foreground">{p.email}</td>
                <td className="px-4 py-2">
                  <span
                    className={
                      p.role === "admin"
                        ? "rounded-md bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary"
                        : "rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                    }
                  >
                    {p.role}
                  </span>
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  {new Date(p.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
