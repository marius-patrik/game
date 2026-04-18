import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { notify } from "@/components/ui/unified-toast";
import { adminFetch, adminPost } from "../api";

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

type PendingAction = {
  kind: "kick" | "mute" | "revoke";
  sessionId: string;
  roomId: string;
  zoneName: string;
};

const ACTION_COPY: Record<
  PendingAction["kind"],
  { title: string; description: string; confirmLabel: string }
> = {
  kick: {
    title: "Kick this session?",
    description:
      "Disconnects the player's current Colyseus socket. They can reconnect immediately with the same login.",
    confirmLabel: "Kick",
  },
  mute: {
    title: "Mute chat for 15 minutes?",
    description:
      "Player stays connected but any chat message they send is rejected until the timer expires.",
    confirmLabel: "Mute 15m",
  },
  revoke: {
    title: "Revoke this session's login?",
    description:
      "Deletes their better-auth session rows and kicks the live socket. They will have to log in again.",
    confirmLabel: "Revoke",
  },
};

export function AdminSessions() {
  const [data, setData] = useState<SessionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const cancelledRef = useRef(false);

  const fetchSessions = useCallback(async () => {
    try {
      const d = await adminFetch<SessionsResponse>("/admin/api/sessions");
      if (!cancelledRef.current) setData(d);
    } catch (e) {
      if (!cancelledRef.current) setError(String(e));
    }
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    fetchSessions();
    const id = setInterval(fetchSessions, 3000);
    return () => {
      cancelledRef.current = true;
      clearInterval(id);
    };
  }, [fetchSessions]);

  const copy = useMemo(() => (pending ? ACTION_COPY[pending.kind] : null), [pending]);

  const onConfirm = async () => {
    if (!pending) return;
    setSubmitting(true);
    try {
      await adminPost(`/admin/api/sessions/${pending.sessionId}/${pending.kind}`);
      const labels = { kick: "Kicked", mute: "Muted 15m", revoke: "Revoked" } as const;
      notify.success(`${labels[pending.kind]} ${pending.sessionId.slice(0, 6)}`);
      setPending(null);
      await fetchSessions();
    } catch (e) {
      notify.error(`Action failed: ${String(e)}`);
    } finally {
      setSubmitting(false);
    }
  };

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
              <TableHead>sessions</TableHead>
              <TableHead className="w-[260px]">actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  No one online right now.
                </TableCell>
              </TableRow>
            ) : (
              data?.sessions.flatMap((s) =>
                s.clientIds.length > 0
                  ? s.clientIds.map((sessionId) => (
                      <TableRow key={`${s.roomId}:${sessionId}`}>
                        <TableCell>{s.zoneName || s.zoneId}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {s.roomId}
                        </TableCell>
                        <TableCell>{s.clients}</TableCell>
                        <TableCell className="font-mono text-[11px] text-muted-foreground">
                          {sessionId}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setPending({
                                  kind: "kick",
                                  sessionId,
                                  roomId: s.roomId,
                                  zoneName: s.zoneName || s.zoneId,
                                })
                              }
                            >
                              Kick
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setPending({
                                  kind: "mute",
                                  sessionId,
                                  roomId: s.roomId,
                                  zoneName: s.zoneName || s.zoneId,
                                })
                              }
                            >
                              Mute 15m
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                setPending({
                                  kind: "revoke",
                                  sessionId,
                                  roomId: s.roomId,
                                  zoneName: s.zoneName || s.zoneId,
                                })
                              }
                            >
                              Revoke
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  : [
                      <TableRow key={s.roomId}>
                        <TableCell>{s.zoneName || s.zoneId}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {s.roomId}
                        </TableCell>
                        <TableCell>{s.clients}</TableCell>
                        <TableCell className="text-muted-foreground">—</TableCell>
                        <TableCell className="text-muted-foreground">—</TableCell>
                      </TableRow>,
                    ],
              )
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open && !submitting) setPending(null);
        }}
      >
        <DialogContent>
          {copy && pending ? (
            <>
              <DialogHeader>
                <DialogTitle>{copy.title}</DialogTitle>
                <DialogDescription>
                  {copy.description}
                  <br />
                  <span className="mt-2 block font-mono text-xs">
                    zone: {pending.zoneName} · session: {pending.sessionId}
                  </span>
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPending(null)} disabled={submitting}>
                  Cancel
                </Button>
                <Button
                  variant={pending.kind === "revoke" ? "destructive" : "default"}
                  onClick={onConfirm}
                  disabled={submitting}
                >
                  {submitting ? "Working…" : copy.confirmLabel}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
