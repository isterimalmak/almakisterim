import { describe, expect, it } from "vitest";
import { EMPTY_SHA256, R2Storage, signV4 } from "../src/services/storage.js";

// AWS belgelerindeki resmi örneklerle imza hesabı doğrulanır (R2 aynı imzayı kullanır).
const AWS = { accessKeyId: "AKIAIOSFODNN7EXAMPLE", secret: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", region: "us-east-1", service: "s3", now: new Date("2013-05-24T00:00:00Z") };

describe("R2 / S3 imzası (Signature V4)", () => {
  it("imzalı adres (presigned URL) AWS örneğiyle aynı", () => {
    const s = signV4({ ...AWS, method: "GET", host: "examplebucket.s3.amazonaws.com", path: "/test.txt", payloadHash: "UNSIGNED-PAYLOAD", presignExpires: 86400 });
    expect(s.signature).toBe("aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404");
  });

  it("başlıkla imzalanan istek AWS örneğiyle aynı", () => {
    const s = signV4({
      ...AWS, method: "GET", host: "examplebucket.s3.amazonaws.com", path: "/test.txt", payloadHash: EMPTY_SHA256,
      headers: { range: "bytes=0-9", "x-amz-content-sha256": EMPTY_SHA256, "x-amz-date": "20130524T000000Z" },
    });
    expect(s.signature).toBe("f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41");
  });

  it("yükleme adresi boyut ve türü imzaya dahil eder, anahtarı içermez", () => {
    const r2 = new R2Storage({ accountId: "hesap123", accessKeyId: "ERISIM", secret: "COK-GIZLI", bucket: "almakisterim-media", publicBase: "https://medya.example.com/" }, () => AWS.now);
    const t = r2.presignPut("image/2026-10/abc.jpg", "image/jpeg", 1234);
    const u = new URL(t.url);
    expect(u.host).toBe("hesap123.r2.cloudflarestorage.com");
    expect(u.pathname).toBe("/almakisterim-media/image/2026-10/abc.jpg");
    expect(u.searchParams.get("X-Amz-SignedHeaders")).toBe("content-length;content-type;host");
    expect(u.searchParams.get("X-Amz-Credential")).toBe("ERISIM/20130524/auto/s3/aws4_request");
    expect(u.searchParams.get("X-Amz-Expires")).toBe("600");
    expect(t.url).not.toContain("COK-GIZLI");
    expect(r2.publicUrl("image/2026-10/abc.jpg")).toBe("https://medya.example.com/image/2026-10/abc.jpg");
  });
});
