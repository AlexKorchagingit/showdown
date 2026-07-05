import { motion } from 'framer-motion';

export function SplashScreen() {
  return (
    <motion.div
      className="absolute inset-0 z-[200] flex flex-col items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, #8C4C27 0%, #D99962 35%, #F2D8A7 55%, #D99962 80%, #8C4C27 100%)',
        backgroundSize: '300% 300%',
        animation: 'splashGrad 2.5s ease infinite',
      }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Shimmer overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.18) 0%, transparent 65%)',
        }}
      />

      {/* Logo */}
      <motion.img
        src="/logo-final.svg"
        alt="Showdown"
        className="relative z-10 object-contain"
        style={{ width: 160, height: 160 }}
        initial={{ opacity: 0, scale: 0.75 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
      />

      {/* App name */}
      <motion.p
        className="relative z-10 mt-5 text-[22px] font-black uppercase tracking-[0.3em]"
        style={{ color: '#110b09' }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
      >
        Showdown
      </motion.p>

      <style>{`
        @keyframes splashGrad {
          0%, 100% { background-position: 0% 50%; }
          50%       { background-position: 100% 50%; }
        }
      `}</style>
    </motion.div>
  );
}
