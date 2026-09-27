import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { Observable } from 'rxjs';

/**
 * Validates the file attached by multer BEFORE the request reaches the route
 * handler, so oversized or wrongly-typed uploads fail fast with a clear
 * message instead of surfacing later as a Cloudinary error or a 500.
 *
 * Usage:
 *   @UseInterceptors(FileInterceptor('file'), FileValidationInterceptor)
 *
 * Per-route limits can be customized with the decorator below; defaults are
 * 10MB and images only.
 */
export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const DEFAULT_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

export const FILE_VALIDATION_OPTIONS = 'FILE_VALIDATION_OPTIONS';

export function FileValidationOptions(options?: {
  maxSizeMb?: number;
  allowedMimeTypes?: string[];
}): MethodDecorator {
  return (
    _target: any,
    _key?: any,
    descriptor?: any,
  ) => {
    if (descriptor) {
      Reflect.defineMetadata(
        FILE_VALIDATION_OPTIONS,
        options ?? {},
        descriptor.value,
      );
    }
  };
}

@Injectable()
export class FileValidationInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector = new Reflector()) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();

    const file = (request as any).file as Express.Multer.File | undefined;

    if (file) {
      const handler = context.getHandler();
      const options =
        this.reflector.get(FILE_VALIDATION_OPTIONS, handler) ?? {};

      const maxSizeBytes =
        (options.maxSizeMb ?? MAX_FILE_SIZE_MB) * 1024 * 1024;
      const allowedTypes =
        options.allowedMimeTypes ?? DEFAULT_ALLOWED_MIME_TYPES;

      if (file.size > maxSizeBytes) {
        throw new PayloadTooLargeException(
          `The selected file is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed size is ${options.maxSizeMb ?? MAX_FILE_SIZE_MB}MB.`,
        );
      }

      if (allowedTypes.length > 0 && !allowedTypes.includes(file.mimetype)) {
        throw new UnsupportedMediaTypeException(
          `"${file.originalname}" is not a supported file type. Allowed types: ${allowedTypes
            .map((type) => type.replace('image/', '').toUpperCase())
            .join(', ')}.`,
        );
      }
    }

    return next.handle();
  }
}
