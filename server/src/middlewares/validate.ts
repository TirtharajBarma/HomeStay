import type { Request, Response, NextFunction } from "express";
import { ZodError, type ZodSchema } from "zod";

export function validate(schema: ZodSchema, source: "body" | "query" | "params" = "body") {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req[source]);
      req[source] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = (err as any).issues?.reduce((acc: any, issue: any) => {
          acc[issue.path.join(".")] = issue.message;
          return acc;
        }, {}) || { error: (err as any).message };

        return res.status(400).json({
          success: false,
          error: "Validation failed",
          errors,
        });
      }
      next(err);
    }
  };
}
