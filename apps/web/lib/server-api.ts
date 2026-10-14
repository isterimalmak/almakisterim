// Sunucuda çalışan sayfalar (blog) API'ye doğrudan bağlanır; adres derleme sırasında gömülür (next.config.ts → env).
const ORIGIN = process.env.API_ORIGIN ?? "http://localhost:8080";

export async function serverApi<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${ORIGIN}/api${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
