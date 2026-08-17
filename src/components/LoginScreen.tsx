import { useCallback, useEffect, useRef, useState } from 'react';
import emailjs from '@emailjs/browser';
import { motion, AnimatePresence } from 'framer-motion';
import { asset } from '../lib/assets';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAILJS_SERVICE  = 'service_hqlexio';
const EMAILJS_TEMPLATE = 'template_p9ku19k';
const EMAILJS_PUBLIC   = '8qsxWxs3kjE1X4ka6';

interface Props {
  onLogin: (email: string) => void;
}

type Step = 'email' | 'code';

const TEMP_AUTH_KEYS = [
  'temp_auth_email',
  'temp_auth_code',
  'temp_auth_step',
  'temp_auth_expire',
] as const;

function clearTempAuth() {
  TEMP_AUTH_KEYS.forEach((key) => localStorage.removeItem(key));
}

function saveTempAuth(targetEmail: string, code: string, timerSeconds: number) {
  localStorage.setItem('temp_auth_email', targetEmail.trim());
  localStorage.setItem('temp_auth_code', code);
  localStorage.setItem('temp_auth_step', 'code');
  localStorage.setItem('temp_auth_expire', (Date.now() + timerSeconds * 1000).toString());
}

export function LoginScreen({ onLogin }: Props) {
  const [step, setStep]                   = useState<Step>('email');
  const [email, setEmail]                 = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [isLoading, setIsLoading]         = useState(false);
  const [timer, setTimer]                 = useState(0);
  const [otp, setOtp]                     = useState(['', '', '', '']);
  const [otpError, setOtpError]           = useState(false);
  const [isSuccess, setIsSuccess]         = useState(false);

  const [isAgreed, setIsAgreed] = useState(false);
  const [isPolicyOpen, setIsPolicyOpen] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const verifiedRef = useRef(false);

  const isEmailValid = EMAIL_REGEX.test(email.trim());
  const canGetCode = isAgreed && isEmailValid && !isLoading;

  useEffect(() => {
    const savedStep = localStorage.getItem('temp_auth_step');
    if (savedStep !== 'code') return;

    setEmail(localStorage.getItem('temp_auth_email') || '');
    setGeneratedCode(localStorage.getItem('temp_auth_code') || '');
    setStep('code');

    const expireTime = Number(localStorage.getItem('temp_auth_expire') || 0);
    const timeLeft = Math.max(0, Math.floor((expireTime - Date.now()) / 1000));
    setTimer(timeLeft);
  }, []);

  const sendCode = useCallback(async (targetEmail: string, nextTimer: number) => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedCode(code);
    setIsLoading(true);

    try {
      await emailjs.send(
        EMAILJS_SERVICE,
        EMAILJS_TEMPLATE,
        { to_email: targetEmail.trim(), code },
        EMAILJS_PUBLIC,
      );
      saveTempAuth(targetEmail.trim(), code, nextTimer);
      setStep('code');
      setTimer(nextTimer);
      setOtp(['', '', '', '']);
      setOtpError(false);
      setIsSuccess(false);
      verifiedRef.current = false;
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err) {
      console.error(err);
      alert('Ошибка отправки. Проверьте почту.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleGetCode = () => {
    if (!canGetCode) return;
    sendCode(email, 60);
  };

  const handleResend = () => {
    if (timer > 0 || isLoading || isSuccess) return;
    sendCode(email, 15);
  };

  useEffect(() => {
    if (timer <= 0) return;
    const id = setInterval(() => setTimer((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [timer]);

  useEffect(() => {
    if (step !== 'code' || verifiedRef.current) return;

    const codeString = otp.join('');
    if (codeString.length < 4) return;

    if (codeString === generatedCode) {
      verifiedRef.current = true;
      setIsSuccess(true);
      const timer = setTimeout(() => {
        clearTempAuth();
        if (onLogin) onLogin(email.trim());
      }, 1000);
      return () => clearTimeout(timer);
    }

    setOtpError(true);
    setOtp(['', '', '', '']);
    inputRefs.current[0]?.focus();

    const id = setTimeout(() => setOtpError(false), 1000);
    return () => clearTimeout(id);
  }, [otp, generatedCode, step, email, onLogin]);

  const handleOtpChange = (index: number, value: string) => {
    if (isSuccess || !/^\d?$/.test(value)) return;

    const next = [...otp];
    next[index] = value;
    setOtp(next);

    if (value && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, key: string) => {
    if (isSuccess) return;
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const timerLabel = timer > 0
    ? `00:${String(timer).padStart(2, '0')}`
    : null;

  return (
    <div className="relative w-full h-screen overflow-hidden flex flex-col justify-center items-center">
      <div
        className="absolute inset-0 z-0 bg-gradient-to-br from-[#F2D8A7] via-[#f7e8c6] to-[#D99962] login-bg-pulse"
      />

      <div className="relative z-10 w-full max-w-sm px-6 flex flex-col items-center mb-20">
        <img src={asset("/logo-final.webp")} alt="Showdown" className="h-64 w-auto mb-8" />
        <h1 className="text-3xl font-black text-[#110b09] mb-8 uppercase tracking-wide">
          Вход
        </h1>

        <AnimatePresence mode="wait">
          {step === 'email' ? (
            <motion.div
              key="email-step"
              className="w-full"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@mail.com"
                autoComplete="email"
                className="bg-[#231A16] text-white border border-[#D99962]/30 rounded-xl px-4 py-3 w-full mb-3 outline-none focus:border-[#D99962]/60 transition-colors"
              />

              <label className="flex items-start gap-2.5 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAgreed}
                  onChange={(e) => setIsAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#D99962]/60 bg-[#231A16] accent-[#D99962] cursor-pointer"
                />
                <span className="text-xs text-[#8c8c88] leading-snug">
                  Я согласен на обработку персональных данных и принимаю{' '}
                  <span
                    role="link"
                    tabIndex={0}
                    className="text-[#D99962] underline cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsPolicyOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        setIsPolicyOpen(true);
                      }
                    }}
                  >
                    Политику конфиденциальности
                  </span>
                </span>
              </label>

              <button
                type="button"
                onClick={handleGetCode}
                disabled={!canGetCode}
                className={`w-full py-3.5 rounded-xl text-[15px] font-700 tracking-wide transition-all active:scale-[0.98] ${
                  canGetCode
                    ? 'text-[#0A0908]'
                    : 'opacity-50 cursor-not-allowed bg-[#463129] text-white/50'
                }`}
                style={
                  canGetCode
                    ? {
                        background: 'linear-gradient(to right, #8C4C27, #D99962)',
                        boxShadow: '0 0 16px rgba(217,153,98,0.28)',
                      }
                    : undefined
                }
              >
                {isLoading ? 'Отправка…' : 'Получить код'}
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="code-step"
              className="w-full flex flex-col items-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            >
              <p className="text-[13px] font-500 text-[#463129] mb-6 text-center">
                Код отправлен на<br />
                <span className="font-700 text-[#110b09]">{email}</span>
              </p>

              <div className="flex gap-3 mb-6">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    readOnly={isSuccess}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e.key)}
                    className={`w-14 h-14 rounded-xl text-2xl font-bold text-center outline-none bg-[#231A16] text-white transition-colors duration-300 ${
                      isSuccess
                        ? 'border-2 border-green-500'
                        : otpError
                          ? 'border-2 border-red-500 scale-100'
                          : 'border border-[#D99962]/50 focus:border-[#D99962]'
                    }`}
                    style={{ transitionDelay: isSuccess ? `${i * 150}ms` : '0ms' }}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={handleResend}
                disabled={timer > 0 || isLoading || isSuccess}
                className={`text-[13px] transition-colors ${
                  timer > 0 || isLoading || isSuccess
                    ? 'text-[#8c8c88] cursor-not-allowed'
                    : 'text-[#110b09] font-bold cursor-pointer active:opacity-70'
                }`}
              >
                Отправить код еще раз
                {timerLabel && (
                  <span className="ml-2 font-600">{timerLabel}</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  clearTempAuth();
                  setStep('email');
                  setOtp(['', '', '', '']);
                  setTimer(0);
                  setIsSuccess(false);
                  verifiedRef.current = false;
                }}
                disabled={isSuccess}
                className="mt-6 text-[12px] font-600 text-[#463129] active:opacity-60 disabled:opacity-40"
              >
                ← Изменить email
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {isPolicyOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 p-4 flex items-center justify-center">
          <div
            className="w-full max-w-md rounded-2xl p-5 border border-white/20"
            style={{
              background: 'rgba(35, 26, 22, 0.72)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
            }}
          >
            <h2 className="text-[16px] font-800 uppercase tracking-wide text-white mb-3">
              Политика конфиденциальности
            </h2>
            <div className="max-h-[60vh] overflow-y-auto text-sm text-[#8c8c88] space-y-3 pr-1">
              <p>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
                incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
                exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
              </p>
              <p>
                Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu
                fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in
                culpa qui officia deserunt mollit anim id est laborum.
              </p>
              <p>
                Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo
                minus id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis
                dolor repellendus. Temporibus autem quibusdam et aut officiis debitis aut rerum
                necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non
                recusandae.
              </p>
              <p>
                Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus
                maiores alias consequatur aut perferendis doloribus asperiores repellat. Настоящая
                заглушка описывает согласие на обработку персональных данных в соответствии с
                152-ФЗ.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsPolicyOpen(false)}
              className="mt-4 w-full py-3 rounded-xl text-[14px] font-700 text-[#0A0908]"
              style={{
                background: 'linear-gradient(to right, #8C4C27, #D99962)',
              }}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes loginBgPulse {
          0%, 100% { opacity: 0.88; }
          50%       { opacity: 1; }
        }
        .login-bg-pulse {
          animation: loginBgPulse 5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
