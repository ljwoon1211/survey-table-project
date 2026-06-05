import { health } from './procedures/health';

export const router = {
  health,
};

export type AppRouter = typeof router;
