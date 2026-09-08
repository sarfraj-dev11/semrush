/**
 * Industry Standard Organic CTR Curve (Advanced Web Ranking / Semrush benchmark)
 * Translates Google SERP ranking position into realistic monthly organic visitor traffic.
 */
export function getEstimatedCtr(position: number | null | undefined): number {
  if (!position || position <= 0) return 0;
  if (position === 1) return 0.285; // 28.5%
  if (position === 2) return 0.155; // 15.5%
  if (position === 3) return 0.110; // 11.0%
  if (position === 4) return 0.080; // 8.0%
  if (position === 5) return 0.062; // 6.2%
  if (position === 6) return 0.048; // 4.8%
  if (position === 7) return 0.038; // 3.8%
  if (position === 8) return 0.030; // 3.0%
  if (position === 9) return 0.024; // 2.4%
  if (position === 10) return 0.020; // 2.0%
  if (position <= 15) return 0.012; // 1.2%
  if (position <= 20) return 0.008; // 0.8%
  return 0.001; // < 0.1% beyond page 2
}

export function calculateEstimatedMonthlyTraffic(
  keywords: { searchVolume: number | null; position: number | null }[],
): { estimatedTraffic: number; rankedKeywordsCount: number } {
  let estimatedTraffic = 0;
  let rankedKeywordsCount = 0;

  for (const k of keywords) {
    if (k.position && k.position > 0 && k.searchVolume && k.searchVolume > 0) {
      rankedKeywordsCount++;
      const ctr = getEstimatedCtr(k.position);
      estimatedTraffic += Math.round(k.searchVolume * ctr);
    }
  }

  return { estimatedTraffic, rankedKeywordsCount };
}
