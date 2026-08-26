import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { useUser } from './UserContext';
import {
  COSMETICS_RESET_TOKEN,
  DEFAULT_BG_ID,
  DEFAULT_CHARACTER_ID,
  FREE_ITEM_IDS,
  findShopItem,
  resolveImage,
  avatarUrlForChar,
} from '../data/shopItems';
import type { UserData } from '../lib/userStorage';

const EMPTY_PROFILE: UserData = {
  nickname: '',
  birthDate: '',
  slogan: '',
  coins: 0,
  ownedItems: [],
  equippedChar: DEFAULT_CHARACTER_ID,
  equippedBg: DEFAULT_BG_ID,
  pendingNotifications: [],
};

interface ProfileContextValue extends UserData {
  isLoading: boolean;
  characterImage: string;
  backgroundImage: string;
  equippedAvatar: string;
  updateNickname: (value: string) => void;
  updateBirthDate: (value: string) => void;
  updateSlogan: (value: string) => void;
  isOwned: (itemId: string) => boolean;
  isEquipped: (itemId: string) => boolean;
  buyItem: (itemId: string) => Promise<boolean>;
  equipItem: (itemId: string) => void;
  addCoins: (amount: number) => Promise<void>;
  claimFirstNotification: () => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { account, isLoading, patchAccount } = useUser();
  const data: UserData = account ?? EMPTY_PROFILE;

  const updateNickname = useCallback(
    (value: string) => {
      void patchAccount({ nickname: value });
    },
    [patchAccount],
  );
  const updateBirthDate = useCallback(
    (value: string) => {
      void patchAccount({ birthDate: value });
    },
    [patchAccount],
  );
  const updateSlogan = useCallback(
    (value: string) => {
      void patchAccount({ slogan: value });
    },
    [patchAccount],
  );

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
      void patchAccount(
        item.type === 'character'
          ? { equippedChar: itemId, equippedBg: data.equippedBg }
          : { equippedBg: itemId, equippedChar: data.equippedChar },
      );
    },
    [data.equippedBg, data.equippedChar, patchAccount],
  );

  const buyItem = useCallback(
    async (itemId: string) => {
      const item = findShopItem(itemId);
      if (!item) return false;
      if (data.ownedItems.includes(itemId)) return true;
      if (data.coins < item.price) return false;
      const ownedItems = [
        ...new Set([
          COSMETICS_RESET_TOKEN,
          ...FREE_ITEM_IDS,
          ...data.ownedItems,
          itemId,
        ]),
      ];
      const next = await patchAccount({
        coins: data.coins - item.price,
        ownedItems,
        ...(item.type === 'character'
          ? { equippedChar: itemId, equippedBg: data.equippedBg }
          : { equippedBg: itemId, equippedChar: data.equippedChar }),
      });
      return Boolean(next?.ownedItems.includes(itemId));
    },
    [data.coins, data.equippedBg, data.equippedChar, data.ownedItems, patchAccount],
  );

  const addCoins = useCallback(
    async (amount: number) => {
      const delta = Math.floor(Number(amount));
      if (!Number.isFinite(delta) || delta === 0) return;
      await patchAccount({ coins: Math.max(0, data.coins + delta) });
    },
    [data.coins, patchAccount],
  );

  const claimFirstNotification = useCallback(() => {
    const [first, ...rest] = data.pendingNotifications;
    if (!first) return;
    void patchAccount({
      coins: data.coins + first.amount,
      pendingNotifications: rest,
    });
  }, [data.coins, data.pendingNotifications, patchAccount]);

  const value = useMemo(
    () => ({
      ...data,
      isLoading,
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
      isLoading,
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
