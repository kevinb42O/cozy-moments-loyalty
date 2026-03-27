export interface DrinkMenuItem {
  id: string;
  name: string;
  price: string;
  details: string;
  isVisible: boolean;
}

export interface ActivePromo {
  productId: string;
  promoMessage: string;
  drinkMenuItemIds: string[];
}

export const MAX_ACTIVE_PROMOS = 3;

export interface DrinkMenuSection {
  id: string;
  sectionCode: string;
  title: string;
  isVisible: boolean;
  items: DrinkMenuItem[];
}

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function cloneItem(item: DrinkMenuItem): DrinkMenuItem {
  return {
    id: item.id,
    name: item.name,
    price: item.price,
    details: item.details,
    isVisible: item.isVisible,
  };
}

function cloneSection(section: DrinkMenuSection): DrinkMenuSection {
  return {
    id: section.id,
    sectionCode: section.sectionCode,
    title: section.title,
    isVisible: section.isVisible,
    items: section.items.map(cloneItem),
  };
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeBoolean(value: unknown, fallback = true) {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeItem(raw: unknown, index: number): DrinkMenuItem {
  const candidate = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};

  return {
    id: normalizeText(candidate.id) || `drink-item-${index + 1}`,
    name: normalizeText(candidate.name),
    price: normalizeText(candidate.price),
    details: normalizeText(candidate.details),
    isVisible: normalizeBoolean(candidate.isVisible, true),
  };
}

function normalizeSection(raw: unknown, index: number): DrinkMenuSection {
  const candidate = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};

  return {
    id: normalizeText(candidate.id) || `drink-section-${index + 1}`,
    sectionCode: normalizeText(candidate.sectionCode),
    title: normalizeText(candidate.title) || `Nieuwe sectie ${index + 1}`,
    isVisible: normalizeBoolean(candidate.isVisible, true),
    items: Array.isArray(candidate.items)
      ? candidate.items.map((item, itemIndex) => normalizeItem(item, itemIndex))
      : [],
  };
}

const DEFAULT_DRINK_MENU_SECTIONS: DrinkMenuSection[] = [
  {
    id: 'section-01-koffie-choco-melk',
    sectionCode: '01',
    title: 'Koffie, Choco & Melk',
    isVisible: true,
    items: [
      { id: 'koffie', name: 'Koffie*', price: '€ 3,10', details: '', isVisible: true },
      { id: 'deca', name: 'Deca*', price: '€ 3,30', details: '', isVisible: true },
      { id: 'espresso', name: 'Espresso', price: '€ 2,90', details: '', isVisible: true },
      { id: 'dubbele-espresso', name: 'Dubbele Espresso', price: '€ 3,90', details: '', isVisible: true },
      { id: 'americano', name: 'Americano', price: '€ 3,20', details: '', isVisible: true },
      { id: 'cappuccino-melkschuim', name: 'Cappuccino Melkschuim*', price: '€ 3,50', details: '', isVisible: true },
      { id: 'cappuccino-slagroom', name: 'Cappuccino Slagroom', price: '€ 3,90', details: '', isVisible: true },
      { id: 'latte-macchiato', name: 'Latte Macchiato*', price: '€ 4,10', details: '', isVisible: true },
      { id: 'koffie-verkeerd', name: 'Koffie Verkeerd*', price: '€ 4,10', details: '', isVisible: true },
      { id: 'iced-coffee', name: 'Iced Coffee', price: '€ 6,00', details: '', isVisible: true },
      { id: 'iced-coffee-slagroom', name: '+ Slagroom', price: '€ 0,80', details: '', isVisible: true },
      { id: 'hazelnootsiroop', name: '+ Hazelnootsiroop', price: '€ 0,60', details: '', isVisible: true },
      { id: 'caramelsiroop', name: '+ Caramelsiroop', price: '€ 0,60', details: '', isVisible: true },
      { id: 'speculoossiroop', name: '+ Speculoossiroop', price: '€ 0,60', details: '', isVisible: true },
      { id: 'vanillesiroop', name: '+ Vanillesiroop', price: '€ 0,60', details: '', isVisible: true },
      { id: 'witte-chocoladesiroop', name: '+ Witte Chocoladesiroop', price: '€ 0,60', details: '', isVisible: true },
      { id: 'creme-brulee-siroop', name: '+ Creme Brulee siroop', price: '€ 0,60', details: '', isVisible: true },
      { id: 'chocolate-cookie-siroop', name: '+ Chocolate Cookie siroop', price: '€ 0,60', details: '', isVisible: true },
      { id: 'amaretto-siroop', name: '+ Amaretto Siroop (0% alcohol)', price: '€ 0,60', details: '', isVisible: true },
      { id: 'italian-coffee', name: 'Italian Coffee (Amaretto)', price: '€ 9,50', details: '', isVisible: true },
      { id: 'french-coffee', name: 'French Coffee (Cointreau)', price: '€ 9,50', details: '', isVisible: true },
      { id: 'spanish-coffee', name: 'Spanish Coffee (Licor 43)', price: '€ 9,50', details: '', isVisible: true },
      { id: 'irish-coffee', name: 'Irish Coffee (Irish Whiskey)', price: '€ 9,50', details: '', isVisible: true },
      { id: 'espresso-martini', name: 'Espresso Martini', price: '€ 9,50', details: '', isVisible: true },
      { id: 'warme-hotcemel', name: 'Warme Hotcemel', price: '€ 3,50', details: '', isVisible: true },
      { id: 'warme-cecemel', name: 'Warme Cecemel', price: '€ 4,00', details: '', isVisible: true },
      { id: 'warme-chocolademelk-baru', name: 'Warme Chocolademelk Baru', price: '€ 5,00', details: '', isVisible: true },
      { id: 'warme-melk-callebaut', name: 'Warme Melk + Callebaut Chocolade*', price: '€ 6,90', details: '', isVisible: true },
      { id: 'warme-melk-slagroom', name: '+ Slagroom', price: '€ 0,80', details: '', isVisible: true },
      { id: 'mini-marshmallows', name: '+ Mini Marshmallows', price: '€ 1,00', details: '', isVisible: true },
      { id: 'warme-melk-amaretto', name: '+ Amaretto', price: '€ 5,00', details: '', isVisible: true },
      { id: 'warme-melk-baileys', name: '+ Baileys', price: '€ 5,00', details: '', isVisible: true },
      { id: 'warme-melk-donkere-rum', name: '+ Donkere Rum', price: '€ 5,00', details: '', isVisible: true },
      { id: 'warme-melk-cointreau', name: '+ Cointreau', price: '€ 5,00', details: '', isVisible: true },
      { id: 'warme-melk-grand-marnier', name: '+ Grand Marnier', price: '€ 5,00', details: '', isVisible: true },
      { id: 'warme-melk-bourbon', name: '+ Bourbon', price: '€ 5,00', details: '', isVisible: true },
      { id: 'cecemel-koud', name: 'Cecemel (koud)', price: '€ 3,00', details: '', isVisible: true },
      { id: 'fristi', name: 'Fristi', price: '€ 3,00', details: '', isVisible: true },
      { id: 'melk', name: 'Melk*', price: '€ 2,80', details: '*ook verkrijgbaar met lactosevrije melk', isVisible: true },
    ],
  },
  {
    id: 'section-02-thee-chai-matcha',
    sectionCode: '02',
    title: 'Thee, Chai & Matcha',
    isVisible: true,
    items: [
      { id: 'earl-grey', name: 'Earl Grey', price: '€ 3,60', details: '', isVisible: true },
      { id: 'sencha-lemon', name: 'Sencha Lemon', price: '€ 3,60', details: '', isVisible: true },
      { id: 'fruity-forest', name: 'Fruity Forest', price: '€ 3,60', details: '', isVisible: true },
      { id: 'ruby-rooibos', name: 'Ruby Rooibos', price: '€ 3,60', details: '', isVisible: true },
      { id: 'champaign-all-day', name: 'Champaign All Day', price: '€ 3,60', details: '', isVisible: true },
      { id: 'sea-of-blossoms', name: 'Sea of Blossoms', price: '€ 3,60', details: '', isVisible: true },
      { id: 'subtiele-munt', name: 'Subtiele Munt Thee', price: '€ 3,60', details: '', isVisible: true },
      { id: 'kamille-linde', name: 'Kamille Linde Thee', price: '€ 3,60', details: '', isVisible: true },
      { id: 'rozenbottel', name: 'Rozenbottel Thee', price: '€ 3,60', details: '', isVisible: true },
      { id: 'vanille-chai-latte', name: 'Vanille Chai Latte Baru', price: '€ 5,00', details: '', isVisible: true },
      { id: 'spiced-chai-latte', name: 'Spiced Chai Latte Baru', price: '€ 5,00', details: '', isVisible: true },
      { id: 'pumpkin-spiced-latte', name: 'Pumpkin Spiced Latte Baru', price: '€ 5,00', details: '', isVisible: true },
      { id: 'pink-chai-latte', name: 'Pink Chai Latte Baru', price: '€ 5,00', details: '', isVisible: true },
      { id: 'matcha-latte', name: 'Matcha Latte Baru', price: '€ 5,00', details: '', isVisible: true },
      { id: 'premium-matcha-latte', name: 'Premium Matcha Latte*', price: '€ 6,00', details: '', isVisible: true },
      { id: 'ceremonial-matcha-latte', name: 'Ceremonial Matcha Latte*', price: '€ 7,50', details: '', isVisible: true },
      { id: 'iced-premium-matcha-latte', name: 'Iced Premium Matcha Latte*', price: '€ 6,50', details: '', isVisible: true },
      { id: 'iced-ceremonial-matcha-latte', name: 'Iced Ceremonial Matcha Latte*', price: '€ 8,00', details: '', isVisible: true },
      { id: 'raspberry', name: '+ Raspberry', price: '€ 0,60', details: '', isVisible: true },
      { id: 'strawberry', name: '+ Strawberry', price: '€ 0,60', details: '', isVisible: true },
      { id: 'mango', name: '+ Mango', price: '€ 0,60', details: '', isVisible: true },
    ],
  },
  {
    id: 'section-03-smoothie',
    sectionCode: '03',
    title: 'Smoothie',
    isVisible: true,
    items: [
      { id: 'berry-cherry', name: 'Berry Cherry', price: '€ 6,50', details: 'kers, banaan, aardbei, zwarte bes', isVisible: true },
      { id: 'pineapple-sunset', name: 'Pineapple Sunset', price: '€ 6,50', details: 'ananas, papaya, mango', isVisible: true },
      { id: 'strawberry-fantasy', name: 'Strawberry Fantasy', price: '€ 6,50', details: 'aardbei, banaan', isVisible: true },
      { id: 'coconut-crush', name: 'Coconut Crush', price: '€ 6,50', details: 'ananas, kokosmelk', isVisible: true },
    ],
  },
  {
    id: 'section-04-waters-fruitsappen',
    sectionCode: '04',
    title: 'Waters & Fruitsappen',
    isVisible: true,
    items: [
      { id: 'chaudfontaine-plat', name: 'Chaudfontaine Plat 250 ml', price: '€ 3,00', details: '', isVisible: true },
      { id: 'chaudfontaine-bruis', name: 'Chaudfontaine Bruis 250 ml', price: '€ 3,00', details: '', isVisible: true },
      { id: 'perrier', name: 'Perrier', price: '€ 3,50', details: '', isVisible: true },
      { id: 'muntsiroop', name: '+ Muntsiroop', price: '€ 0,60', details: '', isVisible: true },
      { id: 'grenadine', name: '+ Grenadine', price: '€ 0,60', details: '', isVisible: true },
      { id: 'cassis', name: '+ Cassis', price: '€ 0,60', details: '', isVisible: true },
      { id: 'sinaasappel', name: 'Minute Maid Sinaasappel', price: '€ 3,10', details: '', isVisible: true },
      { id: 'appel', name: 'Minute Maid Appel', price: '€ 3,10', details: '', isVisible: true },
      { id: 'appel-kers', name: 'Minute Maid Appel-Kers', price: '€ 3,10', details: '', isVisible: true },
      { id: 'tomaat', name: 'Minute Maid Tomaat', price: '€ 3,10', details: '', isVisible: true },
    ],
  },
  {
    id: 'section-05-verfrissende-dranken',
    sectionCode: '05',
    title: 'Verfrissende Dranken',
    isVisible: true,
    items: [
      { id: 'coca-cola', name: 'Coca Cola', price: '€ 3,00', details: '', isVisible: true },
      { id: 'coca-cola-zero', name: 'Coca Cola Zero', price: '€ 3,00', details: '', isVisible: true },
      { id: 'fanta', name: 'Fanta', price: '€ 3,00', details: '', isVisible: true },
      { id: 'sprite', name: 'Sprite', price: '€ 3,00', details: '', isVisible: true },
      { id: 'gini', name: 'Gini', price: '€ 3,00', details: '', isVisible: true },
      { id: 'redbull', name: 'Redbull', price: '€ 4,00', details: '', isVisible: true },
      { id: 'lipton-original', name: 'Lipton Ice Tea Original', price: '€ 3,00', details: '', isVisible: true },
      { id: 'lipton-green', name: 'Lipton Ice Tea Green', price: '€ 3,00', details: '', isVisible: true },
      { id: 'lipton-peach', name: 'Lipton Ice Tea Peach', price: '€ 3,00', details: '', isVisible: true },
      { id: 'fuze-mango', name: 'Fuze Tea Mango Chamomile', price: '€ 3,00', details: '', isVisible: true },
      { id: 'fuze-sparkling', name: 'Fuze Tea Sparkling Lemon', price: '€ 3,00', details: '', isVisible: true },
      { id: 'fuze-peach', name: 'Fuze Tea Peach Hibiscus', price: '€ 3,00', details: '', isVisible: true },
      { id: 'tonissteiner-orange', name: 'Tonissteiner Orange', price: '€ 3,20', details: '', isVisible: true },
      { id: 'tonissteiner-citroen', name: 'Tonissteiner Citroen', price: '€ 3,20', details: '', isVisible: true },
      { id: 'tonissteiner-vruchtenkorf', name: 'Tonissteiner Vruchtenkorf', price: '€ 3,20', details: '', isVisible: true },
      { id: 'tonissteiner-naranja', name: 'Tonissteiner Naranja', price: '€ 3,20', details: '', isVisible: true },
      { id: 'tonissteiner-exotic-fit', name: 'Tonissteiner Exotic Fit', price: '€ 3,20', details: '', isVisible: true },
      { id: 'tonissteiner-agrumes-fit', name: 'Tonissteiner Agrumes Fit', price: '€ 3,20', details: '', isVisible: true },
      { id: 'tonissteiner-lemon-ginger-fit', name: 'Tonissteiner Lemon-Ginger Fit', price: '€ 3,20', details: '', isVisible: true },
      { id: 'schweppes-tonic', name: 'Schweppes Tonic', price: '€ 3,00', details: '', isVisible: true },
      { id: 'schweppes-tonic-zero', name: 'Schweppes Tonic Zero', price: '€ 3,00', details: '', isVisible: true },
      { id: 'schweppes-soda', name: 'Schweppes Soda Water', price: '€ 3,00', details: '', isVisible: true },
      { id: 'schweppes-agrum', name: 'Schweppes Agrum', price: '€ 3,00', details: '', isVisible: true },
      { id: 'royal-bliss-agrumes', name: 'Royal Bliss Agrumes & Ylang Ylang', price: '€ 3,20', details: '', isVisible: true },
      { id: 'royal-bliss-bitter-lemon', name: 'Royal Bliss Bitter Lemon', price: '€ 3,20', details: '', isVisible: true },
      { id: 'royal-bliss-pink', name: 'Royal Bliss Pink Aromatic Berry', price: '€ 3,20', details: '', isVisible: true },
      { id: 'fever-tree-premium', name: 'Fever Tree Premium', price: '€ 4,00', details: '', isVisible: true },
      { id: 'fever-tree-mediterranean', name: 'Fever Tree Mediterranean', price: '€ 4,00', details: '', isVisible: true },
      { id: 'fever-tree-elderflower', name: 'Fever Tree Elderflower', price: '€ 4,00', details: '', isVisible: true },
      { id: 'fever-tree-ginger-beer', name: 'Fever Tree Ginger Beer', price: '€ 4,00', details: '', isVisible: true },
      { id: 'fever-tree-ginger-ale', name: 'Fever Tree Ginger Ale', price: '€ 4,00', details: '', isVisible: true },
    ],
  },
  {
    id: 'section-06-bieren',
    sectionCode: '06',
    title: 'Bieren',
    isVisible: true,
    items: [
      { id: 'stella-25', name: 'Stella 25 cl | 5,2%', price: '€ 2,80', details: '', isVisible: true },
      { id: 'stella-33', name: 'Stella 33 cl | 5,2%', price: '€ 3,30', details: '', isVisible: true },
      { id: 'stella-50', name: 'Stella 50 cl | 5,2%', price: '€ 5,40', details: '', isVisible: true },
      { id: 'jupiler-25', name: 'Jupiler 25 cl | 5,2%', price: '€ 2,80', details: '', isVisible: true },
      { id: 'jupiler-33', name: 'Jupiler 33 cl | 5,2%', price: '€ 3,30', details: '', isVisible: true },
      { id: 'jupiler-50', name: 'Jupiler 50 Cl | 5,2%', price: '€ 5,40', details: '', isVisible: true },
      { id: 'duvel', name: 'Duvel | 8,5%', price: '€ 5,00', details: '', isVisible: true },
      { id: 'omer', name: 'Omer | 8%', price: '€ 5,00', details: '', isVisible: true },
      { id: 'leffe-blond', name: 'Leffe Blond | 6,6%', price: '€ 4,00', details: '', isVisible: true },
      { id: 'leffe-bruin', name: 'Leffe Bruin | 6,5%', price: '€ 4,00', details: '', isVisible: true },
      { id: 'liefmans-fruitesse', name: 'Liefmans Fruitesse | 3,8%', price: '€ 3,50', details: '', isVisible: true },
      { id: 'liefmans-peach', name: 'Liefmans Peach', price: '€ 3,50', details: '', isVisible: true },
      { id: 'hoegaarden-wit', name: 'Hoegaarden Wit | 4,9%', price: '€ 3,50', details: '', isVisible: true },
      { id: 'hoegaarden-rosee', name: 'Hoegaarden Rosee | 3%', price: '€ 3,50', details: '', isVisible: true },
      { id: 'lindemans-framboise', name: 'Lindemans Framboise | 2,5%', price: '€ 4,00', details: '', isVisible: true },
      { id: 'lindemans-apple', name: 'Lindemans Apple | 3,5%', price: '€ 5,00', details: '', isVisible: true },
      { id: 'kasteel-rouge', name: 'Kasteel Rouge | 8%', price: '€ 5,00', details: '', isVisible: true },
      { id: 'kasteel-tripel', name: 'Kasteel Tripel | 11%', price: '€ 5,00', details: '', isVisible: true },
      { id: 'kasteel-tropical', name: 'Kasteel Tropical | 7%', price: '€ 5,00', details: '', isVisible: true },
      { id: 'keyte-oostendse-tripel', name: 'Keyte Oostendse Tripel', price: '€ 4,50', details: '', isVisible: true },
      { id: 'keyte-dobbel-tripel', name: 'Keyte-Dobbel-Tripel', price: '€ 4,50', details: '', isVisible: true },
      { id: 'rodenbach-classic', name: 'Rodenbach Classic | 5,2%', price: '€ 3,50', details: '', isVisible: true },
      { id: 'chimay-blauw', name: 'Chimay Blauw | 9%', price: '€ 5,00', details: '', isVisible: true },
      { id: 'brugse-zot', name: 'Brugse Zot | 6%', price: '€ 5,00', details: '', isVisible: true },
      { id: 'tripel-danvers', name: "Tripel d'Anvers | 8%", price: '€ 5,00', details: '', isVisible: true },
      { id: 'westmalle-tripel', name: 'Westmalle Tripel | 9,5%', price: '€ 5,00', details: '', isVisible: true },
      { id: 'westmalle-dubbel', name: 'Westmalle Dubbel | 7%', price: '€ 5,00', details: '', isVisible: true },
      { id: 'gouden-carolus-classic', name: 'Gouden Carolus Classic | 8,5%', price: '€ 5,00', details: '', isVisible: true },
      { id: 'gouden-carolus-tripel', name: 'Gouden Carolus Tripel | 9%', price: '€ 5,00', details: '', isVisible: true },
      { id: 'gouden-carolus-whisky', name: 'Gouden Carolus Whisky Infused | 11,7%', price: '€ 5,00', details: '', isVisible: true },
      { id: 'carlsberg', name: 'Carlsberg | 5%', price: '€ 3,50', details: '', isVisible: true },
      { id: 'orval', name: 'Orval | 6,2%', price: '€ 5,00', details: '', isVisible: true },
      { id: 'cornet-oaked', name: 'Cornet Oaked | 8,5%', price: '€ 5,00', details: '', isVisible: true },
      { id: 'vedett-extra-white', name: 'Vedett Extra White | 4,7%', price: '€ 4,00', details: '', isVisible: true },
      { id: 'vedett-extra-pilsner', name: 'Vedett Extra Pilsner | 5,2%', price: '€ 4,00', details: '', isVisible: true },
      { id: 'coast-blond', name: 'Coast Blond | 7%', price: '€ 5,00', details: '', isVisible: true },
      { id: 'coast-dark', name: 'Coast Dark | 8%', price: '€ 5,00', details: '', isVisible: true },
      { id: 'boon-oude-geuze-25', name: 'Boon Oude Geuze 25cl | 7%', price: '€ 4,00', details: '', isVisible: true },
      { id: 'boon-kriek-25', name: 'Boon Kriek 25cl | 4%', price: '€ 5,00', details: '', isVisible: true },
      { id: 'boon-framboise-25', name: 'Boon Framboise 25cl | 5%', price: '€ 5,00', details: '', isVisible: true },
      { id: 'boon-oude-geuze-375', name: 'Boon Oude Geuze 37,5cl | 7%', price: '€ 6,00', details: '', isVisible: true },
      { id: 'boon-kriek-375', name: 'Boon Kriek 37,5cl | 4%', price: '€ 9,50', details: '', isVisible: true },
      { id: 'duivelsbier-wild', name: 'Duivelsbier Wild | 6,3%', price: '€ 8,00', details: '', isVisible: true },
      { id: 'duivelsbier-donker', name: 'Duivelsbier Donker | 8%', price: '€ 7,00', details: '', isVisible: true },
    ],
  },
  {
    id: 'section-07-witte-wijn',
    sectionCode: '07',
    title: 'Witte Wijn',
    isVisible: true,
    items: [
      { id: 'les-rochettes-wit-glas', name: 'Les Rochettes Wit', price: '€ 5,50', details: '', isVisible: true },
      { id: 'les-rochettes-wit-fles', name: 'Les Rochettes Wit (Fles)', price: '€ 24,00', details: '', isVisible: true },
      { id: 'les-silex-glas', name: 'Les Silex Sauvignon', price: '€ 8,00', details: '', isVisible: true },
      { id: 'les-silex-fles', name: 'Les Silex Sauvignon (Fles)', price: '€ 34,00', details: '', isVisible: true },
      { id: 'no-excuse-glas', name: 'No Excuse Chardonnay', price: '€ 7,00', details: '', isVisible: true },
      { id: 'no-excuse-fles', name: 'No Excuse Chardonnay (Fles)', price: '€ 32,00', details: '', isVisible: true },
      { id: 'macon-chardonnay', name: 'Macon-Chardonnay', price: '€ 42,00', details: '', isVisible: true },
      { id: 'weingut-keth-riesling', name: 'Weingut Keth Riesling', price: '€ 34,00', details: '', isVisible: true },
      { id: 'moelleux-glas', name: 'Terroir et Vignobles Moelleux | zoet', price: '€ 7,00', details: '', isVisible: true },
      { id: 'moelleux-fles', name: 'Terroir et Vignobles Moelleux | zoet (Fles)', price: '€ 34,00', details: '', isVisible: true },
    ],
  },
  {
    id: 'section-08-rode-wijn',
    sectionCode: '08',
    title: 'Rode Wijn',
    isVisible: true,
    items: [
      { id: 'les-rochettes-rood-glas', name: 'Les Rochettes Rood Glas', price: '€ 5,50', details: '', isVisible: true },
      { id: 'les-rochettes-rood-fles', name: 'Les Rochettes Rood Fles', price: '€ 24,00', details: '', isVisible: true },
      { id: 'pure-altitude-pinot-noir', name: 'Pure Altitude Pinot Noir Fles', price: '€ 32,00', details: '', isVisible: true },
      { id: 'lornano-le-bandito', name: 'Lornano Le Bandito Chianti Fles', price: '€ 49,00', details: '', isVisible: true },
      { id: 'domaine-vierge-romaine', name: 'Domaine de la Vierge Romaine', price: '€ 48,00', details: '', isVisible: true },
      { id: 'chateau-peyreau', name: 'Chateau Peyreau', price: '€ 50,00', details: '', isVisible: true },
      { id: 'chateau-peyreau-half', name: 'Chateau Peyreau 1/2 Fles', price: '€ 29,00', details: '', isVisible: true },
      { id: 'chateau-peyreau-magnum', name: 'Chateau Peyreau Magnum', price: '€ 98,00', details: '', isVisible: true },
    ],
  },
  {
    id: 'section-09-rose-wijn',
    sectionCode: '09',
    title: 'Rose Wijn',
    isVisible: true,
    items: [
      { id: 'gris-blanc-rose', name: 'Gris Blanc Rose Glas', price: '€ 5,50', details: '', isVisible: true },
      { id: 'les-rochettes-rose-glas', name: 'Les Rochettes Rose Glas', price: '€ 5,50', details: '', isVisible: true },
      { id: 'les-rochettes-rose-fles', name: 'Les Rochettes Rose Fles', price: '€ 24,00', details: '', isVisible: true },
      { id: 'altes-rose-glas', name: "Altes L'Espontania Rose Glas", price: '€ 8,50', details: '', isVisible: true },
      { id: 'altes-rose-fles', name: "Altes L'Espontania Rose Fles", price: '€ 35,00', details: '', isVisible: true },
      { id: 'font-vive-rose', name: 'Chateau de Font Vive Rose Fles', price: '€ 49,00', details: '', isVisible: true },
    ],
  },
  {
    id: 'section-10-bubbels',
    sectionCode: '10',
    title: 'Bubbels',
    isVisible: true,
    items: [
      { id: 'cava-brisa-glas', name: 'Cava Brisa Nova Glas', price: '€ 8,50', details: '', isVisible: true },
      { id: 'cava-brisa-fles', name: 'Cava Brisa Nova Fles', price: '€ 35,00', details: '', isVisible: true },
      { id: 'charles-latour-glas', name: 'Champagne Charles Latour Glas', price: '€ 12,50', details: '', isVisible: true },
      { id: 'charles-latour-fles', name: 'Champagne Charles Latour Fles', price: '€ 62,00', details: '', isVisible: true },
      { id: 'barbichon', name: 'Champagne Barbichon', price: 'Op aanvraag', details: '', isVisible: true },
      { id: 'vranken-fles', name: 'Champagne Vranken Fles', price: '€ 49,00', details: '', isVisible: true },
    ],
  },
  {
    id: 'section-11-alcoholvrij',
    sectionCode: '11',
    title: '0,0 Alcohol',
    isVisible: true,
    items: [
      { id: 'stella-00', name: 'Stella 0,0', price: '€ 2,80', details: '', isVisible: true },
      { id: 'liefmans-fruitesse-00', name: 'Liefmans Fruitesse 0,0', price: '€ 3,50', details: '', isVisible: true },
      { id: 'liefmans-peach-00', name: 'Liefmans Peach 0,0', price: '€ 3,50', details: '', isVisible: true },
      { id: 'lindemans-kriek-00', name: 'Lindemans kriek 0,0', price: '€ 4,00', details: '', isVisible: true },
      { id: 'lindemans-pecheresse-00', name: 'Lindemans Pecheresse 0,0', price: '€ 4,00', details: '', isVisible: true },
      { id: 'coast-zero', name: 'Coast Zero', price: '€ 5,00', details: '', isVisible: true },
      { id: 'carlsberg-00', name: 'Carlsberg 0,0', price: '€ 3,40', details: '', isVisible: true },
      { id: 'sport-zot', name: 'Sport Zot Alcoholvrij', price: '€ 4,50', details: '', isVisible: true },
      { id: 'kasteelbier-rouge-00', name: 'Kasteelbier Rouge 0,0', price: '€ 5,00', details: '', isVisible: true },
      { id: 'kasteelbier-tropical-00', name: 'Kasteelbier Tropical 0,0', price: '€ 5,00', details: '', isVisible: true },
      { id: 'leffe-00', name: 'Leffe Blond/Bruin 0,0', price: '€ 4,00', details: '', isVisible: true },
      { id: 'hoegaarden-citrus-00', name: 'Hoegaarden Citrus 0,0', price: '€ 3,50', details: '', isVisible: true },
      { id: 'tripel-karmeliet-00', name: 'Tripel Karmeliet Alcoholvrij', price: '€ 4,50', details: '', isVisible: true },
      { id: 'keth-pinot-blanc-00', name: 'Keth Pinot Blanc 0,0', price: '€ 7,00', details: '', isVisible: true },
      { id: 'divin-pinot-noir-00', name: 'Divin Pinot Noir 0,0', price: '€ 7,00', details: '', isVisible: true },
      { id: 'virgin-mojito', name: 'Virgin Mojito', price: '€ 9,50', details: '', isVisible: true },
      { id: 'virgin-pina-colada', name: 'Virgin Pina Colada', price: '€ 9,50', details: '', isVisible: true },
      { id: 'kidibul', name: 'Kidibul', price: '€ 5,50', details: '', isVisible: true },
      { id: 'funny-pisang-orange', name: 'Funny Pisang Orange', price: '€ 9,50', details: '', isVisible: true },
      { id: 'gordons-00', name: "Gordon's 0,0 Premium Pink Gin (inclusief tonic)", price: '€ 9,50', details: '', isVisible: true },
    ],
  },
  {
    id: 'section-12-alcoholische-sterke-dranken',
    sectionCode: '12',
    title: 'Alcoholische Sterke Dranken',
    isVisible: true,
    items: [
      { id: 'martini-bianco', name: 'Martini Bianco', price: '€ 5,50', details: '', isVisible: true },
      { id: 'martini-rosso', name: 'Martini Rosso', price: '€ 5,50', details: '', isVisible: true },
      { id: 'kir', name: 'Kir', price: '€ 6,50', details: '', isVisible: true },
      { id: 'kir-royal', name: 'Kir Royal', price: '€ 7,50', details: '', isVisible: true },
      { id: 'picon-vin-blanc', name: 'Picon Vin Blanc', price: '€ 9,00', details: '', isVisible: true },
      { id: 'rode-porto-martinez', name: 'Rode Porto Martinez', price: '€ 5,50', details: '', isVisible: true },
      { id: 'rode-porto-smith-woodhouse', name: 'Rode Porto Smith Woodhouse', price: '€ 11,00', details: '', isVisible: true },
      { id: 'rode-sherry-colosia-oloroso', name: 'Rode Sherry Colosia Oloroso', price: '€ 5,50', details: '', isVisible: true },
      { id: 'witte-porto-martinez', name: 'Witte Porto Martinez', price: '€ 5,50', details: '', isVisible: true },
      { id: 'ricard-pastis', name: 'Ricard Pastis', price: '€ 6,50', details: '', isVisible: true },
      { id: 'pineau-des-charentes', name: 'Pineau des Charentes', price: '€ 5,50', details: '', isVisible: true },
      { id: 'campari', name: 'Campari', price: '€ 6,50', details: '', isVisible: true },
      { id: 'amaretto-disaronno', name: 'Amaretto Disaronno', price: '€ 6,80', details: '', isVisible: true },
      { id: 'baileys', name: 'Baileys', price: '€ 6,80', details: '', isVisible: true },
      { id: 'cointreau', name: 'Cointreau', price: '€ 7,00', details: '', isVisible: true },
      { id: 'grand-marnier', name: 'Grand Marnier', price: '€ 7,00', details: '', isVisible: true },
      { id: 'licor-43', name: 'Licor 43', price: '€ 6,80', details: '', isVisible: true },
      { id: 'passoa', name: 'Passoa', price: '€ 6,50', details: '', isVisible: true },
      { id: 'pisang', name: 'Pisang', price: '€ 6,50', details: '', isVisible: true },
      { id: 'safari', name: 'Safari', price: '€ 6,50', details: '', isVisible: true },
      { id: 'limoncello', name: 'Limoncello', price: '€ 7,00', details: '', isVisible: true },
      { id: 'malibu', name: 'Malibu', price: '€ 6,50', details: '', isVisible: true },
      { id: 'bulldog-gin', name: 'Bulldog', price: '€ 7,50', details: '', isVisible: true },
      { id: 'hendricks-gin', name: "Hendrick's", price: '€ 8,50', details: '', isVisible: true },
      { id: 'copperhead-gin', name: 'Copperhead', price: '€ 9,50', details: '', isVisible: true },
      { id: 'gin-mare', name: 'Gin Mare', price: '€ 9,50', details: '', isVisible: true },
      { id: 'gin-mare-capri', name: 'Gin Mare Capri', price: '€ 12,00', details: '', isVisible: true },
      { id: 'tanqueray', name: 'Tanqueray', price: '€ 7,50', details: '', isVisible: true },
      { id: 'fever-tree-supplement', name: '+ Fever Tree', price: '€ 3,50', details: '', isVisible: true },
      { id: 'martell', name: 'Martell', price: '€ 8,00', details: '', isVisible: true },
      { id: 'bisquit-dubouche', name: 'Bisquit & Dubouché', price: '€ 8,00', details: '', isVisible: true },
      { id: 'eristoff', name: 'Eristoff', price: '€ 6,50', details: '', isVisible: true },
      { id: 'eristoff-red', name: 'Eristoff Red', price: '€ 6,50', details: '', isVisible: true },
      { id: 'eristoff-passion', name: 'Eristoff Passion', price: '€ 6,50', details: '', isVisible: true },
      { id: 'au-vodka-blue-raspberry', name: 'AU vodka Blue Raspberry', price: '€ 8,00', details: 'Aanrader: met Sprite', isVisible: true },
      { id: 'au-vodka-pink-lemonade', name: 'AU vodka Pink Lemonade', price: '€ 8,00', details: 'Aanrader: met Sprite', isVisible: true },
      { id: 'grey-goose', name: 'Grey Goose', price: '€ 9,50', details: '', isVisible: true },
      { id: 'johnnie-walker-red', name: 'Johnnie Walker Red', price: '€ 6,50', details: '', isVisible: true },
      { id: 'johnnie-walker-black', name: 'Johnnie Walker Black', price: '€ 7,00', details: '', isVisible: true },
      { id: 'johnnie-walker-ruby', name: 'Johnnie Walker Ruby', price: '€ 7,50', details: '', isVisible: true },
      { id: 'johnnie-walker-blue-baby', name: 'Johnnie Walker Blue baby', price: '€ 15,00', details: '', isVisible: true },
      { id: 'johnnie-walker-blue', name: 'Johnnie Walker Blue', price: '€ 22,00', details: '', isVisible: true },
      { id: 'jb', name: 'J&B', price: '€ 6,50', details: '', isVisible: true },
      { id: 'glenfiddich-12', name: 'Glenfiddich 12', price: '€ 10,00', details: '', isVisible: true },
      { id: 'chivas-regal', name: 'Chivas Regal', price: '€ 7,20', details: '', isVisible: true },
      { id: 'oban', name: 'Oban', price: '€ 15,00', details: '', isVisible: true },
      { id: 'bacardi-carta-blanca', name: 'Bacardi Carta Blanca', price: '€ 6,50', details: '', isVisible: true },
      { id: 'bacardi-carta-negra', name: 'Bacardi Carta Negra', price: '€ 6,50', details: '', isVisible: true },
      { id: 'bacardi-carta-oro', name: 'Bacardi Carta Oro', price: '€ 6,50', details: '', isVisible: true },
      { id: 'bacardi-anejo-cuatro', name: 'Bacardi Añejo Cuatro', price: '€ 7,00', details: '', isVisible: true },
      { id: 'bacardi-reserva-ocho', name: 'Bacardi Reserva Ocho', price: '€ 8,50', details: '', isVisible: true },
      { id: 'havana-club-anejo-7', name: 'Havana Club Añejo 7 Años', price: '€ 9,50', details: '', isVisible: true },
      { id: 'rhum-jm-jardin-fruite', name: 'Rhum J.M. Jardin Fruité', price: '€ 10,00', details: '', isVisible: true },
      { id: 'rhum-jm-fumee-volcanique', name: 'Rhum J.M. Fumée Volcanique', price: '€ 10,00', details: '', isVisible: true },
      { id: 'kraken-black-spiced-rum', name: 'The Kraken Black Spiced Rum', price: '€ 7,00', details: '', isVisible: true },
      { id: 'sister-isles-rum', name: 'Sister Isles Rum', price: '€ 12,50', details: '', isVisible: true },
      { id: 'saint-james-royal-ambre', name: 'Saint James Royal Ambré', price: '€ 6,50', details: '', isVisible: true },
      { id: 'captain-morgan-dark-rum', name: 'Captain Morgan Dark Rum', price: '€ 6,50', details: '', isVisible: true },
      { id: 'red-rope-cocoa-rum', name: 'Red Rope Cocoa Rum', price: '€ 9,00', details: '', isVisible: true },
      { id: 'dictador-colombiana', name: 'Dictador Colombiana', price: '€ 9,50', details: '', isVisible: true },
      { id: 'diplomatico-reserva-exclusiva', name: 'Diplomatico Reserva Exclusiva', price: '€ 10,00', details: '', isVisible: true },
      { id: 'appleton-estate-signature-rum', name: 'Appleton Estate Signature Rum', price: '€ 7,00', details: '', isVisible: true },
    ],
  },
  {
    id: 'section-13-cocktails',
    sectionCode: '13',
    title: 'Cocktails',
    isVisible: true,
    items: [
      { id: 'mojito', name: 'Mojito', price: '€ 10,50', details: '', isVisible: true },
      { id: 'pornstar-martini', name: 'Pornstar Martini', price: '€ 10,50', details: '', isVisible: true },
      { id: 'negroni', name: 'Negroni', price: '€ 10,50', details: '', isVisible: true },
      { id: 'lazy-red-cheeks', name: 'Lazy Red Cheeks', price: '€ 10,50', details: '', isVisible: true },
      { id: 'aperol-spritz', name: 'Aperol Spritz', price: '€ 11,50', details: '', isVisible: true },
      { id: 'limoncello-spritz', name: 'Limoncello Spritz', price: '€ 11,50', details: '', isVisible: true },
      { id: 'sex-on-the-beach', name: 'Sex On The Beach', price: '€ 11,50', details: '', isVisible: true },
    ],
  },
];

export function createDefaultDrinkMenuSections() {
  return DEFAULT_DRINK_MENU_SECTIONS.map(cloneSection);
}

export function createEmptyDrinkMenuItem(): DrinkMenuItem {
  return {
    id: createId('drink-item'),
    name: '',
    price: '',
    details: '',
    isVisible: true,
  };
}

const OPEN_BOTTLE_PROMO_ITEM_IDS: Record<string, string[]> = {
  'champagne-charles-latour': ['charles-latour-glas'],
  'cava-brisa-nova': ['cava-brisa-glas'],
  'altes-espontania-rose': ['altes-rose-glas'],
  'les-silex-sauvignon': ['les-silex-glas'],
  'no-excuse-chardonnay': ['no-excuse-glas'],
  'terroir-moelleux': ['moelleux-glas'],
  'keth-pinot-blanc-00': ['keth-pinot-blanc-00'],
  'divin-pinot-noir-00': ['divin-pinot-noir-00'],
  'les-rochettes-wit': ['les-rochettes-wit-glas'],
  'les-rochettes-rood': ['les-rochettes-rood-glas'],
  'les-rochettes-rose': ['les-rochettes-rose-glas'],
  'gris-blanc-rose': ['gris-blanc-rose'],
  'lactosevrije-melk': ['cappuccino-melkschuim', 'cappuccino-slagroom', 'latte-macchiato', 'koffie-verkeerd'],
};

const OPEN_BOTTLE_PROMO_NAME_ALIASES: Record<string, string[]> = {
  'champagne-charles-latour': ['charles latour', 'champagne charles latour'],
  'cava-brisa-nova': ['cava brisa nova'],
  'altes-espontania-rose': ['altes l espontania rose', 'altes espontania rose'],
  'les-silex-sauvignon': ['les silex sauvignon'],
  'no-excuse-chardonnay': ['no excuse chardonnay'],
  'terroir-moelleux': ['terroir et vignobles moelleux', 'moelleux'],
  'keth-pinot-blanc-00': ['keth pinot blanc 0 0', 'pinot blanc 0 0'],
  'divin-pinot-noir-00': ['divin pinot noir 0 0', 'pinot noir 0 0'],
  'les-rochettes-wit': ['les rochettes wit'],
  'les-rochettes-rood': ['les rochettes rood'],
  'les-rochettes-rose': ['les rochettes rose', 'les rochettes rosé'],
  'gris-blanc-rose': ['gris blanc rose', 'gris blanc rosé'],
};

const PROMO_MATCH_IGNORED_TOKENS = new Set([
  'de',
  'en',
  'het',
  'met',
  'per',
  'glas',
  'onze',
  'huis',
]);

function normalizePromoMatchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function tokenizePromoMatchText(value: string) {
  return normalizePromoMatchText(value)
    .split(' ')
    .filter((token) => token.length > 1 && !PROMO_MATCH_IGNORED_TOKENS.has(token));
}

function isBottleOnlyDrinkMenuItem(itemName: string) {
  const normalizedName = normalizePromoMatchText(itemName);
  return /\b(fles|magnum)\b/.test(normalizedName) || normalizedName.includes('1 2');
}

function matchesOpenBottlePromoByName(itemName: string, productName: string, aliases: string[]) {
  if (!productName || isBottleOnlyDrinkMenuItem(itemName)) {
    return false;
  }

  const normalizedItemName = normalizePromoMatchText(itemName);
  const productTokens = new Set(tokenizePromoMatchText([productName, ...aliases].join(' ')));

  if (productTokens.size === 0) {
    return false;
  }

  const itemTokens = new Set(tokenizePromoMatchText(itemName));
  if (itemTokens.size === 0) {
    return false;
  }

  if ([productName, ...aliases].some((candidate) => normalizePromoMatchText(candidate) && normalizedItemName.includes(normalizePromoMatchText(candidate)))) {
    return true;
  }

  return Array.from(productTokens).every((token) => itemTokens.has(token));
}

export function getAutomaticPromoDrinkMenuItemIds(
  sections: DrinkMenuSection[],
  promoProductId: string | null,
  promoProductName: string | null,
) {
  if (!promoProductId) {
    return [];
  }

  const matchedItemIds = new Set<string>();
  const knownItemIds = new Set(OPEN_BOTTLE_PROMO_ITEM_IDS[promoProductId] ?? []);
  const aliases = OPEN_BOTTLE_PROMO_NAME_ALIASES[promoProductId] ?? [];

  sections.forEach((section) => {
    section.items.forEach((item) => {
      if (knownItemIds.has(item.id)) {
        matchedItemIds.add(item.id);
        return;
      }

      if (matchesOpenBottlePromoByName(item.name, promoProductName ?? '', aliases)) {
        matchedItemIds.add(item.id);
      }
    });
  });

  return Array.from(matchedItemIds);
}

export function createEmptyDrinkMenuSection(): DrinkMenuSection {
  return {
    id: createId('drink-section'),
    sectionCode: '',
    title: 'Nieuwe sectie',
    isVisible: true,
    items: [createEmptyDrinkMenuItem()],
  };
}

export function normalizeDrinkMenuSections(raw: unknown, fallback = createDefaultDrinkMenuSections()) {
  if (!Array.isArray(raw)) {
    return fallback.map(cloneSection);
  }

  return raw.map((section, index) => normalizeSection(section, index));
}

export function serializeDrinkMenuSections(sections: DrinkMenuSection[]) {
  return sections.map((section) => ({
    id: section.id,
    sectionCode: section.sectionCode,
    title: section.title,
    isVisible: section.isVisible,
    items: section.items.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      details: item.details,
      isVisible: item.isVisible,
    })),
  }));
}

export function getMultiPromoDrinkMenuItemIds(
  sections: DrinkMenuSection[],
  promos: Array<{ productId: string; productName: string }>,
): string[] {
  const allIds = new Set<string>();
  for (const promo of promos) {
    for (const id of getAutomaticPromoDrinkMenuItemIds(sections, promo.productId, promo.productName)) {
      allIds.add(id);
    }
  }
  return Array.from(allIds);
}

export function normalizeActivePromos(raw: unknown): ActivePromo[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is Record<string, unknown> => entry !== null && typeof entry === 'object' && !Array.isArray(entry))
    .filter((entry) => typeof entry.productId === 'string' && typeof entry.promoMessage === 'string')
    .slice(0, MAX_ACTIVE_PROMOS)
    .map((entry) => ({
      productId: entry.productId as string,
      promoMessage: entry.promoMessage as string,
      drinkMenuItemIds: Array.isArray(entry.drinkMenuItemIds)
        ? (entry.drinkMenuItemIds as unknown[]).filter((id): id is string => typeof id === 'string')
        : [],
    }));
}

export function serializeActivePromos(promos: ActivePromo[]) {
  return promos.map((p) => ({
    productId: p.productId,
    promoMessage: p.promoMessage,
    drinkMenuItemIds: p.drinkMenuItemIds,
  }));
}