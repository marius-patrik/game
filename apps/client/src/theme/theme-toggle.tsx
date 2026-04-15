import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Monitor, Moon, Sun } from "lucide-react";
import { type Theme, useTheme } from "./theme-provider";

const order: Theme[] = ["system", "light", "dark"];
const icons: Record<Theme, typeof Sun> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const Icon = icons[theme];
  const cycle = () => {
    const i = order.indexOf(theme);
    setTheme(order[(i + 1) % order.length] ?? "system");
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={cycle}
      aria-label={`theme: ${theme}`}
      title={`theme: ${theme}`}
      className={cn("backdrop-blur-md bg-background/40 relative overflow-hidden", className)}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ y: -12, opacity: 0, rotate: -30 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: 12, opacity: 0, rotate: 30 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="absolute inset-0 grid place-items-center"
        >
          <Icon className="size-4" />
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}
