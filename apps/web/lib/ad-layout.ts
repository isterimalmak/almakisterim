// Reklam ızgarası ikişerli dizilir; sayı tekse son reklam tam genişlikte durur, böylece yanında boşluk kalmaz.
export const isWide = (i: number, n: number) => n % 2 === 1 && i === n - 1;
