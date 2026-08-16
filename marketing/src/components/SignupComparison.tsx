import { motion } from 'framer-motion';
import { FiCheck, FiX, FiPhone, FiHash, FiKey, FiFileText } from 'react-icons/fi';

interface SignupComparisonProps {
  title: string;
  headline: string;
  subtitle: string;
  signalLabel: string;
  signal1: string;
  signal2: string;
  signal3: string;
  signalNote: string;
  nyxLabel: string;
  nyx1: string;
  nyx2: string;
  nyx3: string;
  nyxNote: string;
  nyxBadge: string;
}

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.22, delayChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' as const } },
};

export default function SignupComparison(props: SignupComparisonProps) {
  const { title, headline, subtitle, signalLabel, signal1, signal2, signal3, signalNote, nyxLabel, nyx1, nyx2, nyx3, nyxNote, nyxBadge } = props;

  const signalSteps = [
    { icon: <FiPhone size={18} />, label: signal1 },
    { icon: <FiKey size={18} />, label: signal2 },
    { icon: <FiFileText size={18} />, label: signal3 },
  ];

  const nyxSteps = [
    { icon: <FiHash size={18} />, label: nyx1 },
    { icon: <FiKey size={18} />, label: nyx2 },
    { icon: <FiFileText size={18} />, label: nyx3 },
  ];

  return (
    <section class="py-20 md:py-24 relative overflow-hidden">
      <div class="aurora-blob w-[500px] h-[500px] bottom-0 -right-40" style={{ background: 'radial-gradient(circle, hsl(var(--grad-end) / 0.14), transparent 60%)' }}></div>
      <div class="max-w-5xl mx-auto px-6 relative">
        <div class="text-center mb-14">
          <p class="font-sans text-xs font-bold uppercase tracking-[0.3em] text-accent mb-4">{title}</p>
          <h2 class="font-display font-bold text-4xl md:text-5xl leading-tight tracking-tight mb-6">{headline}</h2>
          <p class="text-lg text-text-secondary leading-relaxed max-w-2xl mx-auto">{subtitle}</p>
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          class="relative grid md:grid-cols-2 gap-6 md:gap-10 items-stretch"
        >
          {/* VS badge */}
          <div class="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
            <div class="icon-well w-14 h-14 rounded-full font-display font-bold text-lg" style={{ boxShadow: 'var(--shadow-neu-flat)' }}>VS</div>
          </div>

          {/* Signal column */}
          <motion.div variants={item} class="card-neumorphic relative overflow-hidden">
            <div class="flex items-center justify-between mb-6">
              <div class="flex items-center gap-3">
                <div class="icon-well w-12 h-12 text-red-400/70"><FiX size={22} /></div>
                <span class="font-sans text-sm font-black uppercase tracking-[0.25em] text-text-secondary">{signalLabel}</span>
              </div>
            </div>
            <div class="space-y-4">
              {signalSteps.map((step, i) => (
                <div key={i} class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full flex items-center justify-center bg-bg-main text-red-400 flex-shrink-0" style={{ boxShadow: 'var(--shadow-neu-pressed)' }}>
                    <FiX size={16} />
                  </div>
                  <span class="text-text-secondary line-through decoration-red-400/50">{step.label}</span>
                </div>
              ))}
            </div>
            <p class="mt-8 text-xs font-bold text-red-400/80 uppercase tracking-wider">{signalNote}</p>
          </motion.div>

          {/* NYX column */}
          <motion.div variants={item}>
            <div class="rounded-[1.7rem] p-[1.5px] h-full" style={{ background: 'linear-gradient(to right, hsl(var(--grad-start) / 0.55), hsl(var(--grad-end) / 0.55))' }}>
              <div class="card-neumorphic h-full relative">
                <div class="flex items-center justify-between mb-6">
                  <div class="flex items-center gap-3">
                    <div class="icon-well w-12 h-12"><FiCheck size={22} /></div>
                    <span class="font-sans text-sm font-black uppercase tracking-[0.25em] text-accent">{nyxLabel}</span>
                  </div>
                  <span class="px-3 py-1 rounded-full bg-bg-main text-accent text-[10px] font-black uppercase tracking-widest" style={{ boxShadow: 'var(--shadow-neu-icon)' }}>
                    {nyxBadge}
                  </span>
                </div>
                <div class="space-y-4">
                  {nyxSteps.map((step, i) => (
                    <div key={i} class="flex items-center gap-3">
                      <div class="w-8 h-8 rounded-full flex items-center justify-center bg-bg-main text-accent flex-shrink-0" style={{ boxShadow: 'var(--shadow-neu-pressed)' }}>
                        <FiCheck size={16} />
                      </div>
                      <span class="font-semibold">{step.label}</span>
                    </div>
                  ))}
                </div>
                <p class="mt-8 text-xs font-bold text-accent uppercase tracking-wider">{nyxNote}</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
