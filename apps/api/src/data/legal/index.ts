import { CEREZ } from "./cerez.js";
import { GUVENLI_ALISVERIS, HAK_IHLALI, HESAP_SILME } from "./diger.js";
import { GUVENLI_AL } from "./guvenli-al.js";
import { SATICI_KURALLARI, TALEP_KURALLARI, YASAKLI } from "./kurallar.js";
import { KVKK, KVKK_BASVURU } from "./kvkk.js";
import { MESAFELI, ON_BILGI } from "./mesafeli.js";
import { ACIK_RIZA, ETI } from "./riza.js";
import type { LegalDoc } from "./types.js";
import { UYELIK } from "./uyelik.js";

export type { LegalDoc, LegalSection } from "./types.js";

// Sözleşmeler ve Kurallar sayfasındaki sıra.
export const LEGAL_DOCS: LegalDoc[] = [
  UYELIK, TALEP_KURALLARI, YASAKLI, SATICI_KURALLARI, GUVENLI_AL, ON_BILGI, MESAFELI,
  KVKK, ACIK_RIZA, ETI, CEREZ, KVKK_BASVURU, HAK_IHLALI, HESAP_SILME, GUVENLI_ALISVERIS,
];
export const legalDoc = (slug: string) => LEGAL_DOCS.find((d) => d.slug === slug);

// Üyenin Platform'u kullanmadan önce onaylaması gereken metin; eklerini (kurallar, yasaklı liste) de kapsar.
export const TERMS_SLUG = UYELIK.slug;
// Onayı kaydedilen metinler (consents.doc): her biri kendi sürümüyle.
export const CONSENT_DOCS = LEGAL_DOCS.filter((d) => d.consent).map((d) => d.slug);
export const currentVersion = (slug: string) => legalDoc(slug)?.version ?? null;
