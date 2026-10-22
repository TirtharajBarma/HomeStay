import type { Request, Response, NextFunction } from "express";

/**
 * Recursively strips keys starting with '$' or containing '.' from objects.
 * Defends against NoSQL operator injection (e.g. { "$gt": "" }, { "$ne": null })
 * across req.body, req.params, and req.query.
 */
function sanitizeObject(target: any): any {
  if (!target || typeof target !== "object") return target;
  if (Array.isArray(target)) {
    for (let i = 0; i < target.length; i++) {
      sanitizeObject(target[i]);
    }
    return target;
  }
  for (const key of Object.keys(target)) {
    if (key.startsWith("$") || key.includes(".")) {
      delete target[key];
    } else {
      sanitizeObject(target[key]);
    }
  }
  return target;
}

export function mongoSanitize(req: Request, _res: Response, next: NextFunction) {
  if (req.body) sanitizeObject(req.body);
  if (req.params) sanitizeObject(req.params);
  if (req.query) sanitizeObject(req.query);
  next();
}
