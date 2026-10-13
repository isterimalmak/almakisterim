// Türkiye pazarında yaygın marka ve modeller. Alıcı talebinde birden fazla marka/model seçebilir.
// Liste yönetim panelinden genişletilebilir hale getirilene kadar burada tutulur.
export const CAR_BRANDS: Record<string, string[]> = {
  "Alfa Romeo": ["Giulia", "Giulietta", "Stelvio", "Tonale", "Junior", "MiTo"],
  "Audi": ["A1", "A3", "A4", "A5", "A6", "A7", "A8", "Q2", "Q3", "Q4 e-tron", "Q5", "Q7", "Q8", "e-tron GT", "TT", "RS / S Serisi"],
  "BMW": ["1 Serisi", "2 Serisi", "3 Serisi", "4 Serisi", "5 Serisi", "6 Serisi", "7 Serisi", "8 Serisi", "X1", "X2", "X3", "X4", "X5", "X6", "X7", "iX", "iX1", "iX3", "i4", "i5", "i7", "Z4", "M Serisi"],
  "BYD": ["Atto 3", "Dolphin", "Seal", "Seal U", "Sealion 7", "Han", "Tang"],
  "Chery": ["Tiggo 4", "Tiggo 7", "Tiggo 8", "Omoda 5"],
  "Chevrolet": ["Aveo", "Cruze", "Captiva", "Spark", "Lacetti"],
  "Citroen": ["C-Elysee", "C3", "C3 Aircross", "C4", "C4 X", "C5 Aircross", "Berlingo"],
  "Cupra": ["Formentor", "Leon", "Born", "Ateca"],
  "Dacia": ["Sandero", "Sandero Stepway", "Logan", "Duster", "Jogger", "Spring", "Bigster"],
  "DS": ["DS 3", "DS 4", "DS 7", "DS 9"],
  "Fiat": ["Egea", "Egea Cross", "500", "500X", "Panda", "Tipo", "Linea", "Punto", "Doblo", "Fiorino"],
  "Ford": ["Fiesta", "Focus", "Mondeo", "Puma", "Kuga", "EcoSport", "Mustang", "Mustang Mach-E", "Ranger", "Courier", "Tourneo Connect", "Tourneo Courier", "Transit Custom"],
  "Honda": ["Civic", "City", "Jazz", "CR-V", "HR-V", "ZR-V", "Accord"],
  "Hyundai": ["i10", "i20", "i30", "Accent Blue", "Elantra", "Bayon", "Kona", "Tucson", "Santa Fe", "IONIQ 5", "IONIQ 6"],
  "Jaguar": ["XE", "XF", "E-Pace", "F-Pace", "I-Pace"],
  "Jeep": ["Renegade", "Compass", "Avenger", "Wrangler", "Grand Cherokee"],
  "Kia": ["Picanto", "Rio", "Ceed", "XCeed", "Stonic", "Sportage", "Sorento", "Niro", "EV3", "EV6", "EV9"],
  "Land Rover": ["Defender", "Discovery", "Discovery Sport", "Range Rover", "Range Rover Sport", "Range Rover Velar", "Range Rover Evoque"],
  "Lexus": ["ES", "NX", "RX", "UX"],
  "Mazda": ["2", "3", "6", "CX-3", "CX-30", "CX-5", "MX-5"],
  "Mercedes-Benz": ["A Serisi", "B Serisi", "C Serisi", "CLA", "CLS", "E Serisi", "S Serisi", "GLA", "GLB", "GLC", "GLE", "GLS", "G Serisi", "EQA", "EQB", "EQE", "EQS", "Vito", "V Serisi"],
  "MG": ["ZS", "MG4", "HS", "Marvel R"],
  "MINI": ["Cooper", "Countryman", "Clubman", "Aceman"],
  "Mitsubishi": ["L200", "ASX", "Eclipse Cross", "Space Star"],
  "Nissan": ["Micra", "Juke", "Qashqai", "X-Trail", "Navara", "Leaf"],
  "Opel": ["Corsa", "Astra", "Insignia", "Mokka", "Crossland", "Grandland", "Combo"],
  "Peugeot": ["208", "2008", "301", "308", "3008", "408", "508", "5008", "Rifter", "Partner"],
  "Porsche": ["911", "Cayenne", "Macan", "Panamera", "Taycan"],
  "Renault": ["Clio", "Megane", "Megane Sedan", "Taliant", "Symbol", "Fluence", "Captur", "Austral", "Kadjar", "Koleos", "Kangoo", "Zoe"],
  "Seat": ["Ibiza", "Leon", "Arona", "Ateca", "Tarraco"],
  "Skoda": ["Fabia", "Scala", "Octavia", "Superb", "Kamiq", "Karoq", "Kodiaq", "Enyaq"],
  "Subaru": ["Forester", "XV", "Outback"],
  "Suzuki": ["Swift", "Vitara", "S-Cross", "Jimny"],
  "Tesla": ["Model 3", "Model Y", "Model S", "Model X"],
  "Togg": ["T10X", "T10F"],
  "Toyota": ["Yaris", "Yaris Cross", "Corolla", "Corolla Cross", "Auris", "C-HR", "RAV4", "Camry", "Hilux", "Land Cruiser", "Proace City"],
  "Volkswagen": ["Polo", "Golf", "Jetta", "Passat", "Arteon", "T-Cross", "T-Roc", "Taigo", "Tiguan", "Touareg", "ID.3", "ID.4", "ID.7", "Caddy", "Transporter", "Amarok"],
  "Volvo": ["S60", "S90", "V60", "XC40", "XC60", "XC90", "EX30", "EC40"],
};

export const MOTO_BRANDS: Record<string, string[]> = {
  "Honda": ["PCX", "Activa", "Dio", "CBR", "CB", "Forza", "Africa Twin", "NC750X"],
  "Yamaha": ["NMAX", "XMAX", "TMAX", "MT-07", "MT-09", "R25", "Tracer"],
  "Kawasaki": ["Ninja", "Z", "Versys", "Vulcan"],
  "Suzuki": ["Burgman", "GSX", "V-Strom"],
  "BMW": ["R 1250 GS", "F 900", "S 1000 RR", "C 400"],
  "KTM": ["Duke", "RC", "Adventure"],
  "Ducati": ["Monster", "Panigale", "Multistrada", "Scrambler"],
  "Harley-Davidson": ["Sportster", "Softail", "Touring"],
  "Vespa": ["Primavera", "Sprint", "GTS"],
  "CFMoto": ["NK", "MT", "SR"],
  "Kuba": [], "Mondial": [], "Bajaj": [], "Triumph": [], "Sym": [], "Kymco": [],
};

// Bu alt kategorilerde talep ayrıntılı araç alanlarıyla verilir.
export const VEHICLE_SUBS: Record<string, "car" | "moto"> = { otomobil: "car", suv: "car", elektrikli: "car", ticari: "car", motosiklet: "moto" };

export const FUELS = ["Benzin", "Dizel", "LPG", "Hibrit", "Elektrik"] as const;
export const GEARS = ["Manuel", "Otomatik", "Yarı Otomatik"] as const;
export const BODIES = ["Sedan", "Hatchback", "SUV", "Station Wagon", "Coupe", "Cabrio", "MPV", "Pick-up", "Panelvan"] as const;
export const MAX_VEHICLES = 5;

export const brandsFor = (sub: string) => (VEHICLE_SUBS[sub] === "moto" ? MOTO_BRANDS : CAR_BRANDS);

// "3 serisi", "3-Serisi", "3serisi" aynı sayılsın.
export const norm = (s: string) => s.toLocaleLowerCase("tr").replace(/[\s\-_.]/g, "").replace(/ı/g, "i");

export function matchBrand(sub: string, raw: string): string | null {
  const b = brandsFor(sub);
  const n = norm(raw);
  return Object.keys(b).find((k) => norm(k) === n || (k === "Mercedes-Benz" && ["mercedes", "benz"].includes(n)) || (k === "Volkswagen" && n === "vw")) ?? null;
}

export function matchModel(sub: string, brand: string, raw: string | null | undefined): string | null {
  if (!raw) return null;
  const n = norm(raw);
  return brandsFor(sub)[brand]?.find((m) => norm(m) === n) ?? null;
}
