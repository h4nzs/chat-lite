import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { FiLink, FiUserPlus, FiLock, FiTrash2, FiZap } from 'react-icons/fi';

interface BurnerFlowProps {
  step1Title: string;
  step1Desc: string;
  step2Title: string;
  step2Desc: string;
  step3Title: string;
  step3Desc: string;
  step4Title: string;
  step4Desc: string;
  note: string;
}

export default function BurnerFlow(props: BurnerFlowProps) {
  const { step1Title, step1Desc, step2Title, step2Desc, step3Title, step3Desc, step4Title, step4Desc, note } = props;
  const sectionRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sectionRef, { once: true, amount: 0.25 });
  const reduced =
    useReducedMotion() ||
    (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!inView) return;
    const t = setTimeout(() => setStarted(true), reduced ? 0 : 200);
    return () => clearTimeout(t);
  }, [inView, reduced]);

  const dur = (d: number) => (reduced ? 0 : d);

  const steps = [
    { icon: FiLink, title: step1Title, desc: step1Desc },
    { icon: FiUserPlus, title: step2Title, desc: step2Desc },
    { icon: FiLock, title: step3Title, desc: step3Desc },
    { icon: FiTrash2, title: step4Title, desc: step4Desc },
  ];

  return (
    <div ref={sectionRef} class="card-neumorphic relative overflow-hidden">
      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 14 }}
              animate={started ? { opacity: 1, y: 0 } : undefined}
              transition={{ delay: dur(0.3 + i * 0.4), duration: dur(0.5), ease: 'easeOut' }}
              class="relative flex flex-col items-center text-center p-4"
            >
              <span class="font-display font-black text-4xl text-accent/25 absolute -top-1 -right-1 select-none">{String(i + 1).padStart(2, '0')}</span>
              <div class={`icon-well w-14 h-14 mb-4 ${i === 3 ? 'text-red-500' : ''}`}><Icon size={24} /></div>
              <h4 class="font-display text-base font-bold text-text-primary mb-2 leading-tight">{step.title}</h4>
              <p class="text-xs text-text-secondary leading-relaxed">{step.desc}</p>
            </motion.div>
          );
        })}
      </div>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={started ? { opacity: 1, y: 0 } : undefined}
        transition={{ delay: dur(2.1), duration: dur(0.5) }}
        class="mt-6 pt-5 border-t border-text-secondary/10 text-center"
      >
        <p class="inline-flex items-center gap-2 text-sm font-bold text-accent">
          <FiZap size={15} className="flex-shrink-0" />
          {note}
        </p>
      </motion.div>
    </div>
  );
}
