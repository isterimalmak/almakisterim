// Türkiye pazarında yaygın marka ve modeller. Alıcı talebinde birden fazla marka/model seçebilir.
// Liste yönetim panelinden genişletilebilir hale getirilene kadar burada tutulur.
export const CAR_BRANDS: Record<string, string[]> = {
  "Abarth": ["500", "595", "695", "Punto"],
  "Alfa Romeo": ["Giulia", "Giulietta", "Stelvio", "Tonale", "Junior", "MiTo", "147", "156", "159", "166", "Brera", "GT", "Spider"],
  "Anadol": ["A1", "A2", "SL", "STC-16"],
  "Aston Martin": ["DB11", "DB12", "DBX", "Vantage", "Rapide"],
  "Audi": ["A1", "A3", "A4", "A5", "A6", "A7", "A8", "Q2", "Q3", "Q4 e-tron", "Q5", "Q6 e-tron", "Q7", "Q8", "e-tron", "e-tron GT", "TT", "R8", "RS / S Serisi"],
  "Bentley": ["Bentayga", "Continental", "Flying Spur"],
  "BMW": ["1 Serisi", "2 Serisi", "3 Serisi", "4 Serisi", "5 Serisi", "6 Serisi", "7 Serisi", "8 Serisi", "X1", "X2", "X3", "X4", "X5", "X6", "X7", "XM", "iX", "iX1", "iX2", "iX3", "i3", "i4", "i5", "i7", "i8", "Z3", "Z4", "M Serisi"],
  "BYD": ["Atto 2", "Atto 3", "Dolphin", "Seal", "Seal U", "Sealion 7", "Han", "Tang"],
  "Cadillac": ["Escalade", "CTS", "SRX", "Lyriq"],
  "Chery": ["Tiggo 2", "Tiggo 4", "Tiggo 7", "Tiggo 8", "Arrizo"],
  "Chevrolet": ["Aveo", "Cruze", "Captiva", "Spark", "Lacetti", "Kalos", "Epica", "Evanda", "Orlando", "Trax", "Camaro", "Corvette", "Tahoe"],
  "Chrysler": ["300C", "Voyager", "PT Cruiser", "Pacifica"],
  "Citroen": ["C-Elysee", "C1", "C2", "C3", "C3 Aircross", "C3 Picasso", "C4", "C4 X", "C4 Picasso", "C4 Grand Picasso", "C5", "C5 Aircross", "C5 X", "C8", "Saxo", "Xsara", "Xsara Picasso", "Berlingo", "Nemo", "Jumpy", "Jumper", "SpaceTourer", "Ami"],
  "Cupra": ["Formentor", "Leon", "Born", "Ateca", "Tavascan", "Terramar"],
  "Dacia": ["Sandero", "Sandero Stepway", "Logan", "Duster", "Jogger", "Spring", "Bigster", "Lodgy", "Dokker", "Solenza"],
  "Daewoo": ["Lanos", "Nubira", "Matiz", "Leganza", "Espero", "Racer", "Tico"],
  "Daihatsu": ["Terios", "Sirion", "Cuore", "Materia"],
  "DFSK": ["Glory 500", "Glory 580", "Fengon", "E5"],
  "Dodge": ["Challenger", "Charger", "Durango", "Journey", "Caliber", "Nitro"],
  "DS": ["DS 3", "DS 4", "DS 5", "DS 7", "DS 9"],
  "Ferrari": ["296", "Roma", "Purosangue", "SF90", "F8", "812", "Portofino", "California", "458", "488"],
  "Fiat": ["Egea", "Egea Cross", "500", "500L", "500X", "500e", "600", "Panda", "Tipo", "Linea", "Punto", "Grande Punto", "Albea", "Palio", "Siena", "Marea", "Brava", "Bravo", "Stilo", "Tempra", "Uno", "Idea", "Freemont", "Fullback", "Doblo", "Fiorino", "Scudo", "Ducato", "Topolino"],
  "Ford": ["Fiesta", "Focus", "Mondeo", "Escort", "Taunus", "Ka", "Puma", "Kuga", "EcoSport", "Explorer", "Edge", "Galaxy", "S-Max", "C-Max", "B-Max", "Mustang", "Mustang Mach-E", "Ranger", "Courier", "Tourneo Connect", "Tourneo Courier", "Tourneo Custom", "Transit", "Transit Connect", "Transit Custom", "Transit Courier"],
  "Geely": ["Emgrand", "Coolray", "Monjaro", "EX5"],
  "Genesis": ["G70", "G80", "GV60", "GV70", "GV80"],
  "GWM / Haval": ["Haval H6", "Haval Jolion", "Ora 03", "Tank 300", "Poer"],
  "Honda": ["Civic", "City", "Jazz", "CR-V", "HR-V", "ZR-V", "e:Ny1", "Accord", "Insight", "Integra", "Prelude", "S2000", "Legend", "FR-V"],
  "Hyundai": ["i10", "i20", "i30", "i40", "Accent", "Accent Era", "Accent Blue", "Getz", "Elantra", "Sonata", "Excel", "Matrix", "ix20", "ix35", "Bayon", "Kona", "Tucson", "Santa Fe", "IONIQ", "IONIQ 5", "IONIQ 6", "Inster", "Staria", "H-1", "H-100"],
  "Infiniti": ["Q30", "Q50", "QX30", "QX50", "QX70"],
  "Isuzu": ["D-Max", "NPR", "NLR", "NNR"],
  "Iveco": ["Daily"],
  "Jaecoo": ["J7", "J8"],
  "Jaguar": ["XE", "XF", "XJ", "F-Type", "E-Pace", "F-Pace", "I-Pace", "S-Type", "X-Type"],
  "Jeep": ["Renegade", "Compass", "Avenger", "Cherokee", "Grand Cherokee", "Wrangler", "Gladiator"],
  "Karsan": ["Jest", "J10", "e-Jest"],
  "KGM / SsangYong": ["Korando", "Rexton", "Tivoli", "Torres", "Musso", "Kyron", "Actyon", "Rodius"],
  "Kia": ["Picanto", "Rio", "Ceed", "XCeed", "ProCeed", "Cerato", "Optima", "Stinger", "Stonic", "Sportage", "Sorento", "Soul", "Venga", "Carens", "Carnival", "Niro", "EV3", "EV6", "EV9"],
  "Lada": ["Niva", "Samara", "Vega", "Kalina", "Priora", "Granta", "Vesta"],
  "Lamborghini": ["Urus", "Huracan", "Aventador", "Revuelto"],
  "Lancia": ["Delta", "Ypsilon", "Musa", "Thesis"],
  "Land Rover": ["Defender", "Discovery", "Discovery Sport", "Freelander", "Range Rover", "Range Rover Sport", "Range Rover Velar", "Range Rover Evoque"],
  "Leapmotor": ["T03", "C10", "B10"],
  "Lexus": ["CT", "ES", "IS", "GS", "LS", "LBX", "NX", "RX", "UX", "LC"],
  "Lincoln": ["Navigator", "Continental", "MKZ"],
  "Lotus": ["Emira", "Eletre", "Elise", "Exige"],
  "Lynk & Co": ["01", "02"],
  "Maserati": ["Ghibli", "Quattroporte", "Levante", "Grecale", "MC20", "GranTurismo"],
  "Mazda": ["2", "3", "5", "6", "323", "626", "CX-3", "CX-30", "CX-5", "CX-60", "CX-7", "MX-5", "RX-8", "MX-30"],
  "McLaren": ["570S", "720S", "750S", "Artura", "GT"],
  "Mercedes-Benz": ["A Serisi", "B Serisi", "C Serisi", "CLA", "CLE", "CLK", "CLS", "E Serisi", "S Serisi", "SL", "SLC / SLK", "AMG GT", "GLA", "GLB", "GLC", "GLE", "GLK", "GLS", "ML", "GL", "G Serisi", "EQA", "EQB", "EQC", "EQE", "EQS", "X Serisi", "Citan", "Vito", "V Serisi", "Viano", "Sprinter", "Maybach"],
  "MG": ["ZS", "MG3", "MG4", "MG5", "HS", "Marvel R", "Cyberster"],
  "MINI": ["Cooper", "Countryman", "Clubman", "Paceman", "Aceman", "Cabrio"],
  "Mitsubishi": ["L200", "ASX", "Eclipse Cross", "Outlander", "Pajero", "Lancer", "Colt", "Carisma", "Space Star", "Galant"],
  "Nissan": ["Micra", "Note", "Almera", "Sunny", "Primera", "Pulsar", "Tiida", "Juke", "Qashqai", "X-Trail", "Pathfinder", "Patrol", "Navara", "Leaf", "Ariya", "350Z", "370Z", "GT-R", "NV200", "Townstar", "Primastar"],
  "Omoda": ["5", "7", "E5"],
  "Opel": ["Corsa", "Astra", "Insignia", "Vectra", "Zafira", "Meriva", "Tigra", "Agila", "Omega", "Kadett", "Mokka", "Crossland", "Grandland", "Frontera", "Antara", "Combo", "Vivaro", "Movano"],
  "Peugeot": ["106", "107", "108", "206", "207", "208", "2008", "301", "306", "307", "308", "3008", "405", "406", "407", "408", "508", "5008", "607", "RCZ", "Bipper", "Partner", "Rifter", "Expert", "Traveller", "Boxer"],
  "Polestar": ["2", "3", "4"],
  "Porsche": ["911", "718 Boxster", "718 Cayman", "Cayenne", "Macan", "Panamera", "Taycan"],
  "Proton": ["Saga", "Persona", "Gen-2", "Waja"],
  "RAM": ["1500"],
  "Renault": ["Clio", "Megane", "Megane Sedan", "Megane E-Tech", "Taliant", "Symbol", "Fluence", "Laguna", "Latitude", "Talisman", "Twingo", "Scenic", "Grand Scenic", "Modus", "Captur", "Austral", "Arkana", "Rafale", "Kadjar", "Koleos", "Espace", "Zoe", "R5", "R9", "R11", "R12 Toros", "R19", "R21", "Kangoo", "Express", "Trafic", "Master"],
  "Rolls-Royce": ["Ghost", "Phantom", "Cullinan", "Wraith", "Spectre"],
  "Rover": ["25", "45", "75", "200", "400", "600"],
  "Saab": ["9-3", "9-5"],
  "Seat": ["Ibiza", "Leon", "Toledo", "Cordoba", "Altea", "Exeo", "Arona", "Ateca", "Tarraco", "Alhambra", "Mii"],
  "Seres": ["3", "5"],
  "Skoda": ["Fabia", "Scala", "Rapid", "Octavia", "Superb", "Roomster", "Yeti", "Kamiq", "Karoq", "Kodiaq", "Enyaq", "Elroq", "Favorit", "Felicia"],
  "Skywell": ["ET5"],
  "Smart": ["ForTwo", "ForFour", "#1", "#3"],
  "Subaru": ["Forester", "XV", "Crosstrek", "Outback", "Impreza", "Legacy", "BRZ", "Solterra"],
  "Suzuki": ["Swift", "Vitara", "Grand Vitara", "S-Cross", "SX4", "Jimny", "Baleno", "Ignis", "Alto", "Splash"],
  "Tata": ["Indica", "Indigo", "Manza"],
  "Tesla": ["Model 3", "Model Y", "Model S", "Model X", "Cybertruck"],
  "Tofaş": ["Şahin", "Doğan", "Kartal", "Murat 124", "Murat 131", "Serçe"],
  "Togg": ["T10X", "T10F"],
  "Toyota": ["Aygo", "Aygo X", "Yaris", "Yaris Cross", "Corolla", "Corolla Cross", "Auris", "Avensis", "Carina", "Starlet", "Prius", "C-HR", "RAV4", "Camry", "Verso", "Supra", "GR86", "bZ4X", "Hilux", "Land Cruiser", "Land Cruiser Prado", "Proace", "Proace City", "Hiace"],
  "Volkswagen": ["Polo", "Golf", "Jetta", "Bora", "Vento", "Passat", "Passat CC", "Arteon", "Scirocco", "Beetle", "Up!", "Touran", "Sharan", "T-Cross", "T-Roc", "Taigo", "Tiguan", "Tayron", "Touareg", "ID.3", "ID.4", "ID.5", "ID.7", "ID.Buzz", "Caddy", "Transporter", "Caravelle", "Multivan", "Crafter", "Amarok"],
  "Volvo": ["S40", "S60", "S80", "S90", "V40", "V50", "V60", "V70", "V90", "XC40", "XC60", "XC70", "XC90", "EX30", "EX40", "EC40", "EX90", "C30"],
  "Voyah": ["Free", "Dream", "Courage"],
  "Xpeng": ["G6", "G9", "P7"],
  "Zeekr": ["001", "7X", "X"],
  // Listede olmayan markalar için: alıcı "Diğer" seçip ayrıntıyı açıklamaya yazar.
  "Diğer": [],
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
  "Kuba": [], "Mondial": [], "Bajaj": [], "Triumph": [], "Sym": [], "Kymco": [], "Aprilia": [], "Piaggio": [], "Benelli": [], "Royal Enfield": [], "Husqvarna": [], "Voge": [], "RKS": [], "Arora": [], "Peugeot": [], "Diğer": [],
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
  return Object.keys(b).find((k) => norm(k) === n || (k === "Mercedes-Benz" && ["mercedes", "benz"].includes(n)) || (k === "Volkswagen" && n === "vw") || (k === "GWM / Haval" && ["haval", "gwm", "greatwall"].includes(n)) || (k === "KGM / SsangYong" && ["ssangyong", "kgm"].includes(n))) ?? null;
}

export function matchModel(sub: string, brand: string, raw: string | null | undefined): string | null {
  if (!raw) return null;
  const n = norm(raw);
  return brandsFor(sub)[brand]?.find((m) => norm(m) === n) ?? null;
}
