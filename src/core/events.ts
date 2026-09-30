// Typed in-process event bus (SPEC §4.11). Modules register handlers so they never call each other.
import type { Completion, Instant, LocalDate } from './types';
import type { WeekResult } from './weekly';

export interface EventMap {
  'quest.completed': { userId: string; gameId: string; completion: Completion };
  'day.closed': { userId: string; localDate: LocalDate };
  'week.closed': { userId: string; gameId: string; weekStart: LocalDate; result: WeekResult };
  'achievement.unlocked': { userId: string; achievementId: string; decoration?: string; at: Instant };
  'sculpture.chiseled': { userId: string; sculptureId: string; weekStart: LocalDate; pieces: number; piecesRevealed: number };
  'book.finished': { userId: string; bookId: string; at: Instant };
  'share.created': { userId: string; shareId: string; scope: string; localDate: LocalDate };
}

export type EventName = keyof EventMap;

/** Every event carries a stable id so handlers (and the bus) can dedupe redeliveries. */
export type EventEnvelope<K extends EventName> = { id: string; name: K; payload: EventMap[K] };

export type Handler<K extends EventName> = (event: EventEnvelope<K>) => void | Promise<void>;

export interface EmitReport {
  handled: string[];
  skipped: string[];
  errors: Array<{ handler: string; error: unknown }>;
}

export interface EventBus {
  /** Registers a named handler. Names must be unique per event. Returns an unsubscribe function. */
  on<K extends EventName>(name: K, handlerName: string, handler: Handler<K>): () => void;
  /**
   * Delivers to every handler in registration order. A handler that already processed this event
   * id is skipped (at-most-once per handler per event within this bus); a failing handler does not
   * stop the others and may be retried by emitting the same event again.
   */
  emit<K extends EventName>(name: K, id: string, payload: EventMap[K]): Promise<EmitReport>;
}

export function createEventBus(): EventBus {
  const handlers = new Map<EventName, Map<string, Handler<EventName>>>();
  const processed = new Set<string>();

  return {
    on(name, handlerName, handler) {
      let forEvent = handlers.get(name);
      if (!forEvent) { forEvent = new Map(); handlers.set(name, forEvent); }
      if (forEvent.has(handlerName)) throw new Error(`Handler "${handlerName}" already registered for ${name}`);
      forEvent.set(handlerName, handler as unknown as Handler<EventName>);
      return () => { forEvent.delete(handlerName); };
    },
    async emit(name, id, payload) {
      const report: EmitReport = { handled: [], skipped: [], errors: [] };
      const envelope = { id, name, payload } as EventEnvelope<EventName>;
      for (const [handlerName, handler] of [...(handlers.get(name) ?? [])]) {
        const key = `${name}\u0000${handlerName}\u0000${id}`;
        if (processed.has(key)) { report.skipped.push(handlerName); continue; }
        try {
          await handler(envelope);
          processed.add(key);
          report.handled.push(handlerName);
        } catch (error) {
          report.errors.push({ handler: handlerName, error });
        }
      }
      return report;
    },
  };
}
