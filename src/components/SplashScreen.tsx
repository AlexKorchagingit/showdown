import { motion } from 'framer-motion';

export function SplashScreen() {
  return (
    <motion.div
      className="absolute inset-0 z-[200] flex items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, #8C4C27 0%, #D99962 35%, #F2D8A7 55%, #D99962 80%, #8C4C27 100%)',
        backgroundSize: '300% 300%',
        animation: 'splashGrad 2.5s ease infinite',
      }}
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.18) 0%, transparent 65%)',
        }}
      />

      <motion.img
        src="/final-logo_big-v3.svg"
        alt="Showdown"
        className="relative z-10 object-contain w-3/4 max-w-[330px] h-auto -mt-28"
        initial={{ opacity: 0, scale: 0.75 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
      />

      <style>{`
        @keyframes splashGrad {
          0%, 100% { background-position: 0% 50%; }
          50%       { background-position: 100% 50%; }
        }
      `}</style>
    </motion.div>
  );
}
