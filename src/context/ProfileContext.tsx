import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  getBirthDate,
  getNickname,
  getSlogan,
  setBirthDate as saveBirthDate,
  setNickname as saveNickname,
  setSlogan as saveSlogan,
} from '../lib/profileStorage';

interface ProfileContextValue {
  nickname: string;
  birthDate: string;
  slogan: string;
  updateNickname: (value: string) => void;
  updateBirthDate: (value: string) => void;
  updateSlogan: (value: string) => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [nickname, setNicknameState] = useState(getNickname);
  const [birthDate, setBirthDateState] = useState(getBirthDate);
  const [slogan, setSloganState] = useState(getSlogan);

  const updateNickname = useCallback((value: string) => {
    saveNickname(value);
    setNicknameState(value);
  }, []);

  const updateBirthDate = useCallback((value: string) => {
    saveBirthDate(value);
    setBirthDateState(value);
  }, []);

  const updateSlogan = useCallback((value: string) => {
    saveSlogan(value);
    setSloganState(value);
  }, []);

  const value = useMemo(
    () => ({ nickname, birthDate, slogan, updateNickname, updateBirthDate, updateSlogan }),
    [nickname, birthDate, slogan, updateNickname, updateBirthDate, updateSlogan],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
