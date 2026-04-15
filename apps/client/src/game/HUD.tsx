import { motion } from "framer-motion";
import { Gamepad2, Shield } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/theme/theme-toggle";

export function HUD() {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-4"
      >
        <div className="pointer-events-auto rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-xs backdrop-blur-md">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Gamepad2 className="size-3.5" />
            <span>game · dev</span>
          </div>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <ThemeToggle />
          <Link href="/admin">
            <Button variant="outline" size="sm" className="backdrop-blur-md bg-background/40">
              <Shield />
              admin
            </Button>
          </Link>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.4 }}
        className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-4"
      >
        <div className="rounded-full border border-border/50 bg-background/40 px-4 py-1.5 text-xs text-muted-foreground backdrop-blur-md">
          drag to orbit · scroll to zoom
        </div>
      </motion.div>
    </>
  );
}
