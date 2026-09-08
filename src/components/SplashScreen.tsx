import { motion } from 'framer-motion';
import { asset } from '../lib/assets';

export function SplashScreen({ label = 'Открываем приложение…' }: { label?: string }) {
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
        src={asset('/final_big.webp')}
        alt="Showdown"
        className="relative z-10 object-contain w-3/4 max-w-[330px] h-auto -mt-28"
        initial={{ opacity: 0, scale: 0.75 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
        onError={(event) => {
          const image = event.currentTarget;
          const fallback = asset('/logo-final.png');
          if (image.src.endsWith(fallback) || image.src.includes('logo-final.png')) return;
          image.src = fallback;
        }}
      />

      <motion.p
        className="absolute bottom-[calc(env(safe-area-inset-bottom,0px)+3rem)] left-6 right-6 z-10 text-center text-[13px] font-600 text-[#231A16]/75"
        role="status"
        aria-live="polite"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.3 }}
      >
        {label}
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
