# Decorators Folder

This folder contains custom decorators for use throughout the application. Decorators provide a declarative way to add metadata or functionality to classes, methods, properties, or parameters.

## Purpose

- **Reusability**: Encapsulate commonly used logic into reusable decorators.
- **Abstraction**: Simplify code by reducing boilerplate in controllers, services, and other components.
- **Enhancements**: Extend the functionality of built-in decorators or create entirely new ones.

## Typical Contents

- `<decorator-name>.decorator.ts`: Custom decorators created for specific use cases.
  - Example: `@AuthUser` to fetch the currently authenticated user.
- Decorators are typically used for:
  - Authorization or role checking.
  - Request metadata extraction (e.g., headers, body, or query params).
  - Custom validation logic.

## Example: Custom Decorator

Below is an example of a `@AuthUser` decorator to extract the authenticated user from the request:

```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const AuthUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```
