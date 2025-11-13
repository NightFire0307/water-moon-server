import { Request, Response, type NextFunction } from 'express'
import { v4 as uuidV4 } from 'uuid';

// 复用客户端传入的 X-Request-Id，若无则生成一个新的 UUID 作为请求 ID
export function RequestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId = req.headers['x-request-id'] || uuidV4();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-Id', requestId);
  next()
}