import z from "zod";
import { BaseEventSchema } from "./index.schema";

export const pinSetupSchema = BaseEventSchema.extend({
  eventType: z.literal("PIN_SETUP"),
  version: z.literal(1),
  aggregateType: z.literal("PIN_SETUP"),
  aggregateId: z.string(),
  eventId: z.string(),
  payload: z.object({
    userId: z.string(),
    email: z.string().email(),
    name: z.string(),
  }),
});

export const pinChangeSchema = BaseEventSchema.extend({
  eventType: z.literal("PIN_CHANGE"),
  version: z.literal(1),
  aggregateType: z.literal("PIN_CHANGE"),
  aggregateId: z.string(),
  eventId: z.string(),
  payload: z.object({
    userId: z.string(),
    email: z.string().email(),
    name: z.string(),
  }),
});

export const pinLockedSchema = BaseEventSchema.extend({
  eventType: z.literal("PIN_LOCKED"),
  version: z.literal(1),
  aggregateType: z.literal("PIN_LOCKED"),
  aggregateId: z.string(),
  eventId: z.string(),
  payload: z.object({
    userId: z.string(),
    email: z.string().email(),
    name: z.string(),
    reason: z.string(),
  }),
});

export const pinResetRequestedSchema = BaseEventSchema.extend({
  eventType: z.literal("PIN_RESET_REQUESTED"),
  version: z.literal(1),
  aggregateType: z.literal("PIN_RESET_REQUESTED"),
  aggregateId: z.string(),
  eventId: z.string(),
  payload: z.object({
    userId: z.string(),
    email: z.string().email(),
    name: z.string(),
  }),
});

export const pinResetSuccessSchema = BaseEventSchema.extend({
  eventType: z.literal("PIN_RESET_SUCCESS"),
  version: z.literal(1),
  aggregateType: z.literal("PIN_RESET_SUCCESS"),
  aggregateId: z.string(),
  eventId: z.string(),
  payload: z.object({
    userId: z.string(),
    email: z.string().email(),
    name: z.string(),
  }),
});

export const PinEventSchema = z.discriminatedUnion("eventType", [
  pinSetupSchema,
  pinChangeSchema,
  pinLockedSchema,
  pinResetRequestedSchema,
  pinResetSuccessSchema,
]);

export type PinEvent = z.infer<typeof PinEventSchema>;
