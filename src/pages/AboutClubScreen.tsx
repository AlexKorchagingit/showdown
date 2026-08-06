import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Camera, ChevronDown, FileText, GraduationCap, Trophy } from 'lucide-react';

type AboutTab = 'general' | 'legal';

const TABS: { id: AboutTab; label: string }[] = [
  { id: 'general', label: 'Общая информация' },
  { id: 'legal', label: 'Юр. инфо' },
];

const RULES = [
  {
    title: 'Спортивно-развлекательный формат',
    body: 'В Клубе строго запрещена любая игра на деньги. Мы не проводим турниры с денежными призами, не формируем призовые фонды и не используем рейк.',
  },
  {
    title: 'Участие и аренда',
    body: 'Входной взнос составляет от 1000 до 1500 ₽ в зависимости от типа турнира. Это плата за организацию и аренду игрового оборудования. Игра считается завершенной при израсходовании фишек или победе в турнире.',
  },
  {
    title: 'Взаимное уважение',
    body: 'Мы за дружелюбную атмосферу. Помните: свобода одного заканчивается там, где начинается свобода другого. При нарушении комфорта участников Администрация вправе прекратить участие игрока.',
  },
];

const PHOTO_SLOTS = ['Зал клуба', 'Игровой стол', 'Атмосфера', 'Комьюнити'];

const DOCUMENTS = [
  'Публичный договор (оферта) на оказание услуг',
  'Дополнительное соглашение к публичному договору',
  'Политика в отношении обработки персональных данных',
  'Согласие на обработку персональных данных',
  'Лист ознакомления',
];

const LOREM =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.\n\nDuis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.\n\nCurabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius, turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin mauris. Integer in mauris eu nibh euismod gravida.';

function PhotoCarousel() {
  return (
    <div className="-mx-5 mb-6">
      <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 px-5 pb-4 hide-scrollbar">
        {PHOTO_SLOTS.map((label, index) => (
          <div
            key={label}
            className="w-[80vw] max-w-[340px] shrink-0 snap-center h-[200px] bg-[#231A16] rounded-2xl border border-white/10 overflow-hidden relative"
          >
            <div
              className="absolute inset-0 opacity-40"
              style={{
                background:
                  index % 2 === 0
                    ? 'radial-gradient(circle at 30% 20%, rgba(217,153,98,0.35), transparent 55%)'
                    : 'radial-gradient(circle at 70% 80%, rgba(242,216,167,0.22), transparent 50%)',
              }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'rgba(17,11,9,0.65)',
                  border: '1px solid rgba(217,153,98,0.35)',
                }}
              >
                <Camera size={26} strokeWidth={1.8} className="text-[#D99962]" />
              </div>
              <p className="text-[12px] font-600 tracking-wide uppercase text-white/45">{label}</p>
            </div>
            <div className="absolute bottom-3 right-3 text-[11px] font-700 text-[#D99962]/70 tabular-nums">
              {String(index + 1).padStart(2, '0')} / {String(PHOTO_SLOTS.length).padStart(2, '0')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RulesSection() {
  return (
    <section className="mb-8">
      <h2 className="text-[13px] font-800 tracking-[0.22em] uppercase text-[#D99962] mb-4">
        Наши правила
      </h2>
      {RULES.map((rule, index) => (
        <div
          key={rule.title}
          className="bg-[#231A16] rounded-xl p-4 mb-4 relative overflow-hidden border border-white/[0.06]"
        >
          <span className="text-[#D99962]/10 text-6xl font-black absolute -right-2 -bottom-4 select-none pointer-events-none leading-none">
            {index + 1}
          </span>
          <p className="relative text-[14px] font-700 text-white mb-2 leading-snug">{rule.title}</p>
          <p className="relative text-[13px] font-500 text-[#A39B98] leading-relaxed">{rule.body}</p>
        </div>
      ))}
    </section>
  );
}

function AccentCard({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div
      className="rounded-xl p-4 mb-4 relative overflow-hidden border border-[#D99962]/50"
      style={{
        background: 'linear-gradient(135deg, rgba(70,49,41,0.55) 0%, rgba(35,26,22,0.95) 55%, rgba(17,11,9,0.98) 100%)',
      }}
    >
      <div className="flex items-center gap-2.5 mb-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(217,153,98,0.14)', border: '1px solid rgba(217,153,98,0.35)' }}
        >
          {icon}
        </div>
        <h3 className="text-[14px] font-800 text-white tracking-wide">{title}</h3>
      </div>
      <p className="text-[13px] font-500 text-[#C9C2BC] leading-relaxed">{body}</p>
    </div>
  );
}

function GeneralTab() {
  return (
    <div>
      <PhotoCarousel />
      <RulesSection />

      <section className="mb-2">
        <h2 className="text-[13px] font-800 tracking-[0.22em] uppercase text-[#D99962] mb-4">
          Возможности клуба
        </h2>
        <AccentCard
          icon={<GraduationCap size={18} strokeWidth={2.1} className="text-[#D99962]" />}
          title="Бесплатное обучение"
          body="Обучение включает в себя основы Техасского Холдема, стратегии игры, позиционирование и диапазоны. Проводится в отдельный день согласно расписанию. Само обучение бесплатно, оплачивается только участие в последующем турнире (для подготовленных игроков)."
        />
        <AccentCard
          icon={<Trophy size={18} strokeWidth={2.1} className="text-[#D99962]" />}
          title="Финал месяца"
          body="Участвуют только игроки из Топ-27 рейтинга месяца. Формат: Freezeout (без re-entry). Глубокий стартовый стек: 50 000 фишек (500 ББ)."
        />
      </section>
    </div>
  );
}

function LegalTab() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div>
      <div
        className="rounded-2xl p-5 mb-6 relative overflow-hidden border border-white/10"
        style={{
          background: 'linear-gradient(160deg, #2A211D 0%, #231A16 45%, #110b09 100%)',
        }}
      >
        <div
          className="absolute -right-6 -top-8 w-32 h-32 rounded-full opacity-30 pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(217,153,98,0.45), transparent 70%)' }}
        />
        <p className="text-[11px] font-700 tracking-[0.28em] uppercase text-[#D99962] mb-3">
          Реквизиты
        </p>
        <p className="text-[13px] font-500 text-white/55 mb-1">Индивидуальный предприниматель</p>
        <p className="text-[18px] font-800 text-white leading-snug mb-4">
          Корчагин Александр Александрович
        </p>
        <div
          className="inline-flex items-center rounded-lg px-3 py-2"
          style={{ background: 'rgba(17,11,9,0.55)', border: '1px solid rgba(217,153,98,0.28)' }}
        >
          <span className="text-[12px] font-600 text-white/50 mr-2">ИНН</span>
          <span className="text-[14px] font-700 text-white tracking-wide tabular-nums">
            770804408442
          </span>
        </div>
      </div>

      <h2 className="text-[13px] font-800 tracking-[0.22em] uppercase text-[#D99962] mb-3">
        Документы
      </h2>

      <div className="space-y-2">
        {DOCUMENTS.map((title, index) => {
          const open = openIndex === index;
          return (
            <div key={title} className="rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setOpenIndex(open ? null : index)}
                aria-expanded={open}
                className="w-full flex justify-between items-center p-4 bg-[#231A16] rounded-lg active:opacity-90 transition-opacity"
              >
                <span className="flex items-center gap-3 min-w-0 text-left">
                  <FileText size={18} strokeWidth={2.1} className="text-[#D99962] shrink-0" />
                  <span className="text-[13px] font-600 text-white leading-snug">{title}</span>
                </span>
                <ChevronDown
                  size={18}
                  strokeWidth={2.2}
                  className={`text-[#D99962] shrink-0 ml-3 transition-transform duration-300 ${
                    open ? 'rotate-180' : ''
                  }`}
                />
              </button>

              <AnimatePresence initial={false}>
                {open && (
                  <motion.div
                    key="body"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="max-h-[300px] overflow-y-auto p-4 bg-[#110b09] text-sm text-[#8c8c88] leading-relaxed whitespace-pre-line rounded-b-lg border border-t-0 border-white/[0.04]">
                      {LOREM}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AboutClubScreen() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<AboutTab>('general');

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#110b09]">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="absolute top-4 left-4 z-50 w-12 h-12 rounded-full flex items-center justify-center"
        style={{
          background: 'rgba(28,20,16,0.78)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(217,153,98,0.28)',
        }}
        aria-label="Назад"
      >
        <ArrowLeft size={22} strokeWidth={2.2} style={{ color: '#D99962' }} />
      </button>

      <div className="flex-shrink-0 px-5 pt-20 pb-3">
        <h1 className="text-center text-[17px] font-800 tracking-[0.25em] text-white uppercase">
          О клубе
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 px-5 mb-4">
        <div
          className="grid grid-cols-2 gap-1 p-1 rounded-2xl"
          style={{ background: '#1A1210', border: '1px solid rgba(255,255,255,0.06)' }}
          role="tablist"
          aria-label="Разделы о клубе"
        >
          {TABS.map(({ id, label }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(id)}
                className={`py-2.5 rounded-xl text-[11px] font-800 tracking-[0.08em] uppercase transition-all ${
                  active ? 'text-[#0A0908]' : 'text-[#8c8c88]'
                }`}
                style={
                  active
                    ? {
                        background: 'linear-gradient(to right, #8C4C27, #D99962)',
                        boxShadow: '0 0 18px rgba(217,153,98,0.28)',
                      }
                    : undefined
                }
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="flex-1 scrollable px-5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 2rem)' }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
          >
            {tab === 'general' ? <GeneralTab /> : <LegalTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
