// Elektronikte markaya göre ürün modelleri: "Apple → iPhone 16 Pro". Alıcı ve satıcı aynı adları seçer, eşleştirme birebir yapılır.
// apps/api/src/data/products.ts, apps/web/lib/products.ts ve apps/mobile/src/lib/products.ts birebir aynı olmalı (test/draft.test.ts denetler).
// Kısa ya da sıradan sözcük olan adlar markayla yazılır ("Realme 12", "MSI Modern"); metinden doldururken yanlış eşleşmesin.
// Yeni çıkan modeller buraya eklenir; listede olmayan model açıklamaya yazılır.
export const PRODUCT_MODELS: Record<string, Record<string, string[]>> = {
  telefon: {
    Apple: [
      "iPhone 17 Pro Max", "iPhone 17 Pro", "iPhone Air", "iPhone 17",
      "iPhone 16 Pro Max", "iPhone 16 Pro", "iPhone 16 Plus", "iPhone 16", "iPhone 16e",
      "iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 15 Plus", "iPhone 15",
      "iPhone 14 Pro Max", "iPhone 14 Pro", "iPhone 14 Plus", "iPhone 14",
      "iPhone 13 Pro Max", "iPhone 13 Pro", "iPhone 13", "iPhone 13 mini",
      "iPhone 12 Pro Max", "iPhone 12 Pro", "iPhone 12", "iPhone 12 mini",
      "iPhone 11 Pro Max", "iPhone 11 Pro", "iPhone 11",
      "iPhone SE (3. nesil)", "iPhone SE (2. nesil)", "iPhone XS Max", "iPhone XS", "iPhone XR", "iPhone X", "iPhone 8 Plus", "iPhone 8",
    ],
    Samsung: [
      "Galaxy S25 Ultra", "Galaxy S25 Edge", "Galaxy S25+", "Galaxy S25", "Galaxy S25 FE",
      "Galaxy S24 Ultra", "Galaxy S24+", "Galaxy S24", "Galaxy S24 FE",
      "Galaxy S23 Ultra", "Galaxy S23+", "Galaxy S23", "Galaxy S23 FE",
      "Galaxy S22 Ultra", "Galaxy S22+", "Galaxy S22", "Galaxy S21 Ultra", "Galaxy S21+", "Galaxy S21", "Galaxy S21 FE", "Galaxy S20 FE",
      "Galaxy Z Fold7", "Galaxy Z Fold6", "Galaxy Z Fold5", "Galaxy Z Fold4", "Galaxy Z Flip7", "Galaxy Z Flip6", "Galaxy Z Flip5", "Galaxy Z Flip4",
      "Galaxy A56", "Galaxy A55", "Galaxy A54", "Galaxy A36", "Galaxy A35", "Galaxy A34", "Galaxy A26", "Galaxy A25", "Galaxy A24",
      "Galaxy A16", "Galaxy A15", "Galaxy A14", "Galaxy A06", "Galaxy A05s", "Galaxy Note 20 Ultra",
    ],
    Xiaomi: [
      "Xiaomi 15 Ultra", "Xiaomi 15", "Xiaomi 14T Pro", "Xiaomi 14T", "Xiaomi 14 Ultra", "Xiaomi 14", "Xiaomi 13T Pro", "Xiaomi 13T", "Xiaomi 13", "Xiaomi 12T", "Xiaomi 12",
      "Redmi Note 14 Pro+", "Redmi Note 14 Pro", "Redmi Note 14", "Redmi Note 13 Pro+", "Redmi Note 13 Pro", "Redmi Note 13", "Redmi Note 12 Pro", "Redmi Note 12",
      "Redmi Note 11 Pro", "Redmi Note 11", "Redmi 14C", "Redmi 13", "Redmi 12",
      "Poco X7 Pro", "Poco X7", "Poco X6 Pro", "Poco X6", "Poco F7", "Poco F6",
    ],
    Huawei: ["Pura 70 Pro", "Pura 70", "Mate 50 Pro", "Mate 40 Pro", "Mate 20 Pro", "P60 Pro", "P50 Pro", "P40 Pro", "P40", "P30 Pro", "P30", "nova 12", "nova 11", "nova 10", "nova 9"],
    Oppo: ["Find X8", "Find X5", "Reno 13", "Reno 12", "Reno 11", "Reno 10", "Reno 8", "Oppo A79", "Oppo A78", "Oppo A58", "Oppo A38", "Oppo A17"],
    Realme: ["Realme GT 6", "Realme 13 Pro", "Realme 12 Pro", "Realme 12", "Realme 11", "Realme 10", "Realme C67", "Realme C55", "Realme C53", "Realme C33"],
  },
  tablet: {
    Apple: [
      "iPad Pro (M4)", "iPad Pro 12.9 (M2)", "iPad Pro 11 (M2)", "iPad Air (M3)", "iPad Air (M2)", "iPad Air (M1)",
      "iPad (A16)", "iPad (10. nesil)", "iPad (9. nesil)", "iPad mini (A17 Pro)", "iPad mini (6. nesil)",
    ],
    Samsung: ["Galaxy Tab S10+", "Galaxy Tab S10", "Galaxy Tab S10 FE", "Galaxy Tab S9 Ultra", "Galaxy Tab S9", "Galaxy Tab S9 FE", "Galaxy Tab S8", "Galaxy Tab S7 FE", "Galaxy Tab A9+", "Galaxy Tab A9", "Galaxy Tab A8"],
    Xiaomi: ["Pad 7", "Pad 6", "Redmi Pad Pro", "Redmi Pad SE"],
    Lenovo: ["Tab P12", "Tab P11", "Tab M11", "Tab M10"],
    Huawei: ["MatePad Air", "MatePad 11", "MatePad SE"],
  },
  bilgisayar: {
    Apple: ["MacBook Air (M4)", "MacBook Air (M3)", "MacBook Air (M2)", "MacBook Air (M1)", "MacBook Pro (M4)", "MacBook Pro (M3)", "MacBook Pro (M2)", "MacBook Pro (M1)", "iMac", "Mac mini", "Mac Studio"],
    Lenovo: ["ThinkPad", "IdeaPad", "Legion", "LOQ", "Yoga", "ThinkBook"],
    Asus: ["ZenBook", "VivoBook", "ROG", "TUF Gaming", "ExpertBook"],
    HP: ["Pavilion", "Victus", "Omen", "EliteBook", "ProBook", "Envy", "Spectre"],
    Dell: ["XPS", "Inspiron", "Latitude", "Vostro", "Alienware", "G Serisi"],
    Acer: ["Aspire", "Nitro", "Predator", "Swift"],
    MSI: ["Katana", "Cyborg", "MSI Thin", "Raider", "Stealth", "Titan", "MSI Modern", "Prestige"],
    Monster: ["Abra", "Tulpar", "Semruk", "Monster Huma"],
  },
};
