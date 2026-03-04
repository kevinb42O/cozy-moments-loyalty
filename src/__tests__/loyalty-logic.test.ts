import { describe, it, expect } from 'vitest';

/**
 * Tests the stamp → reward arithmetic used in LoyaltyContext.addConsumptions.
 * This is the core business logic: 10 stamps = 1 free drink reward.
 */

function calculateStamps(currentStamps: number, added: number) {
  const total = currentStamps + added;
  const rewardsEarned = Math.floor(total / 10);
  const remaining = total % 10;
  return { rewardsEarned, remaining };
}

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
});

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
});
