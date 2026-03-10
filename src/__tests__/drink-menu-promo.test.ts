import { describe, expect, it } from 'vitest';
import {
  createDefaultDrinkMenuSections,
  getAutomaticPromoDrinkMenuItemIds,
  type DrinkMenuSection,
} from '../shared/lib/drink-menu';

describe('getAutomaticPromoDrinkMenuItemIds', () => {
  it('returns the curated glass item for a known open bottle promo', () => {
    const sections = createDefaultDrinkMenuSections();

    expect(
      getAutomaticPromoDrinkMenuItemIds(sections, 'champagne-charles-latour', 'Champagne Charles Latour Glas')
    ).toEqual(['charles-latour-glas']);
  });

  it('matches renamed glass items but excludes bottle-only items', () => {
    const sections: DrinkMenuSection[] = [
      {
        id: 'custom-section',
        sectionCode: '99',
        title: 'Test',
        isVisible: true,
        items: [
          { id: 'promo-glass', name: 'Charles Latour per glas', price: '€ 12,50', details: '', isVisible: true },
          { id: 'promo-bottle', name: 'Charles Latour Fles', price: '€ 62,00', details: '', isVisible: true },
        ],
      },
    ];

    expect(
      getAutomaticPromoDrinkMenuItemIds(sections, 'champagne-charles-latour', 'Champagne Charles Latour Glas')
    ).toEqual(['promo-glass']);
  });

  it('returns multiple curated coffee items for lactosevrije melk', () => {
    const sections = createDefaultDrinkMenuSections();

    expect(
      getAutomaticPromoDrinkMenuItemIds(sections, 'lactosevrije-melk', 'Lactosevrije melk')
    ).toEqual([
      'cappuccino-melkschuim',
      'cappuccino-slagroom',
      'latte-macchiato',
      'koffie-verkeerd',
    ]);
  });
});
