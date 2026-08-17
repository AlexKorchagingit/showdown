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
import { findShopItem, resolveImage, avatarUrlForChar } from '../data/shopItems';
import { loadUserData, saveUserData, type UserData } from '../lib/userStorage';

interface ProfileContextValue extends UserData {
  /** Image paths resolved from the equipped item ids. */
  characterImage: string;
  backgroundImage: string;
  equippedAvatar: string;
  updateNickname: (value: string) => void;
  updateBirthDate: (value: string) => void;
  updateSlogan: (value: string) => void;
  isOwned: (itemId: string) => boolean;
  isEquipped: (itemId: string) => boolean;
  /** Returns false when the balance is too low or the item is unknown. */
  buyItem: (itemId: string) => boolean;
  equipItem: (itemId: string) => void;
  addCoins: (amount: number) => void;
  claimFirstNotification: () => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { email } = useUser();
  const [data, setData] = useState<UserData>(() => loadUserData(email));

  // Re-read the record whenever the signed-in account changes
  useEffect(() => {
    setData(loadUserData(email));
  }, [email]);

  // Every change is merged into the record and written straight to storage,
  // keyed by the email captured for this render.
  const patch = useCallback(
    (changes: Partial<UserData>) => {
      setData((prev) => {
        const next = { ...prev, ...changes };
        saveUserData(email, next);
        return next;
      });
    },
    [email],
  );

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

  const addCoins = useCallback(
    (amount: number) => {
      const delta = Math.floor(Number(amount));
      if (!Number.isFinite(delta) || delta === 0) return;
      setData((prev) => {
        const next = { ...prev, coins: Math.max(0, prev.coins + delta) };
        saveUserData(email, next);
        return next;
      });
    },
    [email],
  );

  const claimFirstNotification = useCallback(() => {
    setData((prev) => {
      const [first, ...rest] = prev.pendingNotifications;
      if (!first) return prev;
      const next = {
        ...prev,
        coins: prev.coins + first.amount,
        pendingNotifications: rest,
      };
      saveUserData(email, next);
      return next;
    });
  }, [email]);

  const value = useMemo(
    () => ({
      ...data,
      characterImage: resolveImage(data.equippedChar, 'character'),
      backgroundImage: resolveImage(data.equippedBg, 'bg'),
      equippedAvatar: avatarUrlForChar(data.equippedChar),
      updateNickname,
      updateBirthDate,
      updateSlogan,
      isOwned,
      isEquipped,
      buyItem,
      equipItem,
      addCoins,
      claimFirstNotification,
    }),
    [
      data,
      updateNickname,
      updateBirthDate,
      updateSlogan,
      isOwned,
      isEquipped,
      buyItem,
      equipItem,
      addCoins,
      claimFirstNotification,
    ],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
