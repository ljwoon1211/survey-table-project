import { createContext } from '@/server/context';
import { rpcHandler } from '@/server/handler';

async function handle(request: Request) {
  const { response } = await rpcHandler.handle(request, {
    prefix: '/api/rpc',
    context: await createContext(),
  });
  return response ?? new Response('Not found', { status: 404 });
}

export const GET = handle;
export const POST = handle;
