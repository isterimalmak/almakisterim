"use client";

export function PrintButton() {
  return <button type="button" className="link" onClick={() => window.print()}>Yazdır / PDF olarak kaydet</button>;
}
