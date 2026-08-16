import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';

interface StatItem {
  label: string;
  value: string;
}

interface StatStripProps {
  title: string;
  headline: string;
  items: StatItem[];
}

function CountUp({ value, started }: { value: string; started: boolean }) {
  const match = value.match(/^(\d+)(.*)$/);
  if (!match) return <>{value}</>;
  const target = Number(match[1]);
  const suffix = match[2];
  const [display, setDisplay] = useState(started ? target : 0);

  useEffect(() => {
    if (!started) return;
    if (target === 0) {
      setDisplay(0);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const duration = 1400;
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, target]);

  return (
    <>{display}{suffix}</>
  );
}

export default function StatStrip({ title, headline, items }: StatStripProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sectionRef, { once: true, amount: 0.4 });
  const reduced =
    useReducedMotion() ||
    (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!inView) return;
    const t = setTimeout(() => setStarted(true), reduced ? 0 : 150);
    return () => clearTimeout(t);
  }, [inView, reduced]);

  return (
    <section class="py-16 md:py-20">
      <div class="max-w-5xl mx-auto px-6">
        <div class="text-center mb-12">
          <p class="font-sans text-xs font-bold uppercase tracking-[0.3em] text-accent mb-4">{title}</p>
          <h2 class="font-display font-bold text-3xl md:text-4xl leading-tight tracking-tight">{headline}</h2>
        </div>
        <div ref={sectionRef} class="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {items.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={started ? { opacity: 1, y: 0 } : undefined}
              transition={{ delay: reduced ? 0 : i * 0.12, duration: 0.5, ease: 'easeOut' }}
              class="card-neumorphic text-center p-6"
            >
              <p class="font-display font-black text-5xl md:text-6xl text-gradient-aurora mb-2 tabular-nums">
                <CountUp value={stat.value} started={started} />
              </p>
              <p class="text-sm text-text-secondary font-semibold leading-snug">{stat.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
