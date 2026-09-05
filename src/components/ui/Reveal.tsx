import React, { useRef } from "react";
import { motion, useInView } from "motion/react";
import { usePrefersReducedMotion } from "../../hooks/usePrefersReducedMotion";

interface RevealProps {
  children: React.ReactNode;
  /** Seconds of delay, for staggering siblings. */
  delay?: number;
  /** Distance travelled on entry, in pixels. */
  distance?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article" | "header";
}

/**
 * Scroll-triggered entrance. Motion handles the reveal work across the page so
 * anime.js is reserved for the line-drawing set pieces.
 */
export const Reveal: React.FC<RevealProps> = ({
  children,
  delay = 0,
  distance = 22,
  className,
  as = "div",
}) => {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-12% 0px -12% 0px" });
  const reduced = usePrefersReducedMotion();
  const motionTags = {
    div: motion.div,
    section: motion.section,
    li: motion.li,
    article: motion.article,
    header: motion.header,
  } as const;
  const Tag = motionTags[as];

  if (reduced) {
    const Plain = as as React.ElementType;
    return <Plain className={className}>{children}</Plain>;
  }

  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement>}
      className={className}
      initial={{ opacity: 0, y: distance }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: distance }}
      transition={{ duration: 0.72, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </Tag>
  );
};
