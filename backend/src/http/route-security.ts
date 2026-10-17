import { readFileSync } from 'node:fs';
import type { RouteConfig } from 'commoneventframework';
import yaml from 'js-yaml';
import { isUserRole, type UserRole } from '../modules/users/domain/user-role';

export interface RoutePolicy {
  /** No authentication required (OpenAPI `security: []`). */
  isPublic: boolean;
  /** Roles allowed to call the route (`x-roles`). */
  roles: readonly UserRole[];
  /** Framework-provided route (/doc, /context…). */
  builtin: boolean;
}

interface OpenApiOperation {
  'x-handler'?: string;
  'x-roles'?: unknown;
  security?: unknown[];
}

interface OpenApiDocument {
  security?: unknown[];
  paths?: Record<string, Record<string, OpenApiOperation>>;
}

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);
const BUILTIN_POLICY: RoutePolicy = { isPublic: true, roles: [], builtin: true };

/**
 * Declarative, contract-first authorization.
 *
 * Route access rules live next to the routes themselves in `root.yaml` — the same OpenAPI
 * document the Common Event Framework uses for routing and API docs:
 *
 *   security: []                    → public route
 *   x-roles: [requester, validator] → authenticated + role-based access control
 *
 * Secure by default: start-up fails if a protected operation forgets to declare its roles.
 */
export class RouteSecurity {
  private constructor(private readonly policies: Map<string, RoutePolicy>) {}

  static fromOpenApiFile(path: string): RouteSecurity {
    return RouteSecurity.fromDocument(yaml.load(readFileSync(path, 'utf8')) as OpenApiDocument);
  }

  static fromDocument(document: OpenApiDocument): RouteSecurity {
    const globallyPublic = !document.security || document.security.length === 0;
    const policies = new Map<string, RoutePolicy>();

    for (const [path, operations] of Object.entries(document.paths ?? {})) {
      for (const [method, operation] of Object.entries(operations)) {
        if (!HTTP_METHODS.has(method) || !operation['x-handler']) continue;
        const key = RouteSecurity.key(method, path);

        const isPublic = Array.isArray(operation.security)
          ? operation.security.length === 0
          : globallyPublic;
        const declaredRoles = operation['x-roles'] ?? [];

        if (!Array.isArray(declaredRoles) || !declaredRoles.every(isUserRole)) {
          throw new Error(`[route-security] ${key}: x-roles must be a list of valid roles`);
        }
        if (!isPublic && declaredRoles.length === 0) {
          throw new Error(`[route-security] ${key} is protected but declares no x-roles`);
        }
        policies.set(key, { isPublic, roles: declaredRoles, builtin: false });
      }
    }
    return new RouteSecurity(policies);
  }

  policyFor(route: RouteConfig): RoutePolicy {
    if (route.handler?.startsWith('__builtin__')) return BUILTIN_POLICY;
    const policy = this.policies.get(RouteSecurity.key(route.method, route.path));
    // Unknown route → deny (fail closed).
    return policy ?? { isPublic: false, roles: [], builtin: false };
  }

  private static key(method: string, path: string): string {
    return `${method.toUpperCase()} ${path}`;
  }
}
