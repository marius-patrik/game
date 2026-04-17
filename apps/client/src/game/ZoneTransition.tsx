import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { PortalTransition } from "./cinematics";

type Status = "idle" | "connecting" | "connected" | "error";

/**
 * Full-screen zone-swap overlay. Renders the cinematic portal transition by
 * default and falls back to the original 350ms fade when the user has opted
 * out via Settings → Skip cinematics.
 */
export function ZoneTransition({
  status,
  zoneId,
  skipCinematics,
}: {
  status: Status;
  zoneId: string;
  skipCinematics: boolean;
}) {
  if (skipCinematics) return <PlainFade status={status} />;
  return <PortalTransition status={status} zoneId={zoneId} />;
}

function PlainFade({ status }: { status: Status }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status === "connecting" || status === "idle") {
      setVisible(true);
    } else {
      const t = setTimeout(() => setVisible(false), 180);
      return () => clearTimeout(t);
    }
  }, [status]);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="zone-fade"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: "easeInOut" }}
          className="pointer-events-none absolute inset-0 z-40 bg-background"
        />
      ) : null}
    </AnimatePresence>
  );
}
