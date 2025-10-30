import { Request } from 'express';

// Definisikan payload user yang akan kita tambahkan ke request
interface UserPayload {
  id: string;
  email: string;
  username: string;
}

declare global {
  namespace Express {
    // Tambahkan properti 'user' ke interface Request dari Express
    export interface Request {
      user?: UserPayload;
    }
  }
}
