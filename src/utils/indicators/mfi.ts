/**
 * Money Flow Index (MFI) Indicator
 * Volume-weighted RSI that measures buying and selling pressure
 */

import { OHLCData, TimeValuePoint } from './types';

/**
 * Calculate Money Flow Index
 * @param data - Array of OHLC data points (volume required)
 * @param period - Number of periods (default: 14)
 * @returns Array of {time, value} objects where value is 0-100
 */
export const calculateMFI = (data: OHLCData[], period: number = 14): TimeValuePoint[] => {
  if (!Array.isArray(data) || data.length < period + 1 || period <= 0) {
    return [];
  }

  const mfiData: TimeValuePoint[] = [];

  // Calculate typical prices and raw money flows
  const typicalPrices = data.map(d => (d.high + d.low + d.close) / 3);
  const rawMoneyFlows = data.map((d, i) => typicalPrices[i] * (d.volume ?? 0));

  for (let i = period; i < data.length; i++) {
    let positveMF = 0;
    let negativeMF = 0;

    for (let j = i - period + 1; j <= i; j++) {
      if (typicalPrices[j] > typicalPrices[j - 1]) {
        positveMF += rawMoneyFlows[j];
      } else if (typicalPrices[j] < typicalPrices[j - 1]) {
        negativeMF += rawMoneyFlows[j];
      }
    }

    if (negativeMF === 0) {
      mfiData.push({ time: data[i].time, value: 100 });
    } else {
      const mfRatio = positveMF / negativeMF;
      const mfi = 100 - 100 / (1 + mfRatio);
      mfiData.push({ time: data[i].time, value: mfi });
    }
  }

  return mfiData;
};
