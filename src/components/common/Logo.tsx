import { motion } from 'framer-motion';

export function Logo({ size = 28, animate = false }: { size?: number; animate?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" fill="none" aria-label="NOTHING logo" role="img">
      <motion.circle cx="64" cy="64" r="40" stroke="rgb(var(--accent))" strokeWidth="7"
        initial={animate ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: 'easeInOut' }} />
      <motion.line x1="38" y1="90" x2="90" y2="38" stroke="rgb(var(--fg))" strokeWidth="7" strokeLinecap="round"
        initial={animate ? { pathLength: 0 } : false} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: animate ? 0.9 : 0 }} />
    </svg>
  );
}
