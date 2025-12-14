import { createClient } from '@/lib/supabase/server';

/**
 * 인증 필수 - 인증되지 않으면 에러 throw
 * Server Actions에서 사용
 */
export async function requireAuth() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('인증이 필요합니다.');
  }

  return user;
}

/**
 * 현재 사용자 조회 - 인증되지 않으면 null 반환
 * 조건부 인증 체크에 사용
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * 인증 여부만 확인 - boolean 반환
 */
export async function isAuthenticated() {
  const user = await getCurrentUser();
  return !!user;
}
