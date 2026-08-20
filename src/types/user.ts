/** Club account fields that persist with the signed-in email. */
export interface User {
  email: string;
  nickname: string;
  /** ISO timestamp of when registration policies were accepted. */
  agreementsAcceptedAt?: string;
}
