/**
 * Runs a unit of work atomically. `TScope` exposes the repositories bound to the
 * underlying transaction, so handlers never deal with transaction plumbing directly.
 */
export interface UnitOfWork<TScope> {
  run<T>(work: (scope: TScope) => Promise<T>): Promise<T>;
}
