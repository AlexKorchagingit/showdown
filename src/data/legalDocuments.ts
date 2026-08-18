export type LegalDocId = 'personal-data' | 'mailing' | 'local-storage';

export interface LegalDocument {
  id: LegalDocId;
  title: string;
  /** Clickable phrase inside the registration consent sentence. */
  phrase: string;
  body: string;
}

const PLACEHOLDER =
  'Полный текст документа будет опубликован в разделе «О клубе» → «Юр. инфо».';

export const CONSENT_DOCUMENTS: LegalDocument[] = [
  {
    id: 'personal-data',
    title: 'Обработка персональных данных',
    phrase: 'обработку персональных данных',
    body: PLACEHOLDER,
  },
  {
    id: 'mailing',
    title: 'Информационные рассылки',
    phrase: 'получение информационных рассылок',
    body: PLACEHOLDER,
  },
  {
    id: 'local-storage',
    title: 'Использование локального хранилища',
    phrase: 'локального хранилища',
    body: PLACEHOLDER,
  },
];

export function legalDocumentById(id: LegalDocId): LegalDocument {
  return CONSENT_DOCUMENTS.find((doc) => doc.id === id) ?? CONSENT_DOCUMENTS[0];
}

/** Extra club papers shown only in About → Legal (full texts arrive later). */
export const ABOUT_CLUB_DOCUMENTS: { title: string; body: string }[] = [
  {
    title: 'Публичный договор (оферта) на оказание услуг',
    body: PLACEHOLDER,
  },
  {
    title: 'Дополнительное соглашение к публичному договору',
    body: PLACEHOLDER,
  },
  {
    title: 'Политика в отношении обработки персональных данных',
    body: PLACEHOLDER,
  },
  {
    title: 'Согласие на обработку персональных данных',
    body: PLACEHOLDER,
  },
  {
    title: 'Согласие на получение информационных рассылок',
    body: PLACEHOLDER,
  },
  {
    title: 'Согласие на использование локального хранилища',
    body: PLACEHOLDER,
  },
  {
    title: 'Лист ознакомления',
    body: PLACEHOLDER,
  },
];
