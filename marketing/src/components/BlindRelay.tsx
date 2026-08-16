import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { FiCheck, FiLock, FiZap, FiHelpCircle } from 'react-icons/fi';

interface BlindRelayProps {
  title: string;
  headline: string;
  subtitle: string;
  senderLabel: string;
  serverLabel: string;
  recipientLabel: string;
  fromUnknown: string;
  toLabel: string;
  serverNote: string;
  burnerNote: string;
}

const DESTINATIONS = ['4f8e…2a', '9c21…7b', 'e17d…c3'];
const PACKET_HEX = ['a3f1…c9', 'b77d…14', 'e02a…88'];
const ROW_TOPS = [18, 162, 306];

export default function BlindRelay(props: BlindRelayProps) {
  const { title, headline, subtitle, senderLabel, serverLabel, recipientLabel, fromUnknown, toLabel, serverNote, burnerNote } = props;
  const sectionRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sectionRef, { once: true, amount: 0.3 });
  const reduced =
    useReducedMotion() ||
    (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!inView) return;
    const t = setTimeout(() => setStarted(true), reduced ? 0 : 300);
    return () => clearTimeout(t);
  }, [inView, reduced]);

  const dur = (d: number) => (reduced ? 0 : d);
  const offset = (i: number) => (reduced ? 0 : i * 0.6);

  return (
    <section class="py-20 md:py-28 relative overflow-hidden">
      <div class="aurora-blob w-[480px] h-[480px] top-20 -right-40" style={{ background: 'radial-gradient(circle, hsl(var(--grad-start) / 0.12), transparent 60%)' }}></div>
      <div class="max-w-6xl mx-auto px-6 relative">
        <div class="text-center mb-14">
          <p class="font-sans text-xs font-bold uppercase tracking-[0.3em] text-accent mb-4">{title}</p>
          <h2 class="font-display font-bold text-4xl md:text-5xl leading-tight tracking-tight mb-6">{headline}</h2>
          <p class="text-lg text-text-secondary leading-relaxed max-w-2xl mx-auto">{subtitle}</p>
        </div>

        {/* ===== Animated blind-relay track (desktop) ===== */}
        <div ref={sectionRef} class="hidden lg:block relative h-[440px] mb-10">
          {/* Lane lines */}
          {ROW_TOPS.map((top, i) => (
            <div key={i} class="absolute h-0.5 border-t-2 border-dashed border-text-secondary/25" style={{ top: top + 42, left: '21%', right: '21%' }}></div>
          ))}

          {/* Sender cards */}
          {ROW_TOPS.map((top, i) => (
            <div key={`s${i}`} class="absolute left-0 w-[19%] text-center" style={{ top }}>
              <div class="icon-well w-11 h-11 mx-auto mb-2"><FiHelpCircle size={20} /></div>
              <p class="font-bold text-sm mb-1">{senderLabel} {i + 1}</p>
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={started ? { opacity: 1, y: 0 } : undefined}
                transition={{ delay: dur(offset(i) + 0.2), duration: dur(0.4) }}
                class="bg-bg-surface rounded-xl rounded-bl-sm p-2.5 text-xs leading-relaxed inline-block"
                style={{ boxShadow: 'var(--shadow-neu-icon)' }}
              >
                Hello 👋
              </motion.div>
            </div>
          ))}

          {/* Server console */}
          <div class="absolute left-[23%] right-[23%] top-[52px] card-neumorphic-flat p-5">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-3">
                <div class="icon-well w-10 h-10"><FiHelpCircle size={20} /></div>
                <div class="text-left">
                  <p class="font-bold text-sm leading-tight">{serverLabel}</p>
                  <p class="text-[11px] text-text-secondary font-mono">blind-relay · v1</p>
                </div>
              </div>
              <div class="icon-well w-9 h-9"><FiLock size={16} /></div>
            </div>
            <div class="space-y-2 font-mono text-xs">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={started ? { opacity: 1, x: 0 } : undefined}
                  transition={{ delay: dur(offset(i) + 1.4), duration: dur(0.35) }}
                  class="flex items-center gap-2 bg-bg-main rounded-lg px-3 py-2"
                  style={{ boxShadow: 'var(--shadow-neu-pressed)' }}
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-accent animate-pulse flex-shrink-0"></span>
                  <span class="text-text-secondary">{fromUnknown}</span>
                  <span class="text-accent flex-shrink-0">→</span>
                  <span class="text-text-secondary">{toLabel}</span>
                  <span class="text-text-primary font-bold">{DESTINATIONS[i]}</span>
                  <span class="ml-auto text-text-secondary/50">{PACKET_HEX[i]}</span>
                </motion.div>
              ))}
            </div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={started ? { opacity: 1 } : undefined}
              transition={{ delay: dur(offset(2) + 3.8), duration: dur(0.5) }}
              class="mt-4 flex items-center gap-2 text-[11px] font-bold text-accent"
            >
              <FiLock size={12} className="flex-shrink-0" />
              {serverNote}
            </motion.div>
          </div>

          {/* Recipient cards */}
          {ROW_TOPS.map((top, i) => (
            <div key={`r${i}`} class="absolute right-0 w-[19%] text-center" style={{ top }}>
              <div class="icon-well w-11 h-11 mx-auto mb-2"><FiCheck size={20} /></div>
              <p class="font-bold text-sm mb-1">{recipientLabel} {i + 1}</p>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={started ? { opacity: 1, scale: 1 } : undefined}
                transition={{ delay: dur(offset(i) + 2.6), duration: dur(0.4) }}
                class="bg-bg-surface rounded-xl rounded-br-sm p-2.5 text-xs leading-relaxed inline-block"
                style={{ boxShadow: 'var(--shadow-neu-icon)' }}
              >
                Hello 👋 <FiCheck className="inline text-accent ml-0.5" />
              </motion.div>
            </div>
          ))}

          {/* Traveling packets */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={`p${i}`}
              initial={{ left: '21%', opacity: 0 }}
              animate={
                started
                  ? reduced
                    ? { left: '78%', opacity: 1 }
                    : { left: ['21%', '21%', '50%', '50%', '78%'], opacity: [0, 1, 1, 1, 1] }
                  : { left: '21%', opacity: 0 }
              }
              transition={
                reduced
                  ? { duration: 0 }
                  : { duration: 3.4, times: [0, 0.12, 0.5, 0.72, 1], ease: 'easeInOut', delay: offset(i) }
              }
              class="absolute -translate-x-1/2 -translate-y-1/2 z-10"
              style={{ top: ROW_TOPS[i] + 42 }}
            >
              <div class="px-3 py-1.5 rounded-full bg-bg-surface text-[10px] font-mono font-bold flex items-center gap-1.5 whitespace-nowrap" style={{ boxShadow: 'var(--shadow-neu-flat)' }}>
                <FiLock size={10} className="text-accent" />
                <span class="text-text-secondary">{PACKET_HEX[i]}</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ===== Mobile fallback (static, elegant) ===== */}
        <div class="lg:hidden space-y-5 mb-10">
          <div class="card-neumorphic-flat p-5">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-3">
                <div class="icon-well w-10 h-10"><FiHelpCircle size={20} /></div>
                <div>
                  <p class="font-bold text-sm leading-tight">{serverLabel}</p>
                  <p class="text-[11px] text-text-secondary font-mono">blind-relay · v1</p>
                </div>
              </div>
              <div class="icon-well w-9 h-9"><FiLock size={16} /></div>
            </div>
            <div class="space-y-2 font-mono text-xs">
              {[0, 1, 2].map((i) => (
                <div key={i} class="flex items-center gap-2 bg-bg-main rounded-lg px-3 py-2" style={{ boxShadow: 'var(--shadow-neu-pressed)' }}>
                  <span class="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0"></span>
                  <span class="text-text-secondary">{fromUnknown}</span>
                  <span class="text-accent flex-shrink-0">→</span>
                  <span class="text-text-secondary">{toLabel}</span>
                  <span class="text-text-primary font-bold">{DESTINATIONS[i]}</span>
                </div>
              ))}
            </div>
            <p class="mt-4 flex items-center gap-2 text-[11px] font-bold text-accent">
              <FiLock size={12} className="flex-shrink-0" />
              {serverNote}
            </p>
          </div>
          <p class="text-sm text-text-secondary text-center">{senderLabel} 1–3 → {recipientLabel} 1–3</p>
        </div>

        {/* Burner footnote */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={started ? { opacity: 1, y: 0 } : undefined}
          transition={{ delay: dur(offset(2) + 4.3), duration: dur(0.5) }}
          class="flex justify-center"
        >
          <div class="card-neumorphic-flat px-5 py-2.5 rounded-full flex items-center gap-2 text-sm font-bold">
            <FiZap className="text-accent flex-shrink-0" size={16} />
            {burnerNote}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
