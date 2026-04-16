import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Monitor, Moon, Sun } from "lucide-react";
import { type Theme, useTheme } from "./theme-provider";

const icons: Record<Theme, typeof Sun> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

const labels: Record<Theme, string> = {
  system: "system",
  light: "light",
  dark: "dark",
};

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const Icon = icons[theme];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
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
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[8rem]">
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)}>
          {(Object.keys(labels) as Theme[]).map((t) => {
            const ItemIcon = icons[t];
            return (
              <DropdownMenuRadioItem key={t} value={t} className="gap-2">
                <ItemIcon className="size-4" />
                {labels[t]}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
