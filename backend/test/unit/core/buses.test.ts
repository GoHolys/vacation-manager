import pino from 'pino';
import { describe, expect, it, vi } from 'vitest';
import { Command, CommandBus } from '../../../src/core/cqrs/command-bus';
import { DomainEvent, InProcessEventBus } from '../../../src/core/cqrs/event-bus';
import { Query, QueryBus } from '../../../src/core/cqrs/query-bus';

class Ping extends Command<string> {
  constructor(readonly value: string) {
    super();
  }
}
class Unregistered extends Command<void> {}
class GetAnswer extends Query<number> {}
class SomethingHappened extends DomainEvent<{ n: number }> {
  readonly eventName = 'something.happened';
}

const silentLogger = pino({ level: 'silent' });

describe('CommandBus', () => {
  it('dispatches a command to its handler and returns the typed result', async () => {
    const bus = new CommandBus().register(Ping, { execute: async (cmd) => `pong:${cmd.value}` });
    const result: string = await bus.execute(new Ping('x'));
    expect(result).toBe('pong:x');
  });

  it('runs middlewares in registration order around the handler', async () => {
    const calls: string[] = [];
    const bus = new CommandBus()
      .use(async (_cmd, next) => {
        calls.push('outer:before');
        const result = await next();
        calls.push('outer:after');
        return result;
      })
      .use(async (_cmd, next) => {
        calls.push('inner');
        return next();
      })
      .register(Ping, {
        execute: async () => {
          calls.push('handler');
          return 'ok';
        },
      });

    await bus.execute(new Ping('x'));
    expect(calls).toEqual(['outer:before', 'inner', 'handler', 'outer:after']);
  });

  it('rejects unknown commands and duplicate registrations', async () => {
    const bus = new CommandBus().register(Ping, { execute: async () => 'ok' });
    await expect(bus.execute(new Unregistered())).rejects.toThrow(/No handler registered/);
    expect(() => bus.register(Ping, { execute: async () => 'again' })).toThrow(
      /already registered/,
    );
  });
});

describe('QueryBus', () => {
  it('dispatches a query to its handler', async () => {
    const bus = new QueryBus().register(GetAnswer, { execute: async () => 42 });
    await expect(bus.execute(new GetAnswer())).resolves.toBe(42);
  });
});

describe('InProcessEventBus', () => {
  it('delivers events to typed and wildcard subscribers', async () => {
    const typed = vi.fn(async () => undefined);
    const wildcard = vi.fn(async () => undefined);
    const bus = new InProcessEventBus(silentLogger)
      .subscribe(SomethingHappened, { name: 'typed', handle: typed })
      .subscribeAll({ name: 'wildcard', handle: wildcard });

    const event = new SomethingHappened('agg-1', { n: 1 });
    await bus.publish(event);

    expect(typed).toHaveBeenCalledWith(event);
    expect(wildcard).toHaveBeenCalledWith(event);
    expect(event.eventId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('isolates failing subscribers from the others and from the publisher', async () => {
    const healthy = vi.fn(async () => undefined);
    const bus = new InProcessEventBus(silentLogger)
      .subscribe(SomethingHappened, {
        name: 'broken',
        handle: async () => {
          throw new Error('boom');
        },
      })
      .subscribe(SomethingHappened, { name: 'healthy', handle: healthy });

    await expect(bus.publish(new SomethingHappened('agg-1', { n: 1 }))).resolves.toBeUndefined();
    expect(healthy).toHaveBeenCalledOnce();
  });
});
