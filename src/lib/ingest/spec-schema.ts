import { z } from 'zod'

export const RiskSettingsSchema = z.object({
  maxRiskPct: z.number().positive().max(100).optional(),
  maxTradesPerDay: z.number().int().positive().optional(),
  minRR: z.number().positive().optional(),
  pauseAfterConsecLosses: z.number().int().positive().optional(),
}).strict()

export const IndicatorRefSchema = z.object({
  name: z.string().min(1),
  params: z.record(z.string(), z.number()).optional(),
}).strict()

export const StrategySpecSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  timeframes: z.array(z.string().regex(/^[0-9]+[mhdw]$/i)).optional(),
  indicators: z.array(IndicatorRefSchema).optional(),
  rules: z.array(z.string().min(1)).optional(),
  risk: RiskSettingsSchema.optional(),
  patterns: z.array(z.string().min(1)).optional(),
}).strict()

export type StrategySpecValidated = z.infer<typeof StrategySpecSchema>
