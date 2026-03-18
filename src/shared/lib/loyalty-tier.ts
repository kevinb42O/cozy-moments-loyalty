import type { CardType } from '../store/LoyaltyContext';

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'vip';

export interface LoyaltySnapshot {
  cards: Record<CardType, number>;
  rewards: Record<CardType, number>;
  claimedRewards: Record<CardType, number>;
}

export interface LoyaltyTierConfig {
  tier: LoyaltyTier;
  label: string;
  shortLabel: string;
  minPoints: number;
  nextTier?: LoyaltyTier;
  nextTierMinPoints?: number;
  customerBadgeClassName: string;
  customerBadgeStyle: {
    background: string;
    color: string;
    border: string;
    boxShadow: string;
  };
  adminBadgeClassName: string;
  accentColor: string;
}

export const LOYALTY_TIER_ORDER: LoyaltyTier[] = ['bronze', 'silver', 'gold', 'vip'];

export const LOYALTY_TIER_CONFIG: Record<LoyaltyTier, LoyaltyTierConfig> = {
  bronze: {
    tier: 'bronze',
    label: 'Brons',
    shortLabel: 'B',
    minPoints: 0,
    nextTier: 'silver',
    nextTierMinPoints: 25,
    customerBadgeClassName: 'bg-[#f7ede3] text-[#7a5430] border-[#d9b08c]',
    customerBadgeStyle: {
      background: 'linear-gradient(135deg, #f6e3d1 0%, #e2b78f 100%)',
      color: '#6f4a2b',
      border: '1px solid rgba(143, 93, 55, 0.18)',
      boxShadow: '0 10px 28px rgba(143, 93, 55, 0.18)',
    },
    adminBadgeClassName: 'bg-[#f7ede3] text-[#7a5430] border-[#e2c3a5]',
    accentColor: '#8f5d37',
  },
  silver: {
    tier: 'silver',
    label: 'Zilver',
    shortLabel: 'S',
    minPoints: 25,
    nextTier: 'gold',
    nextTierMinPoints: 75,
    customerBadgeClassName: 'bg-[#eef2f5] text-[#566472] border-[#cfd7de]',
    customerBadgeStyle: {
      background: 'linear-gradient(135deg, #f3f5f7 0%, #cfd8df 100%)',
      color: '#4c5a67',
      border: '1px solid rgba(86, 100, 114, 0.16)',
      boxShadow: '0 10px 28px rgba(86, 100, 114, 0.18)',
    },
    adminBadgeClassName: 'bg-[#eef2f5] text-[#566472] border-[#d8dee4]',
    accentColor: '#7a8894',
  },
  gold: {
    tier: 'gold',
    label: 'Goud',
    shortLabel: 'G',
    minPoints: 75,
    nextTier: 'vip',
    nextTierMinPoints: 150,
    customerBadgeClassName: 'bg-[#fbf2cf] text-[#8c6700] border-[#e7c35a]',
    customerBadgeStyle: {
      background: 'linear-gradient(135deg, #fff6d8 0%, #f1cb59 100%)',
      color: '#7f5d00',
      border: '1px solid rgba(140, 103, 0, 0.14)',
      boxShadow: '0 10px 28px rgba(212, 175, 55, 0.22)',
    },
    adminBadgeClassName: 'bg-[#fbf2cf] text-[#8c6700] border-[#f1d889]',
    accentColor: '#d4af37',
  },
  vip: {
    tier: 'vip',
    label: 'Platinum',
    shortLabel: 'P',
    minPoints: 150,
    customerBadgeClassName: 'bg-[#eef4ff] text-[#36527a] border-[#b9cde8]',
    customerBadgeStyle: {
      background: 'linear-gradient(135deg, #f9fcff 0%, #dce9ff 38%, #b7d3ff 68%, #8fb5f0 100%)',
      color: '#234468',
      border: '1px solid rgba(63, 108, 168, 0.22)',
      boxShadow: '0 12px 32px rgba(99, 146, 212, 0.24)',
    },
    adminBadgeClassName: 'bg-[#eef4ff] text-[#36527a] border-[#c8daf1]',
    accentColor: '#7da9e8',
  },
};

export function calculateLifetimeConsumptions(snapshot: LoyaltySnapshot): number {
  return (Object.keys(snapshot.cards) as CardType[]).reduce((sum, type) => {
    return sum + snapshot.cards[type] + ((snapshot.rewards[type] + snapshot.claimedRewards[type]) * 12);
  }, 0);
}

export function resolveLoyaltyTier(points: number): LoyaltyTier {
  if (points >= LOYALTY_TIER_CONFIG.vip.minPoints) return 'vip';
  if (points >= LOYALTY_TIER_CONFIG.gold.minPoints) return 'gold';
  if (points >= LOYALTY_TIER_CONFIG.silver.minPoints) return 'silver';
  return 'bronze';
}

export function getLoyaltyTierRank(tier: LoyaltyTier): number {
  return LOYALTY_TIER_ORDER.indexOf(tier);
}

export function getLoyaltyTierLabel(points: number): string {
  return LOYALTY_TIER_CONFIG[resolveLoyaltyTier(points)].label;
}

export function getLoyaltyProgress(points: number) {
  const tier = resolveLoyaltyTier(points);
  const config = LOYALTY_TIER_CONFIG[tier];

  if (!config.nextTier || typeof config.nextTierMinPoints !== 'number') {
    return {
      tier,
      points,
      currentTierMin: config.minPoints,
      nextTier: null,
      nextTierMinPoints: null,
      pointsIntoTier: points - config.minPoints,
      pointsNeeded: 0,
      progressPercent: 100,
    };
  }

  const span = config.nextTierMinPoints - config.minPoints;
  const pointsIntoTier = Math.max(0, points - config.minPoints);
  const progressPercent = Math.max(0, Math.min(100, Math.round((pointsIntoTier / span) * 100)));

  return {
    tier,
    points,
    currentTierMin: config.minPoints,
    nextTier: config.nextTier,
    nextTierMinPoints: config.nextTierMinPoints,
    pointsIntoTier,
    pointsNeeded: Math.max(0, config.nextTierMinPoints - points),
    progressPercent,
  };
}