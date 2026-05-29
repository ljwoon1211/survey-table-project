import { LoginForm } from './login-form';

interface PageProps {
  searchParams: Promise<{ redirect?: string }>;
}

export default async function AdminLoginPage({ searchParams }: PageProps) {
  const { redirect } = await searchParams;
  return <LoginForm redirectTo={redirect ?? ''} />;
}
