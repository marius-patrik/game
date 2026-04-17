import { useEffect } from "react";

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

export function useChatToggle({
  enabled,
  onOpen,
  onClose,
  isOpen,
}: {
  enabled: boolean;
  onOpen: () => void;
  onClose: () => void;
  isOpen: boolean;
}) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "t" || e.key === "T") {
        if (isEditable(e.target)) return;
        if (isOpen) return;
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, onOpen, onClose, isOpen]);
}
