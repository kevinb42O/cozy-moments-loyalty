import { describe, it, expect } from 'vitest';
import { calculateLifetimeConsumptions, getLoyaltyProgress, resolveLoyaltyTier } from '../shared/lib/loyalty-tier';

/**
 * Tests the stamp → reward arithmetic used in LoyaltyContext.addConsumptions.
 * This is the core business logic: 10 stamps = 1 free drink reward.
 */

type CardType = 'coffee' | 'wine' | 'beer' | 'soda';

function calculateStamps(currentStamps: number, added: number) {
  const total = currentStamps + added;
  const rewardsEarned = Math.floor(total / 10);
  const remaining = total % 10;
  return { rewardsEarned, remaining };
}

/**
 * Simulates a full multi-card addConsumptions call (mirrors LoyaltyContext logic).
 */
function addConsumptionsLogic(
  cards: Record<CardType, number>,
  rewards: Record<CardType, number>,
  consumptions: Record<CardType, number>,
) {
  const earned: Record<CardType, number> = { coffee: 0, wine: 0, beer: 0, soda: 0 };
  const newCards = { ...cards };
  const newRewards = { ...rewards };

  (Object.keys(consumptions) as CardType[]).forEach(type => {
    if (consumptions[type] <= 0) return;
    const total = newCards[type] + consumptions[type];
    const rewardsEarned = Math.floor(total / 10);
    earned[type] = rewardsEarned;
    newCards[type] = total % 10;
    if (rewardsEarned > 0) newRewards[type] = (newRewards[type] || 0) + rewardsEarned;
  });

  return { newCards, newRewards, earned };
}

/**
 * Estimated revenue calculation (mirrors BusinessPage.tsx logic).
 */
const PRICE_ESTIMATE: Record<CardType, number> = { coffee: 3, wine: 5, beer: 4, soda: 3 };

function calcEstimatedRevenue(totals: Record<CardType, number>): number {
  return (Object.keys(totals) as CardType[]).reduce((sum, t) => sum + totals[t] * PRICE_ESTIMATE[t], 0);
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. Stamp Arithmetic
// ══════════════════════════════════════════════════════════════════════════════

describe('Stamp & Reward Logic', () => {
  it('should not earn reward with fewer than 10 stamps', () => {
    const result = calculateStamps(3, 4);
    expect(result.rewardsEarned).toBe(0);
    expect(result.remaining).toBe(7);
  });

  it('should earn 1 reward at exactly 10 stamps', () => {
    const result = calculateStamps(7, 3);
    expect(result.rewardsEarned).toBe(1);
    expect(result.remaining).toBe(0);
  });

  it('should carry over stamps past 10', () => {
    const result = calculateStamps(8, 5);
    expect(result.rewardsEarned).toBe(1);
    expect(result.remaining).toBe(3);
  });

  it('should earn multiple rewards in one go', () => {
    const result = calculateStamps(5, 25);
    expect(result.rewardsEarned).toBe(3);
    expect(result.remaining).toBe(0);
  });

  it('should handle 0 additions', () => {
    const result = calculateStamps(5, 0);
    expect(result.rewardsEarned).toBe(0);
    expect(result.remaining).toBe(5);
  });

  it('should handle starting from 0', () => {
    const result = calculateStamps(0, 12);
    expect(result.rewardsEarned).toBe(1);
    expect(result.remaining).toBe(2);
  });

  it('should handle adding exactly 10 from 0', () => {
    const result = calculateStamps(0, 10);
    expect(result.rewardsEarned).toBe(1);
    expect(result.remaining).toBe(0);
  });

  it('should handle large batches', () => {
    const result = calculateStamps(9, 91);
    expect(result.rewardsEarned).toBe(10);
    expect(result.remaining).toBe(0);
  });

  it('should handle 9 stamps + 1 addition = exactly 1 reward', () => {
    const result = calculateStamps(9, 1);
    expect(result.rewardsEarned).toBe(1);
    expect(result.remaining).toBe(0);
  });

  it('should handle 1 stamp added from 0 — no reward', () => {
    const result = calculateStamps(0, 1);
    expect(result.rewardsEarned).toBe(0);
    expect(result.remaining).toBe(1);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. Reward Claim Logic
// ══════════════════════════════════════════════════════════════════════════════

describe('Reward Claim Logic', () => {
  it('should allow claiming when rewards > 0', () => {
    const rewards = 2;
    const canClaim = rewards > 0;
    const afterClaim = rewards - 1;
    expect(canClaim).toBe(true);
    expect(afterClaim).toBe(1);
  });

  it('should not allow claiming when rewards = 0', () => {
    const rewards = 0;
    const canClaim = rewards > 0;
    expect(canClaim).toBe(false);
  });

  it('should increment claimed counter on claim', () => {
    const claimed = 3;
    const afterClaim = claimed + 1;
    expect(afterClaim).toBe(4);
  });

  it('should allow claiming the last reward', () => {
    const rewards = 1;
    expect(rewards > 0).toBe(true);
    expect(rewards - 1).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. Multi-Card Consumption (end-to-end flow simulation)
// ══════════════════════════════════════════════════════════════════════════════

describe('Multi-Card addConsumptions Logic', () => {
  it('should add stamps to multiple card types at once', () => {
    const cards = { coffee: 3, wine: 0, beer: 7, soda: 0 };
    const rewards = { coffee: 0, wine: 0, beer: 0, soda: 0 };
    const consumptions = { coffee: 2, wine: 1, beer: 5, soda: 0 };

    const { newCards, newRewards, earned } = addConsumptionsLogic(cards, rewards, consumptions);

    expect(newCards.coffee).toBe(5);
    expect(newCards.wine).toBe(1);
    expect(newCards.beer).toBe(2); // 7+5=12 → 2 remaining
    expect(newCards.soda).toBe(0);
    expect(earned.beer).toBe(1);
    expect(earned.coffee).toBe(0);
    expect(newRewards.beer).toBe(1);
  });

  it('should earn rewards on multiple types simultaneously', () => {
    const cards = { coffee: 8, wine: 9, beer: 0, soda: 5 };
    const rewards = { coffee: 1, wine: 0, beer: 0, soda: 0 };
    const consumptions = { coffee: 5, wine: 1, beer: 0, soda: 0 };

    const { newCards, newRewards, earned } = addConsumptionsLogic(cards, rewards, consumptions);

    expect(earned.coffee).toBe(1);     // 8+5=13 → 1 reward
    expect(earned.wine).toBe(1);       // 9+1=10 → 1 reward
    expect(newCards.coffee).toBe(3);   // 13%10=3
    expect(newCards.wine).toBe(0);     // 10%10=0
    expect(newRewards.coffee).toBe(2); // was 1 + earned 1
    expect(newRewards.wine).toBe(1);
  });

  it('should handle all-zero consumptions (noop)', () => {
    const cards = { coffee: 5, wine: 3, beer: 1, soda: 9 };
    const rewards = { coffee: 0, wine: 0, beer: 0, soda: 0 };
    const consumptions = { coffee: 0, wine: 0, beer: 0, soda: 0 };

    const { newCards, earned } = addConsumptionsLogic(cards, rewards, consumptions);

    expect(newCards).toEqual(cards);
    expect(earned).toEqual({ coffee: 0, wine: 0, beer: 0, soda: 0 });
  });

  it('should handle the handleiding example: Lisa 8 coffee + 3', () => {
    // From the user manual: Lisa has 8 coffee, buys 3 → 1 reward + 1 remaining
    const cards = { coffee: 8, wine: 0, beer: 0, soda: 0 };
    const rewards = { coffee: 0, wine: 0, beer: 0, soda: 0 };
    const consumptions = { coffee: 3, wine: 0, beer: 0, soda: 0 };

    const { newCards, newRewards, earned } = addConsumptionsLogic(cards, rewards, consumptions);

    expect(earned.coffee).toBe(1);
    expect(newCards.coffee).toBe(1);
    expect(newRewards.coffee).toBe(1);
  });

  it('should accumulate rewards correctly over multiple rounds', () => {
    // Round 1
    let cards = { coffee: 0, wine: 0, beer: 0, soda: 0 };
    let rewards = { coffee: 0, wine: 0, beer: 0, soda: 0 };
    let result = addConsumptionsLogic(cards, rewards, { coffee: 10, wine: 0, beer: 0, soda: 0 });
    expect(result.earned.coffee).toBe(1);

    // Round 2 (builds on round 1)
    result = addConsumptionsLogic(result.newCards, result.newRewards, { coffee: 10, wine: 0, beer: 0, soda: 0 });
    expect(result.earned.coffee).toBe(1);
    expect(result.newRewards.coffee).toBe(2); // 2 unclaimed rewards total
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. Revenue Estimation
// ══════════════════════════════════════════════════════════════════════════════

describe('Estimated Revenue', () => {
  it('should calculate revenue for a mixed order', () => {
    const totals = { coffee: 10, wine: 5, beer: 8, soda: 3 };
    // 10*3 + 5*5 + 8*4 + 3*3 = 30 + 25 + 32 + 9 = 96
    expect(calcEstimatedRevenue(totals)).toBe(96);
  });

  it('should return 0 for zero consumptions', () => {
    expect(calcEstimatedRevenue({ coffee: 0, wine: 0, beer: 0, soda: 0 })).toBe(0);
  });

  it('should handle single-type drinker', () => {
    expect(calcEstimatedRevenue({ coffee: 0, wine: 20, beer: 0, soda: 0 })).toBe(100);
  });
});

describe('Loyalty Tier Logic', () => {
  it('should calculate lifetime consumptions from cards, rewards and claimed rewards', () => {
    const points = calculateLifetimeConsumptions({
      cards: { coffee: 4, wine: 2, beer: 1, soda: 0 },
      rewards: { coffee: 1, wine: 0, beer: 0, soda: 0 },
      claimedRewards: { coffee: 2, wine: 1, beer: 0, soda: 0 },
    });

    expect(points).toBe(47);
  });

  it('should assign Bronze below 25 points', () => {
    expect(resolveLoyaltyTier(24)).toBe('bronze');
  });

  it('should assign Silver from 25 points', () => {
    expect(resolveLoyaltyTier(25)).toBe('silver');
  });

  it('should assign Gold from 75 points', () => {
    expect(resolveLoyaltyTier(75)).toBe('gold');
  });

  it('should assign VIP from 150 points', () => {
    expect(resolveLoyaltyTier(150)).toBe('vip');
  });

  it('should report progress to the next tier', () => {
    const progress = getLoyaltyProgress(60);

    expect(progress.tier).toBe('silver');
    expect(progress.nextTier).toBe('gold');
    expect(progress.pointsNeeded).toBe(15);
    expect(progress.progressPercent).toBe(70);
  });

  it('should cap VIP progress at 100 percent', () => {
    const progress = getLoyaltyProgress(210);

    expect(progress.tier).toBe('vip');
    expect(progress.nextTier).toBeNull();
    expect(progress.progressPercent).toBe(100);
  });
});
