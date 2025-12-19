# Modules Folder

This folder serves as the primary location for feature modules within the application

## Guidelines

- **Feature Modules**: Each subfolder should represent a feature module of the application.
- **Command**: Use the Nest CLI to generate modules and resources within this folder:

```bash
  nest g resource modules/<module-name>
```

OR

```bash
  nest g resource modules/<module-name> --no-spec
```

- **Structure**: Each module folder contains its own files and subdirectories:
  -`{module-name}.module.ts` - Defines the module.
  -`{module-name}.controller.ts` - Handles HTTP requests.
  -`{module-name}.service.ts` - Contains business logic.
  -Additional files like DTOs.

## Example Structure

```bash
  modules/
  ├── auth/
  │   ├── auth.module.ts
  │   ├── auth.controller.ts
  │   ├── auth.service.ts
  ├── users/
  │   ├── dto/
  │   │   ├── create-user.dto.ts
  │   ├── users.module.ts
  │   ├── users.controller.ts
  │   ├── users.service.ts
```
