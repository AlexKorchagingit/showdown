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

/** Image-based papers in About → Legal (`public/legal/<file>`). */
export type ClubLegalDocument = {
  id: string;
  title: string;
  file: string;
};

export const CLUB_LEGAL_DOCUMENTS: ClubLegalDocument[] = [
  {
    id: 'privacy-policy',
    title: 'Политика в отношении обработки персональных данных',
    file: 'privacy_policy.png',
  },
  {
    id: 'local-storage-policy',
    title: 'Политика в отношении использования технологий локального хранения данных',
    file: 'local_storage_policy.png',
  },
  {
    id: 'confidentiality-policy',
    title: 'Политика конфиденциальности',
    file: 'confidentiality_policy.png',
  },
  {
    id: 'public-offer',
    title: 'Публичный договор (договор-оферта) на оказание услуг',
    file: 'public_offer.png',
  },
  {
    id: 'offer-addendum',
    title: 'Дополнительное соглашение к публичному договору',
    file: 'offer_addendum.png',
  },
  {
    id: 'pd-consent',
    title: 'Согласие на обработку персональных данных',
    file: 'pd_consent.png',
  },
  {
    id: 'pd-distribution',
    title: 'Согласие на распространение персональных данных',
    file: 'pd_distribution_consent.png',
  },
  {
    id: 'marketing-consent',
    title: 'Согласие на получение рекламных и информационных рассылок',
    file: 'marketing_consent.png',
  },
  {
    id: 'club-rules',
    title: 'Правила посещения клуба',
    file: 'club_rules.png',
  },
  {
    id: 'requisites',
    title: 'Реквизиты и контакты',
    file: 'requisites.png',
  },
];
