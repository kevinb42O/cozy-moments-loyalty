import { describe, expect, it } from 'vitest';
import { applyLegacyWebsiteGroupsToDrinkMenuSections, normalizeDrinkMenuSections, serializeDrinkMenuSections } from '../shared/lib/drink-menu';

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

  it('can import legacy website subtitle groups for known sections', () => {
    const sections = normalizeDrinkMenuSections([
      {
        id: 'section-01-koffie-choco-melk',
        sectionCode: '01',
        title: 'Koffie, Choco & Melk',
        isVisible: true,
        items: [
          { id: 'koffie', name: 'Koffie*', price: '€ 3,10', details: '', isVisible: true },
          { id: 'espresso', name: 'Espresso', price: '€ 2,90', details: '', isVisible: true },
          { id: 'iced-coffee', name: 'Iced Coffee', price: '€ 6,00', details: '', isVisible: true },
        ],
      },
    ]);

    const migrated = applyLegacyWebsiteGroupsToDrinkMenuSections(sections);

    expect(migrated[0].groups).toEqual([
      {
        id: 'section-01-koffie-choco-melk-group-koffie-klassiekers',
        title: 'Koffie klassiekers',
        itemIds: ['koffie', 'espresso'],
      },
      {
        id: 'section-01-koffie-choco-melk-group-iced-coffee-smaken',
        title: 'Iced coffee & smaken',
        itemIds: ['iced-coffee'],
      },
    ]);
  });
});
