import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { FiCheck, FiLock, FiSend, FiDownload } from 'react-icons/fi';

interface EncryptedFlowProps {
  title: string;
  headline: string;
  subtitle: string;
  sender: string;
  server: string;
  recipient: string;
  step1: string;
  step2: string;
  step3: string;
  proof1: string;
  proof2: string;
  proof3: string;
}

const CIPHERTEXT = '⚿ 8d2f…a1e4';

export default function EncryptedFlow(props: EncryptedFlowProps) {
  const { title, headline, subtitle, sender, server, recipient, step1, step2, step3, proof1, proof2, proof3 } = props;
  const sectionRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sectionRef, { once: true, amount: 0.35 });
  const reduced =
    useReducedMotion() ||
    (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [started, setStarted] = useState(false);
  const [bubbleState, setBubbleState] = useState<'plain' | 'cipher' | 'arrived'>('plain');

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setStarted(true);
      setBubbleState('arrived');
      return;
    }
    const t = setTimeout(() => setStarted(true), 300);
    return () => clearTimeout(t);
  }, [inView, reduced]);

  useEffect(() => {
    if (!started || reduced) return;
    const timers = [
      setTimeout(() => setBubbleState('cipher'), 900),
      setTimeout(() => setBubbleState('arrived'), 2400),
    ];
    return () => timers.forEach(clearTimeout);
  }, [started, reduced]);

  const captionDelay = (i: number) => (reduced ? 0 : 0.9 + i * 0.45);
  const dur = (d: number) => (reduced ? 0 : d);

  return (
    <section class="py-20 md:py-28 relative overflow-hidden">
      <div class="aurora-blob w-[480px] h-[480px] top-10 -left-40" style={{ background: 'radial-gradient(circle, hsl(var(--grad-start) / 0.14), transparent 60%)' }}></div>
      <div class="max-w-5xl mx-auto px-6 relative">
        <div class="text-center mb-14">
          <p class="font-sans text-xs font-bold uppercase tracking-[0.3em] text-accent mb-4">{title}</p>
          <h2 class="font-display font-bold text-4xl md:text-5xl leading-tight tracking-tight mb-6">{headline}</h2>
          <p class="text-lg text-text-secondary leading-relaxed max-w-2xl mx-auto">{subtitle}</p>
        </div>

        {/* ===== Animated track (desktop) ===== */}
        <div ref={sectionRef} class="hidden lg:block relative h-[340px] mb-10">
          {/* Connector line */}
          <div class="absolute top-[84px] left-[10%] right-[10%] h-0.5 border-t-2 border-dashed border-text-secondary/25"></div>

          {/* Sender node */}
          <div class="absolute left-0 top-0 w-[22%] text-center">
            <div class="icon-well w-16 h-16 mx-auto mb-3"><FiSend size={26} /></div>
            <p class="font-bold text-sm mb-1">{sender}</p>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={started ? { opacity: 1, y: 0 } : undefined}
              transition={{ delay: dur(0.4), duration: dur(0.5) }}
              class="mt-3 bg-bg-surface rounded-2xl rounded-bl-sm p-3 text-sm leading-relaxed inline-block"
              style={{ boxShadow: 'var(--shadow-neu-icon)' }}
            >
              Hello 👋
            </motion.div>
          </div>

          {/* Server node */}
          <div class="absolute left-1/2 -translate-x-1/2 top-0 w-[24%] text-center">
            <div class="icon-well w-16 h-16 mx-auto mb-3"><FiLock size={26} /></div>
            <p class="font-bold text-sm mb-1">{server}</p>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={started ? { opacity: 1, y: 0 } : undefined}
              transition={{ delay: dur(1.5), duration: dur(0.5) }}
              class="mt-3 bg-bg-surface rounded-2xl p-3 text-sm font-mono text-text-secondary inline-block"
              style={{ boxShadow: 'var(--shadow-neu-pressed)' }}
            >
              {CIPHERTEXT}
            </motion.div>
          </div>

          {/* Recipient node */}
          <div class="absolute right-0 top-0 w-[22%] text-center">
            <div class="icon-well w-16 h-16 mx-auto mb-3"><FiDownload size={26} /></div>
            <p class="font-bold text-sm mb-1">{recipient}</p>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={started && bubbleState === 'arrived' ? { opacity: 1, scale: 1 } : undefined}
              transition={{ duration: dur(0.45) }}
              class="mt-3 bg-bg-surface rounded-2xl rounded-br-sm p-3 text-sm leading-relaxed inline-block"
              style={{ boxShadow: 'var(--shadow-neu-icon)' }}
            >
              Hello 👋 <FiCheck className="inline text-accent ml-1" />
            </motion.div>
          </div>

          {/* Traveling bubble */}
          <motion.div
            initial={{ left: '4%', opacity: 0 }}
            animate={
              started
                ? reduced
                  ? { left: '86%', opacity: 1 }
                  : { left: ['4%', '4%', '44%', '44%', '86%'], opacity: [0, 1, 1, 1, 1] }
                : { left: '4%', opacity: 0 }
            }
            transition={reduced ? { duration: 0 } : { duration: 3.2, times: [0, 0.1, 0.55, 0.75, 1], ease: 'easeInOut' }}
            class="absolute top-[84px] -translate-y-1/2 -translate-x-1/2 z-10"
          >
            <div class="px-4 py-2 rounded-full bg-bg-surface text-xs font-bold flex items-center gap-2 whitespace-nowrap" style={{ boxShadow: 'var(--shadow-neu-flat)' }}>
              {bubbleState === 'plain' && <>Hello 👋</>}
              {bubbleState === 'cipher' && <span class="font-mono text-accent">{CIPHERTEXT}</span>}
              {bubbleState === 'arrived' && <>Hello 👋 <FiCheck class="text-accent" /></>}
            </div>
          </motion.div>

          {/* Step captions */}
          <div class="absolute bottom-0 left-0 w-[22%] text-center">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={started ? { opacity: 1, y: 0 } : undefined}
              transition={{ delay: captionDelay(0), duration: dur(0.5) }}
              class="text-sm text-text-secondary leading-relaxed"
            >{step1}</motion.p>
          </div>
          <div class="absolute bottom-0 left-1/2 -translate-x-1/2 w-[24%] text-center">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={started ? { opacity: 1, y: 0 } : undefined}
              transition={{ delay: captionDelay(1), duration: dur(0.5) }}
              class="text-sm text-text-secondary leading-relaxed"
            >{step2}</motion.p>
          </div>
          <div class="absolute bottom-0 right-0 w-[22%] text-center">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={started ? { opacity: 1, y: 0 } : undefined}
              transition={{ delay: captionDelay(2), duration: dur(0.5) }}
              class="text-sm text-text-secondary leading-relaxed"
            >{step3}</motion.p>
          </div>
        </div>

        {/* ===== Mobile fallback (static, elegant) ===== */}
        <div class="lg:hidden space-y-5 mb-10">
          {[
            { icon: <FiSend size={20} />, label: sender, caption: step1, cipher: false },
            { icon: <FiLock size={20} />, label: server, caption: step2, cipher: true },
            { icon: <FiDownload size={20} />, label: recipient, caption: step3, cipher: false },
          ].map((node) => (
            <div class="card-neumorphic-flat flex items-start gap-4 p-5">
              <div class="icon-well w-12 h-12 flex-shrink-0">{node.icon}</div>
              <div>
                <p class="font-bold text-sm mb-0.5">{node.label}</p>
                {node.cipher && <p class="font-mono text-xs text-accent mb-1">{CIPHERTEXT}</p>}
                <p class="text-sm text-text-secondary leading-relaxed">{node.caption}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Proof chips */}
        <div class="flex flex-wrap justify-center gap-3">
          {[proof1, proof2, proof3].map((chip, i) => (
            <motion.div
              key={chip}
              initial={{ opacity: 0, y: 8 }}
              animate={started ? { opacity: 1, y: 0 } : undefined}
              transition={{ delay: reduced ? 0 : 2.4 + i * 0.25, duration: dur(0.5) }}
              class="card-neumorphic-flat px-5 py-2.5 rounded-full flex items-center gap-2 text-sm font-bold"
            >
              <FiCheck className="text-accent flex-shrink-0" size={16} />
              {chip}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
