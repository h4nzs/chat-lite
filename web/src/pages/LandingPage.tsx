import { Link } from 'react-router-dom';
import { FiGithub, FiLock, FiKey, FiSmartphone, FiSun, FiMoon, FiChevronsLeft, FiChevronsRight } from 'react-icons/fi';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';

const FeatureCard = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <div className="bg-bg-surface p-6 rounded-xl shadow-neumorphic-convex text-center transform hover:scale-105 transition-transform duration-300">
    <div className="inline-block p-4 bg-bg-main rounded-full shadow-neumorphic-concave mb-4">
      {icon}
    </div>
    <h3 className="text-xl font-bold text-text-primary mb-2">{title}</h3>
    <p className="text-text-secondary">{children}</p>
  </div>
);

const ThemeComparisonSlider = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const setInitialPosition = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        x.set(containerWidth / 2);
        setIsMounted(true); // Mark as mounted after initial position is set
      }
    };

    // Set initial position after a short delay to ensure layout is stable
    const timer = setTimeout(setInitialPosition, 100);

    const handleResize = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const currentX = x.get();
        // Keep the slider handle at the same relative position
        x.set(Math.max(0, Math.min(currentX, containerWidth)));
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [x]);

  const lightImageClipPath = useTransform(x, val => `inset(0 calc(100% - ${val}px) 0 0)`);

  return (
    <motion.div
      ref={containerRef}
      className="relative w-full max-w-4xl mx-auto rounded-xl shadow-2xl cursor-ew-resize select-none overflow-hidden"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      style={{ opacity: isMounted ? 1 : 0 }} // Hide until correctly positioned
    >
      {/* Dark mode image (bottom layer) */}
      <img src="/hero-dark.png" alt="Chat Lite dark mode" className="block w-full h-auto object-contain rounded-xl" />

      {/* Light mode image (top layer, clipped) */}
      <motion.div
        className="absolute inset-0 w-full h-full"
        style={{ clipPath: lightImageClipPath }}
      >
        <img src="/hero-light.png" alt="Chat Lite light mode" className="block w-full h-auto object-contain rounded-xl" />
      </motion.div>

      {/* Draggable Handle */}
      <motion.div
        drag="x"
        dragConstraints={containerRef}
        dragElastic={0.1}
        dragMomentum={false}
        style={{ x }}
        className="absolute top-0 bottom-0 w-1.5 bg-white/80 backdrop-blur-sm cursor-ew-resize flex items-center justify-center"
      >
        <div className="w-10 h-10 rounded-full bg-white/80 shadow-lg flex items-center justify-center text-gray-700">
          <FiChevronsLeft />
          <FiChevronsRight />
        </div>
      </motion.div>
    </motion.div>
  );
};


export default function LandingPage() {
  return (
    <div className="bg-bg-main min-h-screen font-sans text-text-primary overflow-y-auto">
      {/* Header */}
      <header className="p-4 flex justify-between items-center max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold">Chat Lite</h1>
        <Link to="/login" className="btn btn-secondary">
          Login
        </Link>
      </header>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-4 py-16 md:py-24 text-center">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4"
        >
          Private Conversations, <span className="text-accent">Secured by You.</span>
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-lg md:text-xl text-text-secondary max-w-3xl mx-auto mb-8"
        >
          An end-to-end encrypted chat application with a focus on privacy, user control, and a beautiful, modern interface.
        </motion.p>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex justify-center items-center gap-4"
        >
          <Link to="/register" className="btn btn-primary text-lg px-8 py-3">
            Get Started
          </Link>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="btn btn-secondary text-lg px-8 py-3">
            <FiGithub className="mr-2" />
            View on GitHub
          </a>
        </motion.div>

        <div className="mt-16 md:mt-24">
          <ThemeComparisonSlider />
        </div>
      </main>

      {/* Features Section */}
      <section className="py-16 md:py-24 bg-bg-surface">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Features Built for You</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard icon={<FiLock size={24} className="text-accent" />} title="End-to-End Encryption">
              Your messages are sealed. Only you and the recipient can read them, powered by the Double Ratchet algorithm.
            </FeatureCard>
            <FeatureCard icon={<FiKey size={24} className="text-accent" />} title="User-Controlled Keys">
              You own your keys. Restore your account on any device with your unique 24-word recovery phrase.
            </FeatureCard>
            <FeatureCard icon={<FiSmartphone size={24} className="text-accent" />} title="Seamless Device Linking">
              Securely link new devices using a simple QR code, without ever needing to re-enter your password.
            </FeatureCard>
            <FeatureCard icon={<div className="flex gap-2"><FiSun size={24} className="text-accent" /><FiMoon size={24} className="text-accent" /></div>} title="Modern, Themed UI">
              A beautiful, fully-themed interface with light and dark modes, built with a tactile Neumorphic design.
            </FeatureCard>
          </div>
        </div>
      </section>
      
      {/* More Visuals Section */}
      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-2 gap-8 items-center">
          <div className="text-center md:text-left">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Works Everywhere</h2>
            <p className="text-lg text-text-secondary">Enjoy a consistent experience whether you're on your desktop or on the go, with a fully responsive design that adapts to your screen.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <img src="/normal-desktop-dark.png" alt="Desktop view" className="rounded-lg shadow-xl transform rotate-3" />
            <img src="/mobile-light.png" alt="Mobile view" className="rounded-lg shadow-xl transform -rotate-3 translate-y-8" />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-bg-surface py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-text-secondary">
          <p>&copy; {new Date().getFullYear()} Chat Lite. Built with ❤️.</p>
        </div>
      </footer>
    </div>
  );
}
