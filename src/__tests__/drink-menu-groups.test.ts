import { describe, expect, it } from 'vitest';
import { normalizeDrinkMenuSections, serializeDrinkMenuSections } from '../shared/lib/drink-menu';

describe('drink menu groups', () => {
  it('normalizes groups and removes invalid or duplicate item references', () => {
    const normalized = normalizeDrinkMenuSections([
      {
        id: 'section-1',
        sectionCode: '01',
        title: 'Koffie',
        isVisible: true,
        items: [
          { id: 'espresso', name: 'Espresso', price: '€ 3,20', details: '', isVisible: true },
          { id: 'latte', name: 'Latte', price: '€ 4,00', details: '', isVisible: true },
        ],
        groups: [
          { id: 'group-a', title: 'Klassiek', itemIds: ['espresso', 'ghost-item'] },
          { id: 'group-b', title: 'Melk', itemIds: ['espresso', 'latte'] },
        ],
      },
    ]);

    expect(normalized[0].groups).toEqual([
      { id: 'group-a', title: 'Klassiek', itemIds: ['espresso'] },
      { id: 'group-b', title: 'Melk', itemIds: ['latte'] },
    ]);
  });

  it('serializes groups when present', () => {
    const serialized = serializeDrinkMenuSections([
      {
        id: 'section-1',
        sectionCode: '01',
        title: 'Koffie',
        isVisible: true,
        items: [{ id: 'espresso', name: 'Espresso', price: '€ 3,20', details: '', isVisible: true }],
        groups: [{ id: 'group-a', title: 'Klassiek', itemIds: ['espresso'] }],
      },
    ]);

    expect(serialized[0].groups).toEqual([{ id: 'group-a', title: 'Klassiek', itemIds: ['espresso'] }]);
  });
});
