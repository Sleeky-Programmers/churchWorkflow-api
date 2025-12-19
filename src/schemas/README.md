# Schemas Folder

This folder contains schema definitions for the application's data models. Schemas define the structure for the data stored in the database.

## Purpose

- **Define Data Models**: Schemas outline the structure of the data objects used throughout the application.
- **Validation**: Enforce data integrity through built-in validation rules.
- **Integration**: Used with database ORMs like Mongoose for MongoDB.

## Typical Content

- `{schema-name}.schema.ts`: Defines the schema for a specific collection.

## Example Schema Structure

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class Example extends Document {
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;
}

export const ExampleSchema = SchemaFactory.createForClass(Example);
```
