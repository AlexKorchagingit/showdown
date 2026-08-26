import { useCallback, useEffect, useRef, useState, type ClipboardEvent } from 'react';
import emailjs from '@emailjs/browser';
import { motion, AnimatePresence } from 'framer-motion';
import { CONSENT_DOCUMENTS, consentClubDocument, type ClubLegalDocument, type ConsentLink } from '../data/legalDocuments';
import { loginOrRegisterUser } from '../lib/loginAccount';
import { LegalImageModal } from './LegalImageModal';
import { BrandLogo } from './BrandLogo';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAILJS_SERVICE  = 'service_hqlexio';
const EMAILJS_TEMPLATE = 'template_p9ku19k';
const EMAILJS_PUBLIC   = '8qsxWxs3kjE1X4ka6';
const AGREEMENTS_KEY = 'temp_auth_agreements_at';
const CONSENT_TEXT =
  'Продолжая регистрацию, вы даете согласие на обработку персональных данных, получение информационных рассылок и использование локального хранилища.';

interface Props {
  onLogin: (email: string) => void;
}

type Step = 'consent' | 'email' | 'code';

const TEMP_AUTH_KEYS = [
  'temp_auth_email',
  'temp_auth_code',
  'temp_auth_step',
  'temp_auth_expire',
] as const;

function readTempAuthValue(key: string): string {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function readTempAuthStep(): string | null {
  const step = readTempAuthValue('temp_auth_step');
  return step || null;
}

function readAgreementsAt(): string {
  try {
    return localStorage.getItem(AGREEMENTS_KEY) ?? '';
  } catch {
    return '';
  }
}

function writeAgreementsAt(iso: string) {
  try {
    localStorage.setItem(AGREEMENTS_KEY, iso);
  } catch {
    /* ignore quota */
  }
}

function clearAgreementsAt() {
  try {
    localStorage.removeItem(AGREEMENTS_KEY);
  } catch {
    /* ignore */
  }
}

function clearTempAuth() {
  TEMP_AUTH_KEYS.forEach((key) => localStorage.removeItem(key));
}

function saveTempAuth(targetEmail: string, code: string, timerSeconds: number) {
  localStorage.setItem('temp_auth_email', targetEmail.trim().toLowerCase());
  localStorage.setItem('temp_auth_code', code);
  localStorage.setItem('temp_auth_step', 'code');
  localStorage.setItem('temp_auth_expire', (Date.now() + timerSeconds * 1000).toString());
}

async function completeLogin(email: string, agreementsAcceptedAt: string, onLogin: (email: string) => void) {
  try {
    const normalized = (email || readTempAuthValue('temp_auth_email')).trim().toLowerCase();
    if (!normalized) throw new Error('Не найден email для входа. Запросите код ещё раз.');
    const acceptedAt = agreementsAcceptedAt || readAgreementsAt() || new Date().toISOString();

    let user: Awaited<ReturnType<typeof loginOrRegisterUser>>['user'];
    let isNew = false;
    try {
      const result = await loginOrRegisterUser(normalized, acceptedAt);
      user = result.user;
      isNew = result.isNew;
    } catch (error) {
      console.error('LOGIN FATAL ERROR:', error);
      throw error;
    }

    if (isNew) {
      void import('../lib/logApi')
        .then(({ addLog }) =>
          addLog({
            admin_id: user.id,
            admin_email: normalized,
            admin_name: user.nickname,
            action_type: 'Согласия приняты (электронная подпись)',
            target_user_id: user.id,
            target_user_email: normalized,
            target_user_name: user.nickname,
            details: `Политики приняты: обработка ПДн, информационные рассылки, локальное хранилище. ISO: ${user.agreementsAcceptedAt ?? acceptedAt}`,
          }),
        )
        .catch((error) => {
          console.error('LOGIN FATAL ERROR:', error);
        });
    }

    clearTempAuth();
    clearAgreementsAt();
    onLogin(user.email);
  } catch (error) {
    console.error('LOGIN FATAL ERROR:', error);
    throw error;
  }
}

function ConsentCopy({ onOpen }: { onOpen: (document: ClubLegalDocument) => void }) {
  const nodes: Array<string | ConsentLink> = [];
  let cursor = 0;

  for (const link of CONSENT_DOCUMENTS) {
    const index = CONSENT_TEXT.indexOf(link.phrase, cursor);
    if (index === -1) continue;
    if (index > cursor) nodes.push(CONSENT_TEXT.slice(cursor, index));
    nodes.push(link);
    cursor = index + link.phrase.length;
  }
  if (cursor < CONSENT_TEXT.length) nodes.push(CONSENT_TEXT.slice(cursor));

  return (
    <p className="text-[13px] leading-relaxed text-[#F4E4BC]/90">
      {nodes.map((node, index) =>
        typeof node === 'string' ? (
          <span key={`t-${index}`}>{node}</span>
        ) : (
          <button
            key={node.id}
            type="button"
            onClick={() => onOpen(consentClubDocument(node))}
            className="inline font-semibold text-[#E8C547] underline decoration-[#E8C547]/70 underline-offset-2"
          >
            {node.phrase}
          </button>
        ),
      )}
    </p>
  );
}

export function LoginScreen({ onLogin }: Props) {
  const restoredAgreements = readAgreementsAt();
  const restoredStep = readTempAuthStep();

  const [step, setStep] = useState<Step>(() => {
    if (restoredStep === 'code') return 'code';
    if (restoredAgreements) return 'email';
    return 'consent';
  });
  const [email, setEmail] = useState(() => readTempAuthValue('temp_auth_email'));
  const [generatedCode, setGeneratedCode] = useState(() => readTempAuthValue('temp_auth_code'));
  const [isLoading, setIsLoading]         = useState(false);
  const [timer, setTimer]                 = useState(0);
  const [otp, setOtp]                     = useState(['', '', '', '']);
  const [otpError, setOtpError]           = useState(false);
  const [isSuccess, setIsSuccess]         = useState(false);
  const [loginError, setLoginError]       = useState('');
  const [agreementsAcceptedAt, setAgreementsAcceptedAt] = useState(restoredAgreements);
  const [activeDocument, setActiveDocument] = useState<ClubLegalDocument | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const verifiedRef = useRef(false);
  const onLoginRef = useRef(onLogin);
  onLoginRef.current = onLogin;

  const isEmailValid = EMAIL_REGEX.test(email.trim());
  const canGetCode = Boolean(agreementsAcceptedAt) && isEmailValid && !isLoading;

  useEffect(() => {
    if (readTempAuthValue('temp_auth_step') !== 'code') return;

    setEmail(readTempAuthValue('temp_auth_email'));
    setGeneratedCode(readTempAuthValue('temp_auth_code'));
    setStep('code');
    setAgreementsAcceptedAt((current) => current || readAgreementsAt());

    const expireTime = Number(readTempAuthValue('temp_auth_expire') || 0);
    const timeLeft = Math.max(0, Math.floor((expireTime - Date.now()) / 1000));
    setTimer(timeLeft);
  }, []);

  const sendCode = useCallback(async (targetEmail: string, nextTimer: number) => {
    const normalizedEmail = targetEmail.trim().toLowerCase();
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    setEmail(normalizedEmail);
    setGeneratedCode(code);
    setIsLoading(true);
    setLoginError('');

    try {
      await emailjs.send(
        EMAILJS_SERVICE,
        EMAILJS_TEMPLATE,
        { to_email: normalizedEmail, code },
        EMAILJS_PUBLIC,
      );
      saveTempAuth(normalizedEmail, code, nextTimer);
      setStep('code');
      setTimer(nextTimer);
      setOtp(['', '', '', '']);
      setOtpError(false);
      setIsSuccess(false);
      verifiedRef.current = false;
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err) {
      console.error(err);
      setLoginError('Не удалось отправить код. Проверьте почту и попробуйте ещё раз.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleAcceptAll = () => {
    const timestamp = new Date().toISOString();
    setAgreementsAcceptedAt(timestamp);
    writeAgreementsAt(timestamp);
    setStep('email');
  };

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
    const id = window.setInterval(() => setTimer((t) => t - 1), 1000);
    return () => window.clearInterval(id);
  }, [timer]);

  useEffect(() => {
    if (step !== 'code' || verifiedRef.current || isSuccess) return;

    const codeString = otp.join('');
    if (codeString.length < 4) return;

    const expected = (generatedCode || readTempAuthValue('temp_auth_code')).trim();
    if (!expected) return;
    if (codeString !== expected) {
      setOtpError(true);
      setOtp(['', '', '', '']);
      inputRefs.current[0]?.focus();
      const id = window.setTimeout(() => setOtpError(false), 1000);
      return () => window.clearTimeout(id);
    }

    verifiedRef.current = true;
    setIsSuccess(true);
    setLoginError('');
    void completeLogin(
      email || readTempAuthValue('temp_auth_email'),
      agreementsAcceptedAt || readAgreementsAt(),
      onLoginRef.current,
    ).catch((error) => {
      console.error('LOGIN FATAL ERROR:', error);
      verifiedRef.current = false;
      setIsSuccess(false);
      setOtp(['', '', '', '']);
      setLoginError(error instanceof Error ? error.message : 'Не удалось войти');
      inputRefs.current[0]?.focus();
    });
  }, [otp, generatedCode, step, email, agreementsAcceptedAt, isSuccess]);

  const applyOtpDigits = (index: number, raw: string) => {
    if (isSuccess) return;
    setLoginError('');
    const digits = raw.replace(/\D/g, '');
    if (!digits) {
      setOtp((prev) => {
        const next = [...prev];
        next[index] = '';
        return next;
      });
      return;
    }

    const filled = digits.length >= 4 ? digits.slice(0, 4).split('') : null;
    if (filled) {
      setOtp(filled);
      inputRefs.current[3]?.focus();
      return;
    }

    setOtp((prev) => {
      const next = [...prev];
      for (let offset = 0; offset < digits.length && index + offset < 4; offset += 1) {
        next[index + offset] = digits[offset];
      }
      return next;
    });
    const nextFocus = Math.min(index + digits.length, 3);
    inputRefs.current[nextFocus]?.focus();
  };

  const handleOtpChange = (index: number, value: string) => {
    applyOtpDigits(index, value);
  };

  const handleOtpPaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    applyOtpDigits(index, event.clipboardData.getData('text'));
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
        <BrandLogo className="h-64 w-auto mb-8" />
        <h1 className="text-3xl font-black text-[#110b09] mb-8 uppercase tracking-wide">
          {step === 'consent' ? 'Регистрация' : 'Вход'}
        </h1>

        <AnimatePresence mode="wait">
          {step === 'consent' ? (
            <motion.div
              key="consent-step"
              className="w-full"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
            >
              <div className="rounded-2xl border border-[#E8C547]/25 bg-[#231A16] p-4 shadow-[inset_0_1px_0_rgba(232,197,71,0.12)]">
                <ConsentCopy onOpen={setActiveDocument} />
                <button
                  type="button"
                  onClick={handleAcceptAll}
                  className="mt-4 h-12 w-full rounded-xl text-[15px] font-700 tracking-wide text-[#0A0908] active:scale-[0.98]"
                  style={{
                    background: 'linear-gradient(to right, #8C4C27, #D99962)',
                    boxShadow: '0 0 16px rgba(217,153,98,0.28)',
                  }}
                >
                  Принять все и продолжить
                </button>
              </div>
            </motion.div>
          ) : step === 'email' ? (
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
              {loginError ? (
                <p className="text-[13px] font-600 text-red-700 text-center mt-3">{loginError}</p>
              ) : null}
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
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    maxLength={i === 0 ? 4 : 1}
                    value={digit}
                    readOnly={isSuccess}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onPaste={(e) => handleOtpPaste(i, e)}
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

              {isSuccess ? (
                <p className="text-[13px] font-600 text-[#110b09] mb-4">Входим…</p>
              ) : loginError ? (
                <p className="text-[13px] font-600 text-red-700 text-center mb-4 px-2">{loginError}</p>
              ) : null}

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
                  setStep(agreementsAcceptedAt ? 'email' : 'consent');
                  setOtp(['', '', '', '']);
                  setTimer(0);
                  setIsSuccess(false);
                  setLoginError('');
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

      {activeDocument ? (
        <LegalImageModal key={activeDocument.id} document={activeDocument} onClose={() => setActiveDocument(null)} />
      ) : null}

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
