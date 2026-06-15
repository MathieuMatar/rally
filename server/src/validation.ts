import { z } from 'zod';

export const authTeamSchema = z.object({
  code: z.string().min(1),
});

export const authOrganizerSchema = z.object({
  code: z.string().min(1),
});

export const syncEventSchema = z.object({
  uuid: z.string().min(1),
  type: z.enum(['scan_start', 'scan_end', 'station_result', 'exit', 'help_request', 'sos', 'location']),
  stationId: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
  clientTs: z.number(),
});

export const syncRequestSchema = z.object({
  events: z.array(syncEventSchema),
});

export const adminHintSchema = z.object({
  teamId: z.string().min(1),
  delta: z.number().int(),
});
