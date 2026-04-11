/**
 * Demo / fake data: składniki, dania, pakiety, zestawy, dodatki, pakiety dodatków,
 * rodzaje wydarzeń, klienci, zamówienia.
 * Uruchamiane z seed.ts gdy w bazie nie ma jeszcze żadnych dań.
 */
import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";

function d(n: string | number) {
  return new Prisma.Decimal(String(n));
}

export async function seedDemoData(prisma: PrismaClient) {
  if ((await prisma.dish.count()) > 0) {
    console.log("Demo: pomijam — w bazie są już dania.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    const existingCompany = await tx.companySetting.findFirst();
    if (!existingCompany) {
      await tx.companySetting.create({
        data: {
          companyName: "Szczypta Smaku — demo",
          nip: "1234567890",
          email: "kontakt@demo-szczypta.pl",
          phone: "+48 22 111 22 33",
          address: "ul. Przykładowa 1, 00-001 Warszawa",
          bankAccount: "12 3456 7890 1234 5678 9012 3456",
          minOrderValue: d(500),
          minLeadDays: 2,
          deliveryPricePerKm: d(3.5),
        },
      });
    }

    if ((await tx.paymentMethod.count()) === 0) {
      await tx.paymentMethod.createMany({
        data: [
          { name: "Przelew", description: "Faktura proforma", icon: "🏦", sortOrder: 0 },
          { name: "Gotówka przy odbiorze", description: "", icon: "💵", sortOrder: 1 },
          { name: "BLIK", description: "", icon: "📱", sortOrder: 2 },
        ],
      });
    }

    const ingChicken = await tx.ingredient.create({
      data: { name: "Filet z kurczaka", unit: "kg", pricePerUnit: d(32), allergens: [] },
    });
    const ingPork = await tx.ingredient.create({
      data: { name: "Karkówka wieprzowa", unit: "kg", pricePerUnit: d(28), allergens: [] },
    });
    const ingPotato = await tx.ingredient.create({
      data: { name: "Ziemniaki", unit: "kg", pricePerUnit: d(3.2), allergens: [] },
    });
    const ingCarrot = await tx.ingredient.create({
      data: { name: "Marchew", unit: "kg", pricePerUnit: d(4.5), allergens: [] },
    });
    const ingCream = await tx.ingredient.create({
      data: { name: "Śmietanka 30%", unit: "l", pricePerUnit: d(18), allergens: ["A7"] },
    });
    await tx.ingredient.create({
      data: { name: "Żurawina suszona", unit: "kg", pricePerUnit: d(45), allergens: [] },
    });

    const catZupy = await tx.productCategory.create({
      data: { slug: "zupy", name: "Zupy", description: "Domowe buliony i zupy krem", icon: "Soup", sortOrder: 0 },
    });
    const catDrugie = await tx.productCategory.create({
      data: {
        slug: "drugie-dania",
        name: "Dania główne",
        description: "Mięsa, ryby, dodatki",
        icon: "Beef",
        sortOrder: 1,
      },
    });
    const catDesery = await tx.productCategory.create({
      data: { slug: "desery", name: "Desery", description: "Ciasta i słodkie akcenty", icon: "Cake", sortOrder: 2 },
    });

    const evWesele = await tx.eventType.create({
      data: { name: "Wesele", icon: "Heart", isCatering: true, sortOrder: 0 },
    });
    const evKomunia = await tx.eventType.create({
      data: { name: "Komunia", icon: "Cross", isCatering: true, sortOrder: 1 },
    });
    const evKonferencja = await tx.eventType.create({
      data: { name: "Konferencja", icon: "Presentation", isCatering: false, sortOrder: 2 },
    });

    for (const ev of [evWesele, evKomunia, evKonferencja]) {
      for (const c of [catZupy, catDrugie, catDesery]) {
        await tx.eventCategoryMapping.create({ data: { eventTypeId: ev.id, categoryId: c.id } });
      }
    }

    const extraCatNaczynia = await tx.extrasCategory.create({
      data: {
        name: "Naczynia i pakowanie",
        slug: "naczynia",
        description: "Szkło, obrusy",
        icon: "Wine",
        sortOrder: 0,
      },
    });
    const extraCatObsluga = await tx.extrasCategory.create({
      data: {
        name: "Obsługa i logistyka",
        slug: "obsluga",
        description: "Kelnerzy, transport",
        icon: "Users",
        sortOrder: 1,
      },
    });

    for (const ev of [evWesele, evKomunia, evKonferencja]) {
      await tx.eventExtrasCategoryMapping.create({
        data: { eventTypeId: ev.id, extrasCategoryId: extraCatNaczynia.id },
      });
      await tx.eventExtrasCategoryMapping.create({
        data: { eventTypeId: ev.id, extrasCategoryId: extraCatObsluga.id },
      });
    }

    const dishRosol = await tx.dish.create({
      data: {
        name: "Rosół z domowym makaronem",
        description: "Klarowny bulion, pierś z kurczaka, włoszczyzna",
        categorySlug: "zupy",
        priceNetto: d(9.26),
        vatRate: 8,
        priceBrutto: d(10),
        pricePerUnit: d(10),
        unitLabel: "l",
        minQuantity: 5,
        icon: "🍲",
        dietaryTags: ["bez-laktozy-opcjonalnie"],
        dishIngredients: {
          create: [
            { ingredientId: ingChicken.id, quantity: d(0.08) },
            { ingredientId: ingCarrot.id, quantity: d(0.04) },
          ],
        },
      },
    });

    const dishBarszcz = await tx.dish.create({
      data: {
        name: "Barszcz czerwony z pasztecikami",
        description: "Na zakwasie, paszteciki drożdżowe",
        categorySlug: "zupy",
        priceNetto: d(12.04),
        vatRate: 8,
        priceBrutto: d(13),
        pricePerUnit: d(13),
        unitLabel: "l",
        minQuantity: 5,
        icon: "🥣",
        dishIngredients: {
          create: [{ ingredientId: ingCream.id, quantity: d(0.02) }],
        },
      },
    });

    const dishSchab = await tx.dish.create({
      data: {
        name: "Kotlet schabowy z ziemniakami i surówką",
        description: "Klasyczny zestaw",
        categorySlug: "drugie-dania",
        priceNetto: d(27.78),
        vatRate: 8,
        priceBrutto: d(30),
        pricePerUnit: d(30),
        unitLabel: "szt.",
        minQuantity: 10,
        icon: "🍽️",
        allergens: ["A1", "A3", "A7"],
        dishIngredients: {
          create: [
            { ingredientId: ingPork.id, quantity: d(0.18) },
            { ingredientId: ingPotato.id, quantity: d(0.2) },
          ],
        },
      },
    });

    const dishKaczka = await tx.dish.create({
      data: {
        name: "Pierś z kaczki z żurawiną",
        description: "Pieczona pierś, sos żurawinowy",
        categorySlug: "drugie-dania",
        priceNetto: d(37.04),
        vatRate: 8,
        priceBrutto: d(40),
        pricePerUnit: d(40),
        unitLabel: "szt.",
        minQuantity: 8,
        icon: "🦆",
        dishIngredients: {
          create: [{ ingredientId: ingChicken.id, quantity: d(0.2) }],
        },
      },
    });

    const dishSernik = await tx.dish.create({
      data: {
        name: "Sernik na zimno z owocami leśnymi",
        description: "Bez pieczenia",
        categorySlug: "desery",
        priceNetto: d(13.89),
        vatRate: 8,
        priceBrutto: d(15),
        pricePerUnit: d(15),
        unitLabel: "kromka",
        minQuantity: 20,
        icon: "🍰",
        allergens: ["A1", "A3", "A7"],
      },
    });

    const bundleSlub = await tx.bundle.create({
      data: {
        name: "Ślubny wybór — danie główne",
        description: "Schab lub kaczka — do wyboru na osobę",
        categorySlug: "drugie-dania",
        priceNetto: d(0),
        vatRate: 8,
        priceBrutto: d(0),
        basePrice: d(0),
        minQuantity: 20,
        icon: "💒",
        converter: 1,
        bundleVariants: {
          create: [
            {
              name: "Schabowy",
              description: "",
              price: d(30),
              dishId: dishSchab.id,
              sortOrder: 0,
            },
            {
              name: "Kaczka z żurawiną",
              description: "",
              price: d(40),
              dishId: dishKaczka.id,
              sortOrder: 1,
            },
          ],
        },
      },
    });

    const setLunch = await tx.configurableSet.create({
      data: {
        name: "Zestaw lunchowy (zupa + drugie)",
        description: "Dwa bloki wyboru — liczony na osoby",
        categorySlug: "drugie-dania",
        pricePerPerson: d(48),
        pricePerPersonOnSite: d(52),
        minPersons: 15,
        icon: "🍱",
        dietaryTags: ["wege-opcjonalnie"],
      },
    });

    const grpZupa = await tx.configGroup.create({
      data: { setId: setLunch.id, name: "Zupa", minSelections: 1, maxSelections: 1, sortOrder: 0, converter: 1 },
    });
    const grpDrugie = await tx.configGroup.create({
      data: {
        setId: setLunch.id,
        name: "Drugie danie",
        minSelections: 1,
        maxSelections: 1,
        sortOrder: 1,
        converter: 1,
      },
    });

    await tx.configGroupOption.createMany({
      data: [
        { groupId: grpZupa.id, name: "Rosół", dishId: dishRosol.id, sortOrder: 0 },
        { groupId: grpZupa.id, name: "Barszcz", dishId: dishBarszcz.id, sortOrder: 1 },
        { groupId: grpDrugie.id, name: "Schabowy", dishId: dishSchab.id, sortOrder: 0 },
        { groupId: grpDrugie.id, name: "Kaczka", dishId: dishKaczka.id, sortOrder: 1 },
      ],
    });

    const exCytryna = await tx.extra.create({
      data: {
        category: "dodatki",
        extrasCategoryId: extraCatNaczynia.id,
        name: "Cytryna i limonka do napojów",
        description: "Tace z plastrami",
        price: d(40),
        priceNetto: d(32.52),
        vatRate: 23,
        priceBrutto: d(40),
        unitLabel: "taca",
        icon: "🍋",
        sortOrder: 0,
      },
    });

    const exKwiaty = await tx.extra.create({
      data: {
        category: "dodatki",
        extrasCategoryId: extraCatNaczynia.id,
        name: "Dekoracja kwiatowa stołu prezydialnego",
        description: "Sezonowe kwiaty",
        price: d(350),
        unitLabel: "kpl.",
        icon: "💐",
        sortOrder: 1,
      },
    });

    const exSok = await tx.extra.create({
      data: {
        category: "dodatki",
        extrasCategoryId: extraCatNaczynia.id,
        name: "Sok owocowy 100%",
        description: "Baniak 5 l",
        price: d(85),
        unitLabel: "baniak",
        icon: "🧃",
        sortOrder: 2,
      },
    });

    await tx.extra.create({
      data: {
        category: "pakowanie",
        extrasCategoryId: extraCatNaczynia.id,
        name: "Pudełko eko na wynos",
        description: "Papier + drewno",
        price: d(2.5),
        priceLabel: "2,5 zł/os.",
        requiresPersonCount: true,
        unitLabel: "os.",
        icon: "📦",
        sortOrder: 0,
      },
    });

    await tx.extra.create({
      data: {
        category: "obsluga",
        extrasCategoryId: extraCatObsluga.id,
        name: "Kelner (4 godziny)",
        description: "Minimum 2 osoby",
        price: d(180),
        duration: "4h",
        unitLabel: "szt.",
        icon: "🤵",
        sortOrder: 0,
      },
    });

    const drinkBundle = await tx.extraBundle.create({
      data: {
        name: "Pakiet napojów premium",
        description: "Woda + sok do wyboru",
        category: "dodatki",
        extrasCategoryId: extraCatNaczynia.id,
        priceNetto: d(0),
        vatRate: 23,
        priceBrutto: d(0),
        basePrice: d(0),
        minQuantity: 1,
        icon: "🥤",
      },
    });

    await tx.extraBundleVariant.createMany({
      data: [
        {
          bundleId: drinkBundle.id,
          name: "Woda mineralna las zgrzewki",
          description: "",
          price: d(120),
          extraId: exCytryna.id,
          sortOrder: 0,
          contents: ["12 szt. 0,5 l"],
        },
        {
          bundleId: drinkBundle.id,
          name: "Sok owocowy 5 l",
          description: "",
          price: d(85),
          extraId: exSok.id,
          sortOrder: 1,
          contents: ["Baniak"],
        },
      ],
    });

    const zone = await tx.deliveryZone.create({
      data: {
        name: "Warszawa i okolice do 30 km",
        description: "Dowóz w dni powszednie",
        cities: ["Warszawa", "Marki", "Ząbki"],
        postalCodes: ["00-", "01-", "02-", "03-"],
        price: d(80),
        freeDeliveryAbove: d(2500),
        minOrderValue: d(800),
        sortOrder: 0,
      },
    });

    const client1 = await tx.client.create({
      data: {
        firstName: "Anna",
        lastName: "Kowalska",
        email: "anna.kowalska.demo@example.com",
        phone: "+48 600 100 200",
        address: "Marszałkowska 10/2",
        city: "Warszawa",
        postalCode: "00-590",
        companyName: "Firma IT Demo Sp. z o.o.",
        nip: "5270000000",
      },
    });

    const client2 = await tx.client.create({
      data: {
        firstName: "Piotr",
        lastName: "Nowak",
        email: "piotr.nowak.demo@example.com",
        phone: "+48 601 222 333",
        address: "Słoneczna 5",
        city: "Marki",
        postalCode: "05-270",
      },
    });

    const client3 = await tx.client.create({
      data: {
        firstName: "Magdalena",
        lastName: "Wiśniewska",
        email: "magdalena.w@example.com",
        phone: "+48 692 444 555",
        city: "Warszawa",
        notes: "Preferuje kontakt mailowy.",
      },
    });

    const eventDay1 = new Date("2026-06-14T12:00:00.000Z");
    const eventDay2 = new Date("2026-07-01T12:00:00.000Z");
    const eventTime14 = new Date(Date.UTC(1970, 0, 1, 14, 0, 0));

    await tx.order.create({
      data: {
        orderNumber: "DEMO-2026-0001",
        clientId: client1.id,
        clientName: "Anna Kowalska",
        clientEmail: client1.email,
        clientPhone: client1.phone,
        companyName: "Firma IT Demo Sp. z o.o.",
        companyNip: "5270000000",
        eventType: "Wesele",
        eventDate: eventDay1,
        eventTime: eventTime14,
        guestCount: 80,
        cateringType: "wyjazdowy",
        deliveryAddress: "Dwór Pod Lipami, Konstancin",
        contactCity: "Warszawa",
        contactStreet: "Marszałkowska",
        contactBuilding: "10/2",
        deliveryZoneId: zone.id,
        deliveryCost: d(80),
        discount: d(0),
        deposit: d(450),
        bail: d(100),
        amount: d(4520),
        status: "Nowe zamówienie",
        paymentMethod: "Przelew",
        notes: "Degustacja zaplanowana na maj.",
        orderItems: {
          create: [
            {
              name: dishRosol.name,
              quantity: 80,
              unit: "l",
              pricePerUnit: d(10),
              total: d(800),
              itemType: "simple",
              dishId: dishRosol.id,
              sortOrder: 0,
            },
            {
              name: dishSchab.name,
              quantity: 80,
              unit: "szt.",
              pricePerUnit: d(30),
              total: d(2400),
              itemType: "simple",
              dishId: dishSchab.id,
              sortOrder: 1,
            },
            {
              name: exCytryna.name,
              quantity: 2,
              unit: "taca",
              pricePerUnit: d(40),
              total: d(80),
              itemType: "extra",
              sortOrder: 2,
            },
          ],
        },
      },
    });

    const order2 = await tx.order.create({
      data: {
        orderNumber: "DEMO-2026-0002",
        clientId: client2.id,
        clientName: "Piotr Nowak",
        clientEmail: client2.email,
        clientPhone: client2.phone,
        eventType: "Komunia",
        eventDate: eventDay2,
        eventTime: new Date(Date.UTC(1970, 0, 1, 13, 30, 0)),
        guestCount: 45,
        cateringType: "na_sali",
        deliveryAddress: "Parafia św. Jana, Marki",
        contactCity: "Marki",
        amount: d(2890),
        status: "W realizacji",
        paymentMethod: "BLIK",
        orderItems: {
          create: [
            {
              name: bundleSlub.name,
              quantity: 1,
              unit: "kpl.",
              pricePerUnit: d(1350),
              total: d(1350),
              itemType: "expandable",
              sortOrder: 0,
              subItems: {
                create: [
                  {
                    name: "Schabowy",
                    quantity: 30,
                    unit: "szt.",
                    pricePerUnit: 30,
                    dishId: dishSchab.id,
                    converter: 1,
                  },
                  {
                    name: "Kaczka z żurawiną",
                    quantity: 15,
                    unit: "szt.",
                    pricePerUnit: 40,
                    dishId: dishKaczka.id,
                    converter: 1,
                  },
                ],
              },
            },
            {
              name: dishSernik.name,
              quantity: 45,
              unit: "kromka",
              pricePerUnit: d(15),
              total: d(675),
              itemType: "simple",
              dishId: dishSernik.id,
              sortOrder: 1,
            },
          ],
        },
      },
    });

    await tx.orderFoodCostExtra.create({
      data: { orderId: order2.id, name: "Transport dodatkowy", amount: d(120) },
    });

    const order3 = await tx.order.create({
      data: {
        orderNumber: "DEMO-2026-0003",
        clientId: client3.id,
        clientName: "Magdalena Wiśniewska",
        clientEmail: client3.email,
        clientPhone: client3.phone,
        eventType: "Konferencja",
        eventDate: new Date("2026-05-20T12:00:00.000Z"),
        guestCount: 60,
        cateringType: "odbior_osobisty",
        contactCity: "Warszawa",
        amount: d(3100),
        status: "Nowa oferta",
        paymentMethod: "Gotówka przy odbiorze",
      },
    });

    const o3Configurable = await tx.orderItem.create({
      data: {
        orderId: order3.id,
        name: setLunch.name,
        quantity: 60,
        unit: "os.",
        pricePerUnit: d(48),
        total: d(2880),
        itemType: "configurable",
        sortOrder: 0,
      },
    });

    await tx.orderItemSubItem.createMany({
      data: [
        {
          orderItemId: o3Configurable.id,
          name: "Zupa: Barszcz",
          quantity: 60,
          unit: "os.",
          pricePerUnit: 0,
          dishId: dishBarszcz.id,
          optionConverter: 1,
          groupConverter: 1,
          converter: 1,
        },
        {
          orderItemId: o3Configurable.id,
          name: "Drugie danie: Schabowy",
          quantity: 60,
          unit: "os.",
          pricePerUnit: 0,
          dishId: dishSchab.id,
          optionConverter: 1,
          groupConverter: 1,
          converter: 1,
        },
      ],
    });

    const o3Bundle = await tx.orderItem.create({
      data: {
        orderId: order3.id,
        name: drinkBundle.name,
        quantity: 1,
        unit: "kpl.",
        pricePerUnit: d(205),
        total: d(205),
        itemType: "extra_bundle",
        sortOrder: 1,
      },
    });

    await tx.orderItemSubItem.createMany({
      data: [
        { orderItemId: o3Bundle.id, name: "Woda mineralna las zgrzewki", quantity: 2, unit: "szt." },
        { orderItemId: o3Bundle.id, name: "Sok owocowy 5 l", quantity: 1, unit: "szt." },
      ],
    });
  });

  console.log("Demo: dodano przykładowe dane (katalog, klienci, zamówienia DEMO-2026-*).");
}
