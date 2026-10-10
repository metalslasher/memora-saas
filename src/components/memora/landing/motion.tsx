"use client";

import type * as React from "react";
import { useEffect, useRef, useState } from "react";

/** True once the element has scrolled into view (never flips back). */
export function useInView<T extends Element>(
  options: IntersectionObserverInit = { threshold: 0.2 },
) {
  const ref = useRef<T | null>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || isInView) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setIsInView(true);
        observer.disconnect();
      }
    }, options);

    observer.observe(element);
    return () => observer.disconnect();
    // Options are static per call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInView]);

  return { ref, isInView };
}

export function Reveal({
  as: Tag = "div",
  children,
  className = "",
  delay = 0,
}: {
  as?: "div" | "section" | "article" | "li";
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, isInView } = useInView<HTMLDivElement>({
    threshold: 0.15,
    rootMargin: "0px 0px -8% 0px",
  });

  return (
    <Tag
      ref={ref as React.Ref<never>}
      className={`reveal ${isInView ? "is-visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}

/** 0..1 progress of an element travelling through the viewport. */
export function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;

    function update() {
      frame = 0;
      const element = ref.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const total = rect.height + window.innerHeight * 0.4;
      const passed = window.innerHeight * 0.8 - rect.top;
      setProgress(Math.min(1, Math.max(0, passed / total)));
    }

    function onScroll() {
      if (!frame) frame = window.requestAnimationFrame(update);
    }

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return { ref, progress };
}

/** Cycles through `count` indexes every `interval` ms. */
export function useCycle(count: number, interval: number, isActive = true) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!isActive || count <= 1) return;
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % count),
      interval,
    );
    return () => window.clearInterval(timer);
  }, [count, interval, isActive]);

  return index;
}
