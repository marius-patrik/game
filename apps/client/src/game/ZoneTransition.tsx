import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * Full-screen fade-to-black on zone swap. Takes the current connection status
 * and shows a ~350ms fade while the room teardown + rejoin happens. The
 * actual zone swap is orchestrated server-side via the zone-exit message +
 * the useRoom reconnect; this component is pure visual polish.
 */
export function ZoneTransition({
  status,
}: {
  status: "idle" | "connecting" | "connected" | "error";
}) {
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
