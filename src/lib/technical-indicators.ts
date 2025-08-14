import { logger } from '@/lib/logger';

export interface IndicatorResult {
  atr?: number;
  cci?: number;
  rsi?: number;
  macd?: number;
  macdSignal?: number;
  macdHistogram?: number;
  bbUpper?: number;
  bbMiddle?: number;
  bbLower?: number;
  swingHigh?: number;
  swingLow?: number;
  bullishEngulfing?: boolean;
  bearishEngulfing?: boolean;
  doji?: boolean;
  sma20?: number;
  sma50?: number;
}

export interface MarketDataPoint {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class TechnicalIndicators {
  // Simple Moving Average
  sma(data: number[], period: number): number[] {
    const result: number[] = [];
    
    for (let i = period - 1; i < data.length; i++) {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
    
    return result;
  }

  // Exponential Moving Average
  ema(data: number[], period: number): number[] {
    const result: number[] = [];
    const multiplier = 2 / (period + 1);
    
    // Start with SMA for first value
    const firstSma = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
    result.push(firstSma);
    
    for (let i = period; i < data.length; i++) {
      const ema = (data[i] - result[result.length - 1]) * multiplier + result[result.length - 1];
      result.push(ema);
    }
    
    return result;
  }

  // Relative Strength Index
  rsi(data: number[], period: number = 14): number[] {
    const result: number[] = [];
    const changes: number[] = [];
    
    for (let i = 1; i < data.length; i++) {
      changes.push(data[i] - data[i - 1]);
    }
    
    for (let i = period - 1; i < changes.length; i++) {
      const gains = changes.slice(i - period + 1, i + 1).filter(c => c > 0);
      const losses = changes.slice(i - period + 1, i + 1).filter(c => c < 0).map(l => Math.abs(l));
      
      const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
      const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0;
      
      if (avgLoss === 0) {
        result.push(100);
      } else {
        const rs = avgGain / avgLoss;
        const rsiValue = 100 - (100 / (1 + rs));
        result.push(rsiValue);
      }
    }
    
    return result;
  }

  // Average True Range
  atr(highs: number[], lows: number[], closes: number[], period: number = 14): number[] {
    const result: number[] = [];
    const trueRanges: number[] = [];
    
    for (let i = 1; i < highs.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trueRanges.push(tr);
    }
    
    for (let i = period - 1; i < trueRanges.length; i++) {
      const atr = trueRanges.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
      result.push(atr);
    }
    
    return result;
  }

  // Commodity Channel Index
  cci(highs: number[], lows: number[], closes: number[], period: number = 14): number[] {
    const result: number[] = [];
    
    for (let i = period - 1; i < highs.length; i++) {
      const sliceHighs = highs.slice(i - period + 1, i + 1);
      const sliceLows = lows.slice(i - period + 1, i + 1);
      const sliceCloses = closes.slice(i - period + 1, i + 1);
      
      const typicalPrice = sliceHighs.map((h, idx) => (h + sliceLows[idx] + sliceCloses[idx]) / 3);
      const smaTP = typicalPrice.reduce((a, b) => a + b, 0) / period;
      
      const meanDeviation = typicalPrice.reduce((sum, tp) => sum + Math.abs(tp - smaTP), 0) / period;
      
      const cci = (typicalPrice[typicalPrice.length - 1] - smaTP) / (0.015 * meanDeviation);
      result.push(cci);
    }
    
    return result;
  }

  // MACD
  macd(data: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9): {
    macd: number[];
    macdSignal: number[];
    macdHistogram: number[];
  } {
    const fastEma = this.ema(data, fastPeriod);
    const slowEma = this.ema(data, slowPeriod);
    
    const macdLine = fastEma.map((fast, idx) => fast - slowEma[idx + (slowPeriod - fastPeriod)]);
    const macdSignal = this.ema(macdLine, signalPeriod);
    const macdHistogram = macdLine.map((macd, idx) => macd - (macdSignal[idx - (signalPeriod - 1)] || 0));
    
    return {
      macd: macdLine,
      macdSignal: macdSignal,
      macdHistogram: macdHistogram,
    };
  }

  // Bollinger Bands
  bollingerBands(data: number[], period: number = 20, stdDev: number = 2): {
    upper: number[];
    middle: number[];
    lower: number[];
  } {
    const middle = this.sma(data, period);
    const upper: number[] = [];
    const lower: number[] = [];
    
    for (let i = period - 1; i < data.length; i++) {
      const slice = data.slice(i - period + 1, i + 1);
      const mean = middle[i - (period - 1)];
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
      const standardDeviation = Math.sqrt(variance);
      
      upper.push(mean + (standardDeviation * stdDev));
      lower.push(mean - (standardDeviation * stdDev));
    }
    
    return {
      upper,
      middle,
      lower,
    };
  }

  // Swing Highs and Lows
  swingHighs(highs: number[], period: number = 5): number[] {
    const result: number[] = [];
    
    for (let i = period; i < highs.length - period; i++) {
      const slice = highs.slice(i - period, i + period + 1);
      const current = highs[i];
      
      if (current === Math.max(...slice)) {
        result.push(current);
      } else {
        result.push(null);
      }
    }
    
    return result;
  }

  swingLows(lows: number[], period: number = 5): number[] {
    const result: number[] = [];
    
    for (let i = period; i < lows.length - period; i++) {
      const slice = lows.slice(i - period, i + period + 1);
      const current = lows[i];
      
      if (current === Math.min(...slice)) {
        result.push(current);
      } else {
        result.push(null);
      }
    }
    
    return result;
  }

  // Candlestick Patterns
  detectBullishEngulfing(data: MarketDataPoint[]): boolean[] {
    const result: boolean[] = [];
    
    for (let i = 1; i < data.length; i++) {
      const current = data[i];
      const previous = data[i - 1];
      
      const isBullishEngulfing = 
        current.close > current.open && // Current candle is bullish
        previous.open > previous.close && // Previous candle is bearish
        current.open < previous.close && // Current open < previous close
        current.close > previous.open;   // Current close > previous open
      
      result.push(isBullishEngulfing);
    }
    
    return result;
  }

  detectBearishEngulfing(data: MarketDataPoint[]): boolean[] {
    const result: boolean[] = [];
    
    for (let i = 1; i < data.length; i++) {
      const current = data[i];
      const previous = data[i - 1];
      
      const isBearishEngulfing = 
        current.close < current.open && // Current candle is bearish
        previous.open < previous.close && // Previous candle is bullish
        current.open > previous.close && // Current open > previous close
        current.close < previous.open;   // Current close < previous open
      
      result.push(isBearishEngulfing);
    }
    
    return result;
  }

  detectDoji(data: MarketDataPoint[]): boolean[] {
    const result: boolean[] = [];
    
    for (let i = 0; i < data.length; i++) {
      const candle = data[i];
      const bodySize = Math.abs(candle.close - candle.open);
      const totalRange = candle.high - candle.low;
      
      // Doji if body is <= 10% of total range
      const isDoji = bodySize <= (totalRange * 0.1);
      result.push(isDoji);
    }
    
    return result;
  }

  // Calculate all indicators for market data
  async calculateAllIndicators(marketData: MarketDataPoint[]): Promise<IndicatorResult[]> {
    try {
      if (marketData.length < 50) {
        logger.warn('Insufficient data for indicator calculation');
        return [];
      }

      const closes = marketData.map(d => d.close);
      const highs = marketData.map(d => d.high);
      const lows = marketData.map(d => d.low);

      // Calculate all indicators
      const atrValues = this.atr(highs, lows, closes);
      const cciValues = this.cci(highs, lows, closes);
      const rsiValues = this.rsi(closes);
      const macdValues = this.macd(closes);
      const bbValues = this.bollingerBands(closes);
      const swingHighValues = this.swingHighs(highs);
      const swingLowValues = this.swingLows(lows);
      const bullishEngulfingValues = this.detectBullishEngulfing(marketData);
      const bearishEngulfingValues = this.detectBearishEngulfing(marketData);
      const dojiValues = this.detectDoji(marketData);
      const sma20Values = this.sma(closes, 20);
      const sma50Values = this.sma(closes, 50);

      // Align all indicators and create result array
      const result: IndicatorResult[] = [];
      const minLength = Math.min(
        atrValues.length,
        cciValues.length,
        rsiValues.length,
        macdValues.macd.length,
        bbValues.upper.length,
        swingHighValues.length,
        swingLowValues.length,
        bullishEngulfingValues.length,
        bearishEngulfingValues.length,
        dojiValues.length,
        sma20Values.length,
        sma50Values.length
      );

      const startIndex = marketData.length - minLength;

      for (let i = 0; i < minLength; i++) {
        result.push({
          atr: atrValues[i],
          cci: cciValues[i],
          rsi: rsiValues[i],
          macd: macdValues.macd[i],
          macdSignal: macdValues.macdSignal[i + 9 - 12], // Adjust for different periods
          macdHistogram: macdValues.macdHistogram[i + 9 - 12],
          bbUpper: bbValues.upper[i],
          bbMiddle: bbValues.middle[i],
          bbLower: bbValues.lower[i],
          swingHigh: swingHighValues[i],
          swingLow: swingLowValues[i],
          bullishEngulfing: bullishEngulfingValues[i + 1], // Offset by 1 for pattern detection
          bearishEngulfing: bearishEngulfingValues[i + 1],
          doji: dojiValues[i],
          sma20: sma20Values[i + 19], // Offset for SMA period
          sma50: sma50Values[i + 49], // Offset for SMA period
        });
      }

      return result;
    } catch (error) {
      logger.error('Error calculating indicators:', error);
      return [];
    }
  }
}