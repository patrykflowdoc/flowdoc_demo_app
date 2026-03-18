// ============= PRODUCT TYPES =============

// Type 1: Simple Product (Patery) - just display, add to cart
export type SimpleProduct = {
  type: "simple";
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  image?: string;
  contents: string[];
  allergens: string[];
  dietaryTags: string[];
  pricePerUnit: number;
  pricePerUnitOnSite?: number | null;
  unitLabel: string;
  minQuantity: number;
  category: string;
};

// Type 2: Expandable Product (Mini) - has variants/options to choose
export type ExpandableProduct = {
  type: "expandable";
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  image?: string;
  basePrice: number;
  minQuantity: number;
  category: string;
  dietaryTags: string[];
  variants: ProductVariant[];
};

export type ProductVariant = {
  id: string;
  name: string;
  description: string;
  price: number;
  priceOnSite?: number | null;
  allergens: string[];
  dietaryTags: string[];
};

// Type 3: Configurable Set - price per person, select options from groups
export type ConfigurableProduct = {
  type: "configurable";
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  image?: string;
  pricePerPerson: number;
  pricePerPersonOnSite?: number | null;
  minPersons: number;
  category: string;
  optionGroups: OptionGroup[];
  dietaryTags: string[];
};

export type OptionGroup = {
  id: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  options: GroupOption[];
};

export type GroupOption = {
  id: string;
  name: string;
  allergens: string[];
  dietaryTags: string[];
};

export type Product = SimpleProduct | ExpandableProduct | ConfigurableProduct;

export type EventType = {
  id: string;
  name: string;
};

export type Category = {
  id: string;
  dbId?: string;
  name: string;
  description: string;
};

// ============= EVENT TYPES =============

export const eventTypes: EventType[] = [
  { id: "wedding", name: "Wesele" },
  { id: "corporate", name: "Konferencja" },
  { id: "birthday", name: "Urodziny" },
  { id: "business", name: "Spotkanie firmowe" },
  { id: "party", name: "Impreza" },
  { id: "other", name: "Inne" },
];

// ============= CATEGORIES =============

export const categories: Category[] = [
  {
    id: "patery",
    name: "Patery",
    description: "Gotowe kompozycje na każdą okazję",
  },
  {
    id: "mini",
    name: "Mini",
    description: "Małe przekąski z wieloma wariantami",
  },
  {
    id: "zestawy",
    name: "Zestawy",
    description: "Pełne menu do konfiguracji",
  },
];

// ============= PRODUCTS =============

export const products: Product[] = [
  // ===== PATERY (Simple) =====
  {
    type: "simple",
    id: "patera-serow",
    name: "Patera Serów Europejskich",
    description: "Dla 7-8 osób. W środku znajdziesz 32 pyszności.",
    longDescription: "Wyselekcjonowane sery z najlepszych europejskich serowarni. Idealna na eleganckie przyjęcia i spotkania biznesowe. Podawana na łupkowej desce z dodatkami.",
    image: "/products/patera-serow.jpg",
    contents: [
      "Brie francuski 150g",
      "Camembert z ziołami 150g", 
      "Gouda długo dojrzewająca 200g",
      "Roquefort 100g",
      "Winogrona 200g",
      "Orzechy włoskie 100g",
      "Miód akacjowy 50ml",
    ],
    allergens: ["mleko", "orzechy"],
    dietaryTags: [],
    pricePerUnit: 450,
    unitLabel: "szt.",
    minQuantity: 1,
    category: "patery",
  },
  {
    type: "simple",
    id: "patera-wedlin",
    name: "Patera Wędlin Premium",
    description: "Dla 8-10 osób. Wyselekcjonowane wędliny z całej Europy.",
    longDescription: "Ręcznie krojone wędliny najwyższej jakości z renomowanych wytwórni. Szynka parmeńska dojrzewająca 24 miesiące, autentyczne chorizo i bresaola.",
    image: "/products/patera-wedlin.jpg",
    contents: [
      "Szynka parmeńska 24-miesięczna 200g",
      "Salami Milano 150g",
      "Chorizo Iberico 150g",
      "Bresaola 100g",
      "Oliwki Kalamata 150g",
      "Grissini 12 szt.",
    ],
    allergens: ["gluten"],
    dietaryTags: [],
    pricePerUnit: 520,
    unitLabel: "szt.",
    minQuantity: 1,
    category: "patery",
  },
  {
    type: "simple",
    id: "patera-owocow-morza",
    name: "Patera Owoców Morza",
    description: "Dla 6-8 osób. Świeże owoce morza na lodzie.",
    longDescription: "Świeże owoce morza serwowane na kruszonym lodzie. Krewetki tygrysie, premium łosoś wędzony i tuńczyk sashimi grade. Udekorowane kaparami i świeżym koperkiem.",
    image: "/products/patera-owocow-morza.jpg",
    contents: [
      "Krewetki tygrysie 300g",
      "Łosoś wędzony 200g",
      "Tuńczyk sashimi 150g",
      "Kawior czerwony 50g",
      "Kapary 50g",
      "Cytryna i koperek",
    ],
    allergens: ["ryby", "skorupiaki"],
    dietaryTags: [],
    pricePerUnit: 680,
    unitLabel: "szt.",
    minQuantity: 1,
    category: "patery",
  },
  {
    type: "simple",
    id: "patera-antipasto",
    name: "Antipasto Włoskie",
    description: "Dla 6-8 osób. Smak słonecznej Italii.",
    longDescription: "Kompozycja włoskich przysmaków rodem z Toskanii. Suszone pomidory w oliwie extra virgin, mozzarella di bufala z certyfikatem DOP i świeżo pieczona focaccia z rozmarynem.",
    image: "/products/patera-antipasto.jpg",
    contents: [
      "Suszone pomidory w oliwie 150g",
      "Oliwki mix 200g",
      "Marynowane karczochy 150g",
      "Mozzarella di Bufala 250g",
      "Papryka grillowana 150g",
      "Focaccia z rozmarynem",
    ],
    allergens: ["mleko", "gluten"],
    dietaryTags: [],
    pricePerUnit: 380,
    unitLabel: "szt.",
    minQuantity: 1,
    category: "patery",
  },
  
  // ===== MINI (Expandable) =====
  {
    type: "expandable",
    id: "tacos",
    name: "Meksykańskie Tacos",
    description: "Cena bazowa: 18,00 zł/szt.",
    longDescription: "Autentyczne meksykańskie tacos na świeżych tortillach kukurydzianych. Wybierz spośród różnych nadzieniem - od klasycznego kurczaka al pastor po wegańskie opcje z grzybami.",
    image: "/products/tacos.jpg",
    basePrice: 18,
    minQuantity: 8,
    category: "mini",
    dietaryTags: [],
    variants: [
      {
        id: "tacos-kurczak",
        name: "Tacos z szarpanym kurczakiem Al Pastor",
        description: "grillowany ananas z miętą / salsa Pico De Gallo",
        price: 18,
        allergens: ["gluten"],
        dietaryTags: [],
      },
      {
        id: "tacos-wieprzowina",
        name: "Tacos z szarpaną wieprzowiną w sosie adobo",
        description: "salsa mexicana / crema / marynowana cebulka",
        price: 18,
        allergens: ["gluten", "mleko"],
        dietaryTags: [],
      },
      {
        id: "tacos-vege",
        name: "Tacos vege z boczniakiem Chipotle",
        description: "Guacamole / Salsa Pico De Gallo",
        price: 18,
        allergens: ["gluten"],
        dietaryTags: ["Vege"],
      },
      {
        id: "tacos-krewetki",
        name: "Tacos z krewetkami w tempurze",
        description: "guacamole / jalapeno / marynowana cebulka",
        price: 22,
        allergens: ["gluten", "skorupiaki"],
        dietaryTags: ["Krewetki"],
      },
    ],
  },
  {
    type: "expandable",
    id: "mini-burgery",
    name: "Mini Burgery",
    description: "Cena bazowa: 15,00 zł/szt.",
    longDescription: "Soczyste mini burgery idealne na imprezy. Ręcznie formowane kotlety z najlepszej wołowiny, świeże bułki brioche i domowe sosy.",
    image: "/products/mini-burgery.jpg",
    basePrice: 15,
    minQuantity: 10,
    category: "mini",
    dietaryTags: [],
    variants: [
      {
        id: "burger-klasyczny",
        name: "Mini Burger Klasyczny",
        description: "wołowina / cheddar / pikle / sos burgerowy",
        price: 15,
        allergens: ["gluten", "mleko"],
        dietaryTags: [],
      },
      {
        id: "burger-pulled-pork",
        name: "Mini Burger z Pulled Pork",
        description: "szarpana wieprzowina / colesław / sos BBQ",
        price: 16,
        allergens: ["gluten"],
        dietaryTags: [],
      },
      {
        id: "burger-vege",
        name: "Mini Burger Vege",
        description: "kotlet z batatów / rukola / hummus",
        price: 15,
        allergens: ["gluten", "sezam"],
        dietaryTags: ["Vege"],
      },
    ],
  },
  {
    type: "expandable",
    id: "sushi",
    name: "Sushi Selection",
    description: "Cena bazowa: 8,00 zł/szt.",
    longDescription: "Świeże sushi przygotowywane przez naszych sushi masterów. Premium ryż, najświeższe ryby i owoce morza. Idealne na eleganckie przyjęcia.",
    image: "/products/sushi.jpg",
    basePrice: 8,
    minQuantity: 16,
    category: "mini",
    dietaryTags: [],
    variants: [
      {
        id: "sushi-sake",
        name: "Nigiri Sake (łosoś)",
        description: "świeży łosoś na ryżu sushi",
        price: 8,
        allergens: ["ryby", "gluten"],
        dietaryTags: [],
      },
      {
        id: "sushi-maguro",
        name: "Nigiri Maguro (tuńczyk)",
        description: "świeży tuńczyk na ryżu sushi",
        price: 10,
        allergens: ["ryby", "gluten"],
        dietaryTags: [],
      },
      {
        id: "sushi-california",
        name: "California Roll (6 szt.)",
        description: "krab / awokado / ogórek / tobiko",
        price: 28,
        allergens: ["skorupiaki", "gluten"],
        dietaryTags: [],
      },
      {
        id: "sushi-vege-roll",
        name: "Vege Roll (6 szt.)",
        description: "awokado / ogórek / marchewka / tofu",
        price: 24,
        allergens: ["soja", "gluten"],
        dietaryTags: ["Vege"],
      },
    ],
  },
  
  // ===== ZESTAWY (Configurable) =====
  {
    type: "configurable",
    id: "zestaw-1",
    name: "Zestaw nr 1",
    description: "Minimalne zamówienie z jednego rodzaju to 12 sztuk.",
    longDescription: "Klasyczny zestaw cateringowy idealny na spotkania firmowe, konferencje i uroczystości rodzinne. Wybierz dania główne, dodatki i sałatki według własnych preferencji.",
    image: "/products/zestaw-1.jpg",
    pricePerPerson: 70,
    minPersons: 12,
    category: "zestawy",
    optionGroups: [
      {
        id: "miesa",
        name: "Mięsiwa i ryby",
        minSelections: 2,
        maxSelections: 6,
        options: [
          { id: "roladki-indyk", name: "Roladki z indyka ze szpinakiem suszonymi pomidorami i mozarellą", allergens: ["mleko"], dietaryTags: [] },
          { id: "schabowy", name: "Staropolski schabowy", allergens: ["gluten", "jaja"], dietaryTags: [] },
          { id: "pulpeciki", name: "Pulpeciki wołowo-wieprzowe w sosie grzybowym", allergens: ["gluten"], dietaryTags: [] },
          { id: "karkowka", name: "Karkówka w sosie własnym", allergens: [], dietaryTags: [] },
          { id: "kurczak-panko", name: "Filet z kurczaka w panko", allergens: ["gluten"], dietaryTags: [] },
          { id: "dorsz", name: "Dorsz w sosie cytrusowym", allergens: ["ryby"], dietaryTags: [] },
        ],
      },
      {
        id: "dodatki",
        name: "Dodatki",
        minSelections: 2,
        maxSelections: 4,
        options: [
          { id: "ziemniaki", name: "Ziemniaki opiekane z rozmarynem", allergens: [], dietaryTags: [] },
          { id: "ryz", name: "Ryż z warzywami", allergens: [], dietaryTags: [] },
          { id: "kasza", name: "Kasza gryczana", allergens: [], dietaryTags: [] },
          { id: "puree", name: "Puree ziemniaczane", allergens: ["mleko"], dietaryTags: [] },
        ],
      },
      {
        id: "salatki",
        name: "Sałatki",
        minSelections: 1,
        maxSelections: 3,
        options: [
          { id: "mizeria", name: "Mizeria", allergens: ["mleko"], dietaryTags: [] },
          { id: "surowka-marchew", name: "Surówka z marchewki", allergens: [], dietaryTags: [] },
          { id: "salatka-grecka", name: "Sałatka grecka", allergens: ["mleko"], dietaryTags: [] },
          { id: "coleslaw", name: "Colesław", allergens: ["jaja"], dietaryTags: [] },
        ],
      },
    ],
    dietaryTags: [],
  },
  {
    type: "configurable",
    id: "zestaw-2",
    name: "Zestaw nr 2 Premium",
    description: "Menu premium z wykwintnymi daniami. Minimum 15 osób.",
    longDescription: "Wykwintne menu premium dla wymagających gości. Polędwica wołowa, kaczka konfitowana, świeży łosoś - dania godne najlepszych restauracji.",
    image: "/products/zestaw-2.jpg",
    pricePerPerson: 95,
    minPersons: 15,
    category: "zestawy",
    optionGroups: [
      {
        id: "dania-glowne",
        name: "Dania główne",
        minSelections: 2,
        maxSelections: 4,
        options: [
          { id: "poledwica", name: "Polędwica wołowa z sosem z zielonym pieprzem", allergens: ["mleko"], dietaryTags: [] },
          { id: "kaczka", name: "Kaczka konfitowana z jabłkami", allergens: [], dietaryTags: [] },
          { id: "losos-grillowany", name: "Łosoś grillowany z masłem czosnkowym", allergens: ["ryby", "mleko"], dietaryTags: [] },
          { id: "risotto-truflowe", name: "Risotto z truflami (vege)", allergens: ["mleko"], dietaryTags: [] },
        ],
      },
      {
        id: "przystawki",
        name: "Przystawki",
        minSelections: 2,
        maxSelections: 3,
        options: [
          { id: "carpaccio", name: "Carpaccio z polędwicy", allergens: ["mleko"], dietaryTags: [] },
          { id: "tatar-losos", name: "Tatar z łososia z awokado", allergens: ["ryby"], dietaryTags: [] },
          { id: "bruschetta", name: "Bruschetta z pomidorami", allergens: ["gluten"], dietaryTags: [] },
        ],
      },
      {
        id: "desery-premium",
        name: "Desery",
        minSelections: 1,
        maxSelections: 2,
        options: [
          { id: "creme-brulee", name: "Crème brûlée", allergens: ["mleko", "jaja"], dietaryTags: [] },
          { id: "fondant", name: "Fondant czekoladowy", allergens: ["mleko", "jaja", "gluten"], dietaryTags: [] },
          { id: "panna-cotta", name: "Panna cotta z malinami", allergens: ["mleko"], dietaryTags: [] },
        ],
      },
    ],
    dietaryTags: [],
  },
  {
    type: "configurable",
    id: "zestaw-3",
    name: "Zestaw Wegetariański",
    description: "Pełne menu bez mięsa. Minimum 10 osób.",
    longDescription: "Kolorowe i pełne smaku menu wegetariańskie. Curry, falafel, lasagne warzywna i świeże sałatki - udowadniamy, że bez mięsa może być pysznie!",
    image: "/products/zestaw-3.jpg",
    pricePerPerson: 60,
    minPersons: 10,
    category: "zestawy",
    optionGroups: [
      {
        id: "dania-vege",
        name: "Dania główne",
        minSelections: 2,
        maxSelections: 4,
        options: [
          { id: "curry-vege", name: "Curry warzywne z mlekiem kokosowym", allergens: [], dietaryTags: [] },
          { id: "lasagne-vege", name: "Lasagne z warzywami", allergens: ["mleko", "gluten"], dietaryTags: [] },
          { id: "falafel-talerz", name: "Talerz falafel z hummusem", allergens: ["sezam"], dietaryTags: [] },
          { id: "stir-fry", name: "Stir-fry z tofu", allergens: ["soja", "gluten"], dietaryTags: [] },
        ],
      },
      {
        id: "dodatki-vege",
        name: "Dodatki",
        minSelections: 2,
        maxSelections: 3,
        options: [
          { id: "ryz-jaśminowy", name: "Ryż jaśminowy", allergens: [], dietaryTags: [] },
          { id: "kuskus", name: "Kuskus z warzywami", allergens: ["gluten"], dietaryTags: [] },
          { id: "grillowane-warzywa", name: "Grillowane warzywa", allergens: [], dietaryTags: [] },
        ],
      },
      {
        id: "salatki-vege",
        name: "Sałatki",
        minSelections: 1,
        maxSelections: 2,
        options: [
          { id: "quinoa-bowl", name: "Quinoa bowl", allergens: [], dietaryTags: [] },
          { id: "tabouleh", name: "Tabouleh", allergens: ["gluten"], dietaryTags: [] },
          { id: "caprese", name: "Caprese", allergens: ["mleko"], dietaryTags: [] },
        ],
      },
    ],
    dietaryTags: ["Wegetariańskie"],
  },
];

// Helper to get products by category
export const getProductsByCategory = (categoryId: string): Product[] => {
  return products.filter(p => p.category === categoryId);
};

// Helper to get product by ID
export const getProductById = (productId: string): Product | undefined => {
  return products.find(p => p.id === productId);
};
