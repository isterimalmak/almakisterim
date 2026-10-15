// Yapay zekâ çalışmadığında kategori kurallarla bulunur: her alt kategorinin anahtar sözcükleri (ekli yazımlar da: "arsası", "yatı", "dairede"),
// emlakta kiralık/satılık/günlük ayrımı, araç markası geçen metinde vasıta. Puanı en yüksek ve sitede açık olan alt kategori seçilir.

const L = "a-z0-9ığüşöçâîû";
const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Kısa sözcüklerde ("yat", "ev", "kat") yalnızca bilinen ekler kabul edilir ("yatak" yat sayılmaz); uzun sözcüklerde sözcük başı yeterli.
const SUFFIX = "(?:ı|i|u|ü|a|e|ın|in|un|ün|ım|im|um|üm|lar|ler|ları|leri|da|de|ta|te|dan|den|tan|ten|ya|ye|sı|si|su|sü|yı|yi|yu|yü|lık|lik|luk|lük|cı|ci|çı|çi)?";
function match(t: string, w: string) {
  const k = esc(w.toLocaleLowerCase("tr"));
  return w.length <= 4
    ? new RegExp(`(^|[^${L}])${k}${SUFFIX}(?=[^${L}]|$)`).test(t)
    : new RegExp(`(^|[^${L}])${k}`).test(t);
}

// Alt kategori → [sözcükler, ağırlık]. Ürünü doğrudan adlandıran sözcükler 3, yardımcı sözcükler 1 puan.
const KW: Record<string, [string[], number][]> = {
  // Emlak
  arsa: [[["arsa", "arazi", "tarla", "parsel", "zeytinlik", "bağ yeri", "bahçe yeri", "köy içi", "köyiçi", "imarlı", "kat karşılığı", "hisseli tapu", "müstakil tapu"], 3]],
  satilik: [[["satılık", "daire", "apartman", "villa", "müstakil ev", "dubleks", "tripleks", "rezidans", "kat", "konut", "ev", "residence", "çatı katı", "bahçe katı"], 2]],
  kiralik: [[["kiralık", "kira", "kiracı", "aylık kira"], 3]],
  gunluk: [[["günlük kiralık", "haftalık kiralık", "günlük", "tatil evi", "yazlık", "apart", "bungalov", "pansiyon"], 3]],
  isyeri: [[["dükkan", "dükkân", "ofis", "büro", "depo", "işyeri", "iş yeri", "mağaza", "atölye", "fabrika", "plaza", "imalathane"], 3]],
  // Vasıta
  otomobil: [[["araba", "otomobil", "sedan", "hatchback", "binek"], 3]],
  suv: [[["suv", "4x4", "pickup", "pick-up", "arazi aracı", "jip", "jeep"], 4]],
  elektrikli: [[["elektrikli araç", "elektrikli araba", "tesla", "togg"], 4]],
  ticari: [[["kamyonet", "minibüs", "panelvan", "kamyon", "ticari araç", "çekici", "otobüs", "midibüs"], 4]],
  motosiklet: [[["motosiklet", "motor", "scooter", "skuter", "chopper"], 3]],
  deniz: [[["yat", "tekne", "yelkenli", "gulet", "sürat teknesi", "jet ski", "jetski", "şişme bot", "bot", "katamaran", "balıkçı teknesi"], 4]],
  // Diğerleri
  telefon: [[["iphone", "telefon", "cep telefonu", "galaxy", "redmi", "xiaomi"], 3]], bilgisayar: [[["laptop", "macbook", "bilgisayar", "notebook", "dizüstü", "masaüstü"], 3]],
  tablet: [[["ipad", "tablet"], 3]], tv: [[["televizyon", "tv", "oled", "soundbar"], 3]], oyun: [[["playstation", "ps5", "ps4", "xbox", "nintendo", "konsol"], 3]],
  kamera: [[["fotoğraf makinesi", "kamera", "lens", "gopro"], 3]],
  mobilya: [[["koltuk", "yemek masası", "gardırop", "yatak", "baza", "mobilya", "kanepe"], 3]], beyaz: [[["buzdolabı", "çamaşır makinesi", "bulaşık makinesi", "fırın", "kurutma makinesi", "derin dondurucu"], 3]],
  lastik: [[["lastik", "jant"], 3]], tadilat: [[["tadilat", "boya badana", "fayans", "alçıpan"], 3]], nakliyat: [[["nakliyat", "evden eve", "taşımacılık"], 3]],
  temizlik: [[["temizlik"], 3]], tesisat: [[["tesisat", "elektrikçi", "su kaçağı", "kombi bakım"], 3]],
  lise: [[["yks", "lgs", "özel ders", "matematik dersi"], 3]], dil: [[["ingilizce", "almanca", "fransızca", "dil kursu"], 3]],
  tarim: [[["traktör", "biçerdöver", "pulluk", "römork"], 3]], ismakine: [[["ekskavatör", "forklift", "kepçe", "iş makinesi", "vinç"], 3]],
  jenerator: [[["jeneratör", "kompresör"], 3]], ayakkabi: [[["ayakkabı", "sneaker", "bot ayakkabı"], 3]], giyim: [[["mont", "elbise", "pantolon", "ceket", "kazak"], 3]],
  saat: [[["kol saati", "akıllı saat", "saat"], 2]], bisiklet: [[["bisiklet"], 3]], araba: [[["bebek arabası", "puset"], 4]], oto: [[["oto koltuğu", "ana kucağı"], 4]],
  gida: [[["kıyma", "gıda", "zeytinyağı", "bal"], 2]], tekstil: [[["tişört", "tekstil", "kumaş"], 3]], yapi: [[["tuğla", "çimento", "demir", "kereste", "yapı malzemesi"], 3]],
};

export function detectCategory(t: string, allowed: Set<string>, hasCar: boolean): string | null {
  const score: Record<string, number> = {};
  for (const [id, groups] of Object.entries(KW)) {
    for (const [words, w] of groups) for (const x of words) if (match(t, x)) score[id] = (score[id] ?? 0) + w;
  }
  // Araç markası/modeli geçiyorsa vasıta öne geçer ("Hilux arazi aracı" arsa değildir).
  if (hasCar) {
    score.otomobil = (score.otomobil ?? 0) + 5;
    if (/arazi|suv|4x4|pick.?up|jip/.test(t)) score.suv = (score.suv ?? 0) + 6;
    for (const k of ["arsa", "satilik", "kiralik", "gunluk", "isyeri", "deniz"]) delete score[k];
  }
  // "bot ayakkabı" tekne değildir; "motor yağı/parçası" motosiklet değildir.
  if (/bot ayakkabı|botlar/.test(t)) delete score.deniz;
  if (/arazi aracı|arazi taşıtı/.test(t)) delete score.arsa;
  // Emlak: konut sözcükleri varsa kiralık > günlük > satılık ayrımı; "kat karşılığı" arsadır.
  if (score.satilik && (score.kiralik || score.gunluk)) delete score.satilik;
  if (score.gunluk && score.kiralik && /günlük|haftalık|tatil|yazlık/.test(t)) delete score.kiralik;
  if (/kat karşılığı/.test(t)) { delete score.satilik; score.arsa = (score.arsa ?? 0) + 5; }
  if (score.arsa && score.satilik) delete score.satilik;
  // "kiralık dükkan / satılık ofis": kiralık-satılık sözcüğü işyerinin niteliğidir, konut değil.
  if (score.isyeri) { delete score.kiralik; delete score.satilik; delete score.gunluk; }
  let best: string | null = null;
  for (const [id, s] of Object.entries(score)) if (allowed.has(id) && (best === null || s > score[best]!)) best = id;
  return best;
}
