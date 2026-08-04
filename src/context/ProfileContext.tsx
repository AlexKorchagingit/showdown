import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useUser } from './UserContext';
import { findShopItem, resolveImage } from '../data/shopItems';
import { loadUserData, saveUserData, type UserData } from '../lib/userStorage';

interface ProfileContextValue extends UserData {
  /** Image paths resolved from the equipped item ids. */
  characterImage: string;
  backgroundImage: string;
  updateNickname: (value: string) => void;
  updateBirthDate: (value: string) => void;
  updateSlogan: (value: string) => void;
  isOwned: (itemId: string) => boolean;
  isEquipped: (itemId: string) => boolean;
  /** Returns false when the balance is too low or the item is unknown. */
  buyItem: (itemId: string) => boolean;
  equipItem: (itemId: string) => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { email } = useUser();

  // The owner email is kept next to the data so a half-finished account switch
  // can never write one player's profile into another player's record.
  const [state, setState] = useState(() => ({ email, data: loadUserData(email) }));
  const data = state.data;

  useEffect(() => {
    setState((prev) => (prev.email === email ? prev : { email, data: loadUserData(email) }));
  }, [email]);

  useEffect(() => {
    if (state.email !== email) return;
    saveUserData(email, state.data);
  }, [email, state]);

  const patch = useCallback((changes: Partial<UserData>) => {
    setState((prev) => ({ ...prev, data: { ...prev.data, ...changes } }));
  }, []);

  const updateNickname = useCallback((value: string) => patch({ nickname: value }), [patch]);
  const updateBirthDate = useCallback((value: string) => patch({ birthDate: value }), [patch]);
  const updateSlogan = useCallback((value: string) => patch({ slogan: value }), [patch]);

  const isOwned = useCallback(
    (itemId: string) => data.ownedItems.includes(itemId),
    [data.ownedItems],
  );

  const isEquipped = useCallback(
    (itemId: string) => data.equippedChar === itemId || data.equippedBg === itemId,
    [data.equippedChar, data.equippedBg],
  );

  const equipItem = useCallback(
    (itemId: string) => {
      const item = findShopItem(itemId);
      if (!item) return;
      patch(item.type === 'character' ? { equippedChar: itemId } : { equippedBg: itemId });
    },
    [patch],
  );

  const buyItem = useCallback(
    (itemId: string) => {
      const item = findShopItem(itemId);
      if (!item) return false;
      if (data.ownedItems.includes(itemId)) return true;
      if (data.coins < item.price) return false;

      patch({
        coins: data.coins - item.price,
        ownedItems: [...data.ownedItems, itemId],
      });
      return true;
    },
    [data.coins, data.ownedItems, patch],
  );

  const value = useMemo(
    () => ({
      ...data,
      characterImage: resolveImage(data.equippedChar, 'character'),
      backgroundImage: resolveImage(data.equippedBg, 'bg'),
      updateNickname,
      updateBirthDate,
      updateSlogan,
      isOwned,
      isEquipped,
      buyItem,
      equipItem,
    }),
    [data, updateNickname, updateBirthDate, updateSlogan, isOwned, isEquipped, buyItem, equipItem],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
