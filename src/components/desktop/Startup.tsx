import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Logo } from '../common/Logo';

export function Startup({ onDone }: { onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 2600); return () => clearTimeout(t); }, [onDone]);
  return (
    <motion.div className="fixed inset-0 z-[3000] grid cursor-pointer place-items-center bg-bg" exit={{ opacity: 0 }} transition={{ duration: 0.4 }} onClick={onDone}>
      <div className="flex flex-col items-center gap-7">
        <Logo size={96} animate />
        <motion.div initial={{ opacity: 0, letterSpacing: '0.1em' }} animate={{ opacity: 1, letterSpacing: '0.55em' }} transition={{ delay: 1.1, duration: 1.2 }} className="pl-[0.55em] text-2xl font-light">NOTHING</motion.div>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.7 }} className="font-mono text-[11px] tracking-[0.3em] text-muted">INTELLIGENCE WITHOUT THE CLOUD.</motion.p>
      </div>
      <span className="absolute bottom-6 text-[11px] text-muted">MUdevelops · click to skip</span>
    </motion.div>
  );
}
