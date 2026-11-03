// Arama sayfaları: insanların Google'da yazdığı aramalara ("nakit araba alanlar", "arabamı satmak istiyorum",
// "sahibinden satılık ev") cevap veren kalıcı sayfalar. Talep az olsa da sayfa dolu görünür: konuya özel metin, canlı sayılar,
// güncel talepler, adımlar ve sık sorulan sorular. Adres: /nakit-araba-alanlar, il için /nakit-araba-alanlar/izmir.
// "sat": aramayı yapan satıcıdır (elindekini satacak alıcı arıyor) → talepleri görür, alarm kurar.
// "al": aramayı yapan alıcıdır (sahibinden ürün arıyor) → ücretsiz talep verir, sahipleri ona ulaşır.

export type Landing = {
  slug: string; kind: "sat" | "al"; top: string; sub?: string;
  h1: string; title: string; description: string; intro: string[];
  // Sayfa içi yazılarda kullanılan ürün adı: "araba", "arabanızı", "araba almak isteyen".
  n: string; acc: string; metin: string;
  faq: [string, string][]; related: string[];
  // Marka sayfalarına bağlantı (araç ve telefon sayfalarında).
  brands?: "arac" | "telefon";
  // Talep listesine eklenen süzgeç (ör. yalnız Apple telefonlar: { a_marka: "Apple" }).
  filters?: Record<string, string>;
};

// İl sayfası olarak arama motorlarına her zaman açılan büyük iller; diğer iller ancak o ilde talep varsa açılır.
export const BIG_CITIES = ["İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Konya", "Adana", "Gaziantep", "Kocaeli", "Mersin", "Kayseri", "Eskişehir", "Samsun", "Denizli", "Sakarya"];

const satFaq = (n: string, acc: string): [string, string][] => [
  [`${cap(acc)} kime satabilirim?`, `almakisterim.com'da ${n} almak isteyen alıcılar ne aradığını, bütçesini ve ilini yazar. Elinizdeki ${n} bir talebe uyuyorsa alıcıya doğrudan ulaşır, aracısız satarsınız.`],
  [`${cap(acc)} satmak için ilan vermem gerekir mi?`, `Hayır. Burada ilanı alıcı verir. Siz yalnızca ${n} arayan alıcıların taleplerine bakar, uygun olanla iletişime geçersiniz. Uygun talep yoksa alarm kurun; yeni alıcı gelince size haber verelim.`],
  [`Alıcıya nasıl ulaşırım, ücretli mi?`, `Talebi açıp "Numarayı Gör" ya da "Mesaj Yaz" düğmesine basmanız yeterli. Üyelik ücretsizdir; her ay ücretsiz numara görme hakkınız vardır.`],
  [`Güvenli satış için nelere dikkat etmeliyim?`, `Kapora istemeyin ve göndermeyin, ödemeyi ${n} teslim edilirken alın. Kargolu satışlarda Güvenli Al ile ödeme siz teslim edene kadar bizde bekler. Şüpheli talepleri bize bildirin.`],
];
const alFaq = (n: string): [string, string][] => [
  [`Sahibinden ${n} nasıl bulurum?`, `almakisterim.com'da ne aradığınızı ücretsiz yazarsınız: model, bütçe, il. Elinde uygun ${n} olan sahipleri ve satıcılar size ulaşır; ilan ilan gezmenize gerek kalmaz.`],
  [`Talep vermek ücretli mi?`, `Hayır, talep vermek ücretsizdir. Telefon numaranızı kaç satıcının göreceğini siz seçersiniz; istediğiniz an gizleyebilirsiniz.`],
  [`Aracı ya da emlakçı arar mı?`, `Talebinizi gören herkes size ulaşabilir; sahibinden satanlarla doğrudan görüşürsünüz. Rahatsız eden satıcıyı tek dokunuşla şikâyet eder, numaranızı ondan gizlersiniz.`],
  [`Aradığımı bulunca ne yapmalıyım?`, `Talebinizi "Aldım / Talebi kapat" ile kapatın; numaranız yeni satıcılara gösterilmez. Ürünü görmeden kapora ya da ödeme göndermeyin.`],
];
const cap = (s: string) => s.charAt(0).toLocaleUpperCase("tr") + s.slice(1);

export const LANDINGS: Landing[] = [
  // ---------- Vasıta: satıcı ----------
  {
    slug: "nakit-araba-alanlar", kind: "sat", top: "vasita", n: "araba", acc: "arabanızı", metin: "", brands: "arac",
    h1: "Nakit Araba Alanlar", title: "Nakit Araba Alanlar – Arabanızı Peşin Parayla Hemen Satın",
    description: "Nakit araba alan alıcıların güncel talepleri: marka, model, bütçe ve il. Arabanızı galericiye düşük fiyata vermeden, peşin almak isteyen alıcıya doğrudan satın.",
    intro: [
      "Arabanızı hızlı ve nakit satmak istiyorsanız alıcı aramakla vakit kaybetmeyin: almakisterim.com'da araba almak isteyen alıcılar ne aradığını, bütçesini ve ilini kendisi yazar.",
      "Aşağıda peşin araç almak isteyen alıcıların açık talepleri var. Elinizdeki araç bir talebe uyuyorsa alıcıya doğrudan ulaşın; galeri ya da aracı komisyonu yok.",
    ],
    faq: [["Nakit araba alanlar güvenilir mi?", "Talepler yayından önce incelenir, alıcılar telefon numarasıyla doğrulanır. Yine de ödemeyi noterde, araç devri sırasında alın; kapora göndermeyin."], ...satFaq("araba", "arabanızı")],
    related: ["arabami-satmak-istiyorum", "araba-alanlar", "hasarli-araba-alanlar", "sahibinden-araba"],
  },
  {
    slug: "arabami-satmak-istiyorum", kind: "sat", top: "vasita", n: "araba", acc: "arabanızı", metin: "", brands: "arac",
    h1: "Arabamı Satmak İstiyorum", title: "Arabamı Satmak İstiyorum – Araba Almak İsteyen Alıcılar Burada",
    description: "Arabanızı satmak mı istiyorsunuz? İlan vermeden, araba almak isteyen alıcıların taleplerine bakın; markanıza, bütçenize ve ilinize uyan alıcıya doğrudan ulaşın.",
    intro: [
      "\"Arabamı satmak istiyorum ama kime?\" sorusunun cevabı burada. almakisterim.com'da ilanı satıcı değil alıcı verir: hangi marka ve modeli, hangi yıl aralığında, kaç liraya almak istediğini yazar.",
      "Sizin yapmanız gereken, arabanıza uyan talebi bulup alıcıyla görüşmek. Uygun talep yoksa markanız için alarm kurun; yeni alıcı geldiğinde size haber verelim.",
    ],
    faq: satFaq("araba", "arabanızı"),
    related: ["nakit-araba-alanlar", "araba-alanlar", "motorumu-satmak-istiyorum", "araba-almak-istiyorum"],
  },
  {
    slug: "araba-alanlar", kind: "sat", top: "vasita", n: "araba", acc: "arabanızı", metin: "", brands: "arac",
    h1: "Araba Alanlar", title: "Araba Alanlar – İkinci El Araba Almak İsteyen Alıcıların Talepleri",
    description: "İkinci el araba alan alıcılar ve bütçeleri: hangi marka, model ve ilde araba aranıyor, hepsi burada. Arabanıza uyan alıcıyı bulun, doğrudan satın.",
    intro: [
      "İkinci el araba alanları tek tek aramak yerine, araba almak isteyenlerin kendi yazdığı taleplere bakın. Her talepte istenen marka ve model, yıl ve kilometre aralığı, bütçe ve il yazar.",
      "Bireysel alıcıların yanında filo ve şirket alımları da burada. Arabanız hangi talebe uyuyorsa o alıcıyla doğrudan görüşün.",
    ],
    faq: satFaq("araba", "arabanızı"),
    related: ["nakit-araba-alanlar", "arabami-satmak-istiyorum", "hasarli-araba-alanlar", "sahibinden-satilik-araba"],
  },
  {
    slug: "hasarli-araba-alanlar", kind: "sat", top: "vasita", n: "araç", acc: "aracınızı", metin: "", brands: "arac",
    h1: "Hasarlı Araba Alanlar", title: "Hasarlı Araba Alanlar – Hasarlı, Kazalı Aracınızı Satın",
    description: "Hasarlı, kazalı ya da ağır hasar kayıtlı araç almak isteyen alıcıların talepleri. Aracınızın durumunu açıkça yazın, uygun alıcıyla doğrudan görüşün.",
    intro: [
      "Hasarlı ya da kazalı aracınızı satmak zor olabilir; ama bu tür araçları özellikle arayan alıcılar da var. Talep sahipleri \"hasarsız\" şartı koymadıysa hasarlı araçlara da açıktır.",
      "Alıcıyla görüşürken hasar kaydını, tramer tutarını ve değişen parçaları açıkça söyleyin; sonradan anlaşmazlık çıkmaz.",
    ],
    faq: satFaq("araç", "aracınızı"),
    related: ["nakit-araba-alanlar", "araba-alanlar", "arabami-satmak-istiyorum"],
  },
  {
    slug: "motorumu-satmak-istiyorum", kind: "sat", top: "vasita", sub: "motosiklet", n: "motosiklet", acc: "motorunuzu", metin: "",
    h1: "Motorumu Satmak İstiyorum", title: "Motorumu Satmak İstiyorum – Motosiklet Alanlar",
    description: "Motosiklet almak isteyen alıcıların talepleri: marka, model, bütçe ve il. Motorunuzu ilan vermeden doğrudan alıcıya satın.",
    intro: [
      "Motosikletinizi satmak istiyorsanız motosiklet arayan alıcıların taleplerine bakın; scooter'dan büyük motorlara kadar her talepte istenen model ve bütçe yazar.",
      "Uygun talep yoksa motosiklet için alarm kurun; yeni alıcı geldiğinde size haber verelim.",
    ],
    faq: satFaq("motosiklet", "motorunuzu"),
    related: ["arabami-satmak-istiyorum", "nakit-araba-alanlar"],
  },
  // ---------- Vasıta: alıcı ----------
  {
    slug: "sahibinden-araba", kind: "al", top: "vasita", n: "araba", acc: "arabayı", metin: "Sahibinden araba almak istiyorum, ", brands: "arac",
    h1: "Sahibinden Araba", title: "Sahibinden Araba – Aradığınız Arabayı Yazın, Sahipleri Size Ulaşsın",
    description: "Sahibinden araba mı arıyorsunuz? İlan ilan gezmeyin: istediğiniz marka, model, yıl ve bütçeyi ücretsiz yazın, arabası olan sahipleri size ulaşsın.",
    intro: [
      "Sahibinden araba bulmak için yüzlerce ilana bakmak yerine tersini yapın: ne aradığınızı bir kez yazın. Model, yıl aralığı, kilometre, vites ve bütçe yazdığınız talebi gören araç sahipleri size ulaşır.",
      "Talep vermek ücretsizdir; numaranızı kaç kişinin göreceğini siz seçersiniz. Aşağıda sizin gibi araba arayan alıcıların talepleri var.",
    ],
    faq: alFaq("araba"),
    related: ["sahibinden-satilik-araba", "araba-almak-istiyorum", "nakit-araba-alanlar"],
  },
  {
    slug: "sahibinden-satilik-araba", kind: "al", top: "vasita", n: "araba", acc: "arabayı", metin: "Sahibinden satılık araba arıyorum, ", brands: "arac",
    h1: "Sahibinden Satılık Araba", title: "Sahibinden Satılık Araba Arayanlar – Ücretsiz Talep Verin",
    description: "Sahibinden satılık araba arayanlar için: istediğiniz arabayı ve bütçenizi yazın, aracını satmak isteyen sahipleri size doğrudan ulaşsın. Galeri yok, aracı yok.",
    intro: [
      "Sahibinden satılık araba arıyorsanız aradığınız aracı tarif edin, gerisini satıcılara bırakın. Talebiniz ilgili marka ve modelin alarmını kuran satıcılara anında iletilir.",
      "Birden fazla marka ve model seçebilirsiniz; her biri ayrı talep olarak yayınlanır ve doğru satıcılara gider.",
    ],
    faq: alFaq("araba"),
    related: ["sahibinden-araba", "araba-almak-istiyorum", "araba-alanlar"],
  },
  {
    slug: "araba-almak-istiyorum", kind: "al", top: "vasita", n: "araba", acc: "arabayı", metin: "Araba almak istiyorum, ", brands: "arac",
    h1: "Araba Almak İstiyorum", title: "Araba Almak İstiyorum – Bütçenizi Yazın, Satıcılar Size Gelsin",
    description: "Araba almak istiyorsanız aradığınız modeli ve bütçenizi ücretsiz yazın. Elinde uygun araba olan sahipleri ve satıcılar size ulaşsın, siz seçin.",
    intro: [
      "\"Araba almak istiyorum ama hangisi, nereden?\" diyorsanız tek cümle yazmanız yeterli: \"2018 sonrası dizel otomatik Passat, 1,2 milyona kadar, İstanbul\" gibi. Yapay zekâ talebinizi sizin için düzenler.",
      "Talebiniz yayınlanınca uygun arabası olan satıcılar size ulaşır; teklifleri karşılaştırıp en uygununu seçersiniz.",
    ],
    faq: alFaq("araba"),
    related: ["sahibinden-araba", "sahibinden-satilik-araba", "arabami-satmak-istiyorum"],
  },
  // ---------- Emlak ----------
  {
    slug: "evimi-satmak-istiyorum", kind: "sat", top: "emlak", sub: "satilik", n: "ev", acc: "evinizi", metin: "",
    h1: "Evimi Satmak İstiyorum", title: "Evimi Satmak İstiyorum – Ev Almak İsteyen Alıcılar Burada",
    description: "Evinizi satmak mı istiyorsunuz? Ev almak isteyen alıcıların talepleri: il, ilçe, oda sayısı ve bütçe. Evinize uyan alıcıya emlakçısız, doğrudan ulaşın.",
    intro: [
      "Evinizi satmak için ilan verip beklemek yerine, ev almak isteyen alıcıların taleplerine bakın. Her talepte istenen il ve ilçe, oda sayısı, metrekare ve bütçe yazar.",
      "Evinize uyan alıcıyla doğrudan görüşün. Uygun talep yoksa ilçeniz için alarm kurun; yeni alıcı gelince size haber verelim.",
    ],
    faq: satFaq("ev", "evinizi"),
    related: ["sahibinden-satilik-ev", "sahibinden-satilik-daire", "arsami-satmak-istiyorum"],
  },
  {
    slug: "arsami-satmak-istiyorum", kind: "sat", top: "emlak", sub: "arsa", n: "arsa", acc: "arsanızı", metin: "",
    h1: "Arsamı Satmak İstiyorum", title: "Arsamı Satmak İstiyorum – Arsa, Tarla Alanlar",
    description: "Arsa ve tarla almak isteyen alıcıların talepleri: il, ilçe, metrekare, imar durumu ve bütçe. Arsanızı doğrudan alıcıya satın.",
    intro: [
      "Arsa ya da tarla almak isteyenler ne aradığını açıkça yazar: hangi ilçede, kaç metrekare, konut mu ticari mi, imarlı mı. Arsanıza uyan talebi bulun, alıcıyla doğrudan görüşün.",
      "Tapu durumunu ve imar bilgisini baştan paylaşmak satışı hızlandırır.",
    ],
    faq: satFaq("arsa", "arsanızı"),
    related: ["evimi-satmak-istiyorum", "sahibinden-satilik-arsa"],
  },
  {
    slug: "sahibinden-satilik-ev", kind: "al", top: "emlak", sub: "satilik", n: "ev", acc: "evi", metin: "Sahibinden satılık ev arıyorum, ",
    h1: "Sahibinden Satılık Ev", title: "Sahibinden Satılık Ev Arayanlar – Emlakçısız Ev Bulun",
    description: "Sahibinden satılık ev mi arıyorsunuz? İstediğiniz il, ilçe, oda sayısı ve bütçeyi ücretsiz yazın; evini satmak isteyen sahipleri size doğrudan ulaşsın.",
    intro: [
      "Sahibinden satılık ev ararken ilanların çoğu emlakçılardan çıkar. Burada tersini yaparsınız: aradığınız evi tarif edersiniz, evini satmak isteyen sahipleri size ulaşır.",
      "İl, ilçe ve mahalle, oda sayısı, metrekare, bina yaşı ve bütçenizi yazın. Numaranızı kaç kişinin göreceğini siz seçersiniz.",
    ],
    faq: alFaq("ev"),
    related: ["sahibinden-satilik-daire", "sahibinden-kiralik-ev", "evimi-satmak-istiyorum"],
  },
  {
    slug: "sahibinden-satilik-daire", kind: "al", top: "emlak", sub: "satilik", n: "daire", acc: "daireyi", metin: "Sahibinden satılık daire arıyorum, ",
    h1: "Sahibinden Satılık Daire", title: "Sahibinden Satılık Daire – Aradığınız Daireyi Yazın, Sahipleri Ulaşsın",
    description: "Sahibinden satılık daire arayanlar için ücretsiz talep: 2+1, 3+1, ilçe ve bütçenizi yazın, dairesini satmak isteyen sahipleri size ulaşsın.",
    intro: [
      "2+1, 3+1 ya da bahçeli daire… Aradığınız daireyi bir kez yazın; o ilçede dairesini satmak isteyen sahipleri talebinizi görür ve size ulaşır.",
      "Kredili mi peşin mi alacağınızı, kat ve site tercihlerinizi açıklamaya yazmanız doğru tekliflerin gelmesini sağlar.",
    ],
    faq: alFaq("daire"),
    related: ["sahibinden-satilik-ev", "sahibinden-kiralik-ev", "evimi-satmak-istiyorum"],
  },
  {
    slug: "sahibinden-kiralik-ev", kind: "al", top: "emlak", sub: "kiralik", n: "kiralık ev", acc: "evi", metin: "Sahibinden kiralık ev arıyorum, ",
    h1: "Sahibinden Kiralık Ev", title: "Sahibinden Kiralık Ev Arayanlar – Ev Sahipleri Size Ulaşsın",
    description: "Sahibinden kiralık ev ya da daire mi arıyorsunuz? İl, ilçe, oda sayısı ve kira bütçenizi yazın; evini kiraya vermek isteyen sahipleri size ulaşsın.",
    intro: [
      "Kiralık ev ararken komisyon ödemek istemiyorsanız aradığınız evi yazın: hangi ilçe, kaç oda, eşyalı mı, kira bütçeniz ne. Evini kiraya vermek isteyen sahipleri size ulaşır.",
      "Öğrenci, aile ya da tek kişi olduğunuzu ve taşınma tarihinizi açıklamaya eklemeniz ev sahiplerinin karar vermesini kolaylaştırır.",
    ],
    faq: alFaq("kiralık ev"),
    related: ["sahibinden-satilik-ev", "sahibinden-satilik-daire"],
  },
  {
    slug: "sahibinden-satilik-arsa", kind: "al", top: "emlak", sub: "arsa", n: "arsa", acc: "arsayı", metin: "Sahibinden satılık arsa arıyorum, ",
    h1: "Sahibinden Satılık Arsa", title: "Sahibinden Satılık Arsa ve Tarla Arayanlar – Ücretsiz Talep",
    description: "Sahibinden satılık arsa ya da tarla mı arıyorsunuz? İl, ilçe, metrekare, imar durumu ve bütçenizi yazın; arsasını satmak isteyen sahipleri size ulaşsın.",
    intro: [
      "Konut imarlı arsa, bağ, bahçe ya da tarla… Aradığınızı ve bütçenizi yazın; o bölgede arsası olan sahipleri talebinizi görür.",
      "Tapu türü (müstakil, hisseli) ve imar tercihinizi belirtmeniz zaman kaybını önler.",
    ],
    faq: alFaq("arsa"),
    related: ["arsami-satmak-istiyorum", "sahibinden-satilik-ev"],
  },
  // ---------- Elektronik ----------
  {
    slug: "telefonumu-satmak-istiyorum", kind: "sat", top: "elektronik", sub: "telefon", n: "telefon", acc: "telefonunuzu", metin: "", brands: "telefon",
    h1: "Telefonumu Satmak İstiyorum", title: "Telefonumu Satmak İstiyorum – İkinci El Telefon Alanlar",
    description: "Telefonunuzu satmak mı istiyorsunuz? iPhone, Samsung, Xiaomi almak isteyen alıcıların talepleri: model, hafıza, bütçe ve il. Doğrudan alıcıya satın.",
    intro: [
      "Telefonunuzu satmak için mağazaya düşük fiyata vermeden önce, telefon almak isteyen alıcıların taleplerine bakın. Her talepte istenen marka ve model, hafıza ve bütçe yazar.",
      "Elinizdeki model bir talebe uyuyorsa alıcıya doğrudan ulaşın. Uygun talep yoksa modeliniz için alarm kurun.",
    ],
    faq: satFaq("telefon", "telefonunuzu"),
    related: ["ikinci-el-telefon-alanlar", "sahibinden-ikinci-el-telefon", "laptopumu-satmak-istiyorum"],
  },
  {
    slug: "ikinci-el-telefon-alanlar", kind: "sat", top: "elektronik", sub: "telefon", n: "telefon", acc: "telefonunuzu", metin: "", brands: "telefon",
    h1: "İkinci El Telefon Alanlar", title: "İkinci El Telefon Alanlar – Nakit Telefon Alan Alıcılar",
    description: "İkinci el telefon alan alıcıların güncel talepleri: iPhone, Samsung ve diğer modeller, hafıza, garanti ve bütçe. Telefonunuzu en iyi fiyata doğrudan satın.",
    intro: [
      "İkinci el telefon alanları aramak yerine, telefon almak isteyenlerin yazdığı taleplere bakın: hangi model, kaç GB, garantili mi, bütçe ne.",
      "Telefonunuzun kutusu, faturası ve pil sağlığı bilgisi alıcının hızlı karar vermesini sağlar.",
    ],
    faq: satFaq("telefon", "telefonunuzu"),
    related: ["telefonumu-satmak-istiyorum", "sahibinden-ikinci-el-telefon"],
  },
  {
    slug: "sahibinden-ikinci-el-telefon", kind: "al", top: "elektronik", sub: "telefon", n: "telefon", acc: "telefonu", metin: "Sahibinden ikinci el telefon almak istiyorum, ", brands: "telefon",
    h1: "Sahibinden İkinci El Telefon", title: "Sahibinden İkinci El Telefon – İstediğiniz Modeli Yazın",
    description: "Sahibinden ikinci el iPhone ya da Samsung mu arıyorsunuz? Model, hafıza ve bütçenizi ücretsiz yazın; telefonunu satmak isteyenler size ulaşsın.",
    intro: [
      "Sahibinden ikinci el telefon ararken aradığınız modeli, hafızayı ve bütçenizi yazın. Elinde o telefon olan satıcılar size ulaşır.",
      "Garantili, kutulu ya da faturalı olmasını istiyorsanız talebinizde belirtin.",
    ],
    faq: alFaq("telefon"),
    related: ["ikinci-el-telefon-alanlar", "telefonumu-satmak-istiyorum"],
  },
  {
    slug: "laptopumu-satmak-istiyorum", kind: "sat", top: "elektronik", sub: "bilgisayar", n: "bilgisayar", acc: "bilgisayarınızı", metin: "",
    h1: "Laptopumu Satmak İstiyorum", title: "Laptopumu Satmak İstiyorum – İkinci El Bilgisayar Alanlar",
    description: "Laptop ve bilgisayar almak isteyen alıcıların talepleri: marka, model, işlemci, bütçe. Bilgisayarınızı doğrudan alıcıya satın.",
    intro: [
      "Dizüstü ya da masaüstü bilgisayarınızı satmak istiyorsanız bilgisayar arayan alıcıların taleplerine bakın; öğrenciden oyuncuya, her talepte ihtiyaç ve bütçe yazar.",
      "İşlemci, RAM, depolama ve pil durumunu paylaşmanız alıcının karar vermesini hızlandırır.",
    ],
    faq: satFaq("bilgisayar", "bilgisayarınızı"),
    related: ["telefonumu-satmak-istiyorum", "ikinci-el-telefon-alanlar"],
  },
  // ---------- Ev & Yaşam ----------
  {
    slug: "ikinci-el-esya-alanlar", kind: "sat", top: "ev", n: "eşya", acc: "eşyanızı", metin: "",
    h1: "İkinci El Eşya Alanlar", title: "İkinci El Eşya Alanlar – Mobilya, Beyaz Eşya Alan Alıcılar",
    description: "İkinci el eşya alan alıcıların talepleri: mobilya, beyaz eşya, küçük ev aletleri. Eşyanızı taşınmadan önce doğrudan alıcıya satın.",
    intro: [
      "Taşınıyor ya da eşya yeniliyorsanız ikinci el eşya alanları aramak yerine eşya almak isteyenlerin taleplerine bakın: koltuk takımı, yemek masası, buzdolabı, çamaşır makinesi…",
      "Alıcıların çoğu kendi ilçesinde arar; eşyanız aynı ildeki bir talebe uyuyorsa nakliye derdi de kalmaz.",
    ],
    faq: satFaq("eşya", "eşyanızı"),
    related: ["beyaz-esya-alanlar", "evimi-satmak-istiyorum"],
  },
  {
    slug: "beyaz-esya-alanlar", kind: "sat", top: "ev", sub: "beyaz", n: "beyaz eşya", acc: "beyaz eşyanızı", metin: "",
    h1: "Beyaz Eşya Alanlar", title: "İkinci El Beyaz Eşya Alanlar – Buzdolabı, Çamaşır Makinesi Alan Alıcılar",
    description: "İkinci el beyaz eşya alan alıcıların talepleri: buzdolabı, çamaşır ve bulaşık makinesi, fırın. Beyaz eşyanızı doğrudan alıcıya satın.",
    intro: [
      "Buzdolabı, çamaşır makinesi, bulaşık makinesi ya da fırın satmak istiyorsanız beyaz eşya arayan alıcıların taleplerine bakın; marka, enerji sınıfı ve bütçe her talepte yazar.",
      "Cihazın yaşını ve çalışır durumda olduğunu gösteren kısa bir video satışı kolaylaştırır.",
    ],
    faq: satFaq("beyaz eşya", "beyaz eşyanızı"),
    related: ["ikinci-el-esya-alanlar"],
  },
  // ---------- Çok aranan diğer satıcı aramaları ----------
  {
    slug: "hurda-arac-alanlar", kind: "sat", top: "vasita", n: "araç", acc: "aracınızı", metin: "", brands: "arac",
    h1: "Hurda Araç Alanlar", title: "Hurda Araç Alanlar – Eski, Hurda ve Pert Aracınızı Satın",
    description: "Hurda, eski ya da pert kayıtlı araç almak isteyen alıcıların talepleri. Aracınızın yaşını ve durumunu yazın, uygun alıcıyla doğrudan görüşün.",
    intro: [
      "Eski ya da hurda aracınız için alıcı arıyorsanız düşük model ve yüksek kilometreli araç arayan alıcıların taleplerine bakın; yedek parça için ya da hurda teşviki için araç arayanlar da burada.",
      "Ruhsat, muayene ve borç durumunu baştan söylemek pazarlığı kolaylaştırır. Hurdaya ayırma işlemlerini yetkili kuruluşlar üzerinden yapın.",
    ],
    faq: satFaq("araç", "aracınızı"),
    related: ["hasarli-araba-alanlar", "nakit-araba-alanlar", "arabami-satmak-istiyorum"],
  },
  {
    slug: "ticari-arac-alanlar", kind: "sat", top: "vasita", sub: "ticari", n: "ticari araç", acc: "ticari aracınızı", metin: "",
    h1: "Ticari Araç Alanlar", title: "Ticari Araç Alanlar – Kamyonet, Panelvan, Minibüs Alan Alıcılar",
    description: "Ticari araç almak isteyen alıcıların talepleri: kamyonet, panelvan, minibüs, kamyon. Ticari aracınızı doğrudan alıcıya satın.",
    intro: [
      "Doblo, Transit, Sprinter, Caddy… Ticari araç arayan esnaf ve şirketlerin taleplerine bakın; her talepte istenen model, yıl ve bütçe yazar.",
      "Filo yenileyen şirketlerin toplu alım talepleri de burada; birden fazla aracınız varsa tek seferde satabilirsiniz.",
    ],
    faq: satFaq("ticari araç", "ticari aracınızı"),
    related: ["nakit-araba-alanlar", "araba-alanlar"],
  },
  {
    slug: "iphone-alanlar", kind: "sat", top: "elektronik", sub: "telefon", filters: { a_marka: "Apple" }, n: "iPhone", acc: "iPhone'unuzu", metin: "", brands: "telefon",
    h1: "iPhone Alanlar", title: "iPhone Alanlar – İkinci El iPhone'unuzu Hemen Satın",
    description: "İkinci el iPhone almak isteyen alıcıların talepleri: model, hafıza, pil sağlığı ve bütçe. iPhone'unuzu mağazaya düşük fiyata vermeden doğrudan satın.",
    intro: [
      "iPhone'unuzu satmak istiyorsanız iPhone arayan alıcıların taleplerine bakın: hangi model, kaç GB, garantili mi, kutulu mu, bütçe ne.",
      "Pil sağlığı yüzdesi, değişen parça olup olmadığı ve iCloud hesabının kapalı olduğu bilgisi alıcının güvenini artırır.",
    ],
    faq: satFaq("iPhone", "iPhone'unuzu"),
    related: ["ikinci-el-telefon-alanlar", "telefonumu-satmak-istiyorum"],
  },
  {
    slug: "oyun-konsolu-alanlar", kind: "sat", top: "elektronik", sub: "oyun", n: "oyun konsolu", acc: "konsolunuzu", metin: "",
    h1: "Oyun Konsolu Alanlar", title: "PS5, PS4, Xbox Alanlar – Oyun Konsolunuzu Satın",
    description: "PlayStation, Xbox ve Nintendo almak isteyen alıcıların talepleri. Oyun konsolunuzu, kolunuzu ve oyunlarınızı doğrudan alıcıya satın.",
    intro: [
      "PS5, PS4, Xbox ya da Nintendo Switch satmak istiyorsanız konsol arayan alıcıların taleplerine bakın; kol sayısı, oyunlar ve bütçe her talepte yazar.",
      "Garanti ve fatura bilgisini, varsa oyunları ve ek kolları paylaşmak satışı hızlandırır.",
    ],
    faq: satFaq("oyun konsolu", "konsolunuzu"),
    related: ["telefonumu-satmak-istiyorum", "laptopumu-satmak-istiyorum"],
  },
  {
    slug: "spot-esya-alanlar", kind: "sat", top: "ev", n: "eşya", acc: "eşyanızı", metin: "",
    h1: "Spot Eşya Alanlar", title: "Spot Eşya Alanlar – Spotçuya Vermeden Eşyanızı Değerinde Satın",
    description: "Spotçuya düşük fiyata vermeden önce, eşya almak isteyen alıcıların taleplerine bakın: koltuk, yatak odası, beyaz eşya, ev aletleri. Doğrudan alıcıya satın.",
    intro: [
      "Spotçular eşyanızı genelde değerinin çok altında alır. Burada eşyayı kullanacak kişilerin kendi yazdığı taleplere bakarsınız: hangi eşya, hangi ilçede, kaç liraya.",
      "Tüm evi boşaltacaksanız eşyaları tek tek de satabilir, toplu alım isteyen alıcılarla da görüşebilirsiniz.",
    ],
    faq: satFaq("eşya", "eşyanızı"),
    related: ["ikinci-el-esya-alanlar", "ikinci-el-koltuk-alanlar", "beyaz-esya-alanlar"],
  },
  {
    slug: "ikinci-el-koltuk-alanlar", kind: "sat", top: "ev", sub: "mobilya", n: "mobilya", acc: "mobilyanızı", metin: "",
    h1: "İkinci El Koltuk ve Mobilya Alanlar", title: "İkinci El Koltuk Alanlar – Mobilya, Yatak Odası Alan Alıcılar",
    description: "İkinci el koltuk takımı, yatak odası, yemek odası almak isteyen alıcıların talepleri. Mobilyanızı doğrudan alıcıya satın.",
    intro: [
      "Koltuk takımı, köşe koltuk, yatak odası ya da yemek masası satmak istiyorsanız mobilya arayan alıcıların taleplerine bakın; ölçü, renk ve bütçe her talepte yazar.",
      "Ölçüleri ve birkaç net fotoğrafı paylaşmak, alıcının evine sığıp sığmayacağını hemen anlamasını sağlar.",
    ],
    faq: satFaq("mobilya", "mobilyanızı"),
    related: ["spot-esya-alanlar", "ikinci-el-esya-alanlar"],
  },
];

export const landingBySlug = (slug: string) => LANDINGS.find((l) => l.slug === slug);
