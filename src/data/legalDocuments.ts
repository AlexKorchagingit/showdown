export type LegalDocId = 'personal-data' | 'mailing' | 'local-storage';

export type ClubLegalDocument = {
  id: string;
  title: string;
  slug: string;
  pages: number;
};

/** Image-based papers in About → Legal (`public/legal/<slug>-N.png`). */
export const CLUB_LEGAL_DOCUMENTS: ClubLegalDocument[] = [
  {
    id: 'privacy-policy',
    title: 'Политика в отношении обработки персональных данных',
    slug: 'privacy_policy',
    pages: 6,
  },
  {
    id: 'local-storage-policy',
    title: 'Политика в отношении использования технологий локального хранения данных',
    slug: 'local_storage_policy',
    pages: 2,
  },
  {
    id: 'confidentiality-policy',
    title: 'Политика конфиденциальности',
    slug: 'confidentiality_policy',
    pages: 3,
  },
  {
    id: 'public-offer',
    title: 'Публичный договор (договор-оферта) на оказание услуг',
    slug: 'public_offer',
    pages: 14,
  },
  {
    id: 'offer-addendum',
    title: 'Дополнительное соглашение к публичному договору',
    slug: 'offer_addendum',
    pages: 1,
  },
  {
    id: 'pd-consent',
    title: 'Согласие на обработку персональных данных',
    slug: 'pd_consent',
    pages: 1,
  },
  {
    id: 'pd-distribution',
    title: 'Согласие на распространение персональных данных',
    slug: 'pd_distribution_consent',
    pages: 1,
  },
  {
    id: 'marketing-consent',
    title: 'Согласие на получение рекламных и информационных рассылок',
    slug: 'marketing_consent',
    pages: 1,
  },
  {
    id: 'club-rules',
    title: 'Правила посещения клуба',
    slug: 'club_rules',
    pages: 2,
  },
  {
    id: 'requisites',
    title: 'Реквизиты и контакты',
    slug: 'requisites',
    pages: 1,
  },
];

export function clubLegalById(id: string): ClubLegalDocument | undefined {
  return CLUB_LEGAL_DOCUMENTS.find((document) => document.id === id);
}

export function clubLegalPageFiles(document: ClubLegalDocument): string[] {
  return Array.from({ length: document.pages }, (_, index) => `/legal/${document.slug}-${index + 1}.png`);
}

/** Clickable phrases on the registration consent gateway. */
export interface ConsentLink {
  id: LegalDocId;
  phrase: string;
  clubDocId: string;
}

export const CONSENT_DOCUMENTS: ConsentLink[] = [
  {
    id: 'personal-data',
    phrase: 'обработку персональных данных',
    clubDocId: 'pd-consent',
  },
  {
    id: 'mailing',
    phrase: 'получение информационных рассылок',
    clubDocId: 'marketing-consent',
  },
  {
    id: 'local-storage',
    phrase: 'локального хранилища',
    clubDocId: 'local-storage-policy',
  },
];

export function consentClubDocument(link: ConsentLink): ClubLegalDocument {
  return clubLegalById(link.clubDocId) ?? CLUB_LEGAL_DOCUMENTS[0];
}
