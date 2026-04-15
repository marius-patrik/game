import { Redirect } from "wouter";
import { useSession } from "./client";

type Role = "admin" | "player";

export function RequireRole({ allow, children }: { allow: Role; children: React.ReactNode }) {
  const { data, isPending } = useSession();
  if (isPending) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">…</div>;
  }
  if (!data) return <Redirect to="/" />;
  const userRole = ((data.user as { role?: string }).role ?? "player") as Role;
  if (userRole !== allow) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold">not authorized</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            your account does not have permission to view this page.
          </p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
