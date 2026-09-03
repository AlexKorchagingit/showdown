import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { useUser } from './UserContext';
import {
  DEFAULT_BG_ID,
  DEFAULT_CHARACTER_ID,
  resolveImage,
  avatarUrlForChar,
} from '../data/shopItems';
import type { ShopItem } from '../data/shopItems';
import { shopCatalogItems } from '../lib/wallet';
import { useWallet } from '../hooks/useWallet';
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
  walletLoading: boolean;
  walletError: string | null;
  walletBusy: boolean;
  refreshWallet: () => Promise<void>;
  shopItems: ShopItem[];
  characterImage: string;
  backgroundImage: string;
  equippedAvatar: string;
  updateProfile: (values: Pick<UserData, 'nickname' | 'birthDate' | 'slogan'>) => Promise<boolean>;
  isOwned: (itemId: string) => boolean;
  isEquipped: (itemId: string) => boolean;
  buyItem: (itemId: string) => Promise<boolean>;
  equipItem: (itemId: string) => Promise<boolean>;
  addCoins: (amount: number) => Promise<void>;
  claimFirstNotification: () => Promise<boolean>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { account, isLoading, patchAccount } = useUser();
  const walletState = useWallet(account?.id ?? '');
  const wallet = walletState.wallet;
  const data: UserData = { ...(account ?? EMPTY_PROFILE),
    coins: wallet?.coins ?? 0, ownedItems: wallet?.ownedItems ?? [],
    equippedChar: wallet?.equippedChar ?? DEFAULT_CHARACTER_ID, equippedBg: wallet?.equippedBg ?? DEFAULT_BG_ID,
    pendingNotifications: wallet?.pendingNotifications ?? [],
  };
  const shopItems = useMemo(() => wallet ? shopCatalogItems(wallet) : [], [wallet]);

  const updateProfile = useCallback(async (
    values: Pick<UserData, 'nickname' | 'birthDate' | 'slogan'>,
  ) => {
    try {
      return Boolean(await patchAccount(values));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Не удалось сохранить профиль');
      return false;
    }
  }, [patchAccount]);

  const isOwned = useCallback(
    (itemId: string) => data.ownedItems.includes(itemId) || wallet?.catalog.some((item) => item.id === itemId && item.price === 0) === true,
    [data.ownedItems, wallet],
  );

  const isEquipped = useCallback(
    (itemId: string) => data.equippedChar === itemId || data.equippedBg === itemId,
    [data.equippedChar, data.equippedBg],
  );

  const equipItem = useCallback(
    (itemId: string) => walletState.shop({ action: 'equip', itemId }),
    [walletState.shop],
  );

  const buyItem = useCallback(
    async (itemId: string) => {
      const item = wallet?.catalog.find((entry) => entry.id === itemId);
      if (!item) return false;
      return walletState.shop({ action: 'buy', itemId, catalogRevision: item.revision });
    },
    [wallet, walletState.shop],
  );

  const addCoins = useCallback(
    async (amount: number) => {
      const delta = Math.floor(Number(amount));
      if (!Number.isFinite(delta)) return;
      if (!wallet || walletState.isLoading || walletState.error) throw new Error('Сначала обновите кошелёк');
      if (delta !== 0) throw new Error('Баланс изменяется только подтверждённой серверной операцией');
      await walletState.refresh();
    },
    [wallet, walletState.isLoading, walletState.error, walletState.refresh],
  );

  const claimFirstNotification = useCallback(async () => {
    const first = data.pendingNotifications[0];
    return first ? walletState.claim(first.id) : false;
  }, [data.pendingNotifications, walletState.claim]);

  const value = useMemo(
    () => ({
      ...data,
      isLoading: isLoading || walletState.isLoading,
      walletLoading: walletState.isLoading,
      walletError: walletState.error,
      walletBusy: walletState.isBusy,
      refreshWallet: walletState.refresh,
      shopItems,
      characterImage: resolveImage(data.equippedChar, 'character'),
      backgroundImage: resolveImage(data.equippedBg, 'bg'),
      equippedAvatar: avatarUrlForChar(data.equippedChar),
      updateProfile,
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
      updateProfile,
      isOwned,
      isEquipped,
      buyItem,
      equipItem,
      addCoins,
      claimFirstNotification,
      walletState,
      shopItems,
    ],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within ProfileProvider');
  return ctx;
}
