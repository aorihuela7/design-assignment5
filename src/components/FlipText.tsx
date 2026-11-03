"use client";

import { useLayoutEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/motion";

// A value on a departures board: when it changes, it flips over once like a split-flap
// display, 200 ms, and not at all with reduced motion. Not when it first appears, so a
// board that loads doesn't flap all at once. The text itself is read as it is.
export function FlipText({ text }: { text: string }) {
  const element = useRef<HTMLSpanElement>(null);
  const shown = useRef(text);
  useLayoutEffect(() => {
    if (shown.current === text) return;
    shown.current = text;
    if (prefersReducedMotion() || !element.current) return;
    element.current.animate([{ transform: "perspective(12em) rotateX(-90deg)", opacity: 0 }, {}], {
      duration: 200,
      easing: "ease-out",
    });
  }, [text]);
  return (
    <span ref={element} className="inline-block">
      {text}
    </span>
  );
}
