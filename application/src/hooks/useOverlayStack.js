import { useEffect } from "react";

/**
 * A simple global stack to track open UI "surfaces" (dropdowns, modals, sidebars).
 * This ensures that the Escape key always closes the top-most layer first.
 */
let overlayStack = [];

const handleKeyDown = (e) => {
  if (e.key === "Escape" && overlayStack.length > 0) {
    const top = overlayStack[overlayStack.length - 1];
    if (top && typeof top.onBlur === "function") {
      e.stopPropagation();
      e.preventDefault();
      top.onBlur();
    }
  }
};

if (typeof window !== "undefined") {
  window.addEventListener("keydown", handleKeyDown, { capture: true });
}

export const useOverlayStack = (layerName, isOpen, onBlur) => {
  useEffect(() => {
    if (isOpen) {
      const entry = { name: layerName, onBlur };
      overlayStack.push(entry);
      return () => {
        overlayStack = overlayStack.filter((item) => item !== entry);
      };
    }
  }, [layerName, isOpen, onBlur]);

  const isTopLayer = overlayStack.length > 0 && overlayStack[overlayStack.length - 1].name === layerName;

  return { isTopLayer };
};
