import { createOtpClient } from './otpApi';
import { supabase, supabaseAnonKey, supabaseUrl } from './supabase';
import { withRequestDeadline } from './network';

const client = createOtpClient({
  baseUrl: supabaseUrl,
  anonKey: supabaseAnonKey,
  storeSession: async (tokens) => {
    const { error } = await withRequestDeadline(supabase.auth.setSession(tokens), 15_000);
    if (error) {
      console.error('Auth session storage failed:', error.name);
      throw new Error('Session unavailable');
    }
  },
});

export const requestLoginCode = (email: string) => client.requestCode(email);
export const verifyLoginCode = (email: string, code: string) => client.verifyCode(email, code);
