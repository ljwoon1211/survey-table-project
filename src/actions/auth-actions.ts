'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

const DEFAULT_REDIRECT = '/admin/surveys';

/**
 * 로그인 후 이동할 경로를 안전하게 결정.
 * open redirect 방지를 위해 같은 출처의 내부 절대경로만 허용하고,
 * 루트("/")·로그인 페이지는 기본 경로로 대체한다.
 */
function resolveRedirect(raw: FormDataEntryValue | null): string {
  if (typeof raw !== 'string' || raw.length === 0) return DEFAULT_REDIRECT;
  // 내부 절대경로만 허용 ('//' 와 '/\' 는 protocol-relative 외부 URL 우회 차단)
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) {
    return DEFAULT_REDIRECT;
  }
  const path = raw.split(/[?#]/)[0];
  if (path === '/' || path === '/admin/login') return DEFAULT_REDIRECT;
  return raw;
}

export async function login(formData: FormData) {
  const supabase = await createClient();

  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  };

  const { error } = await supabase.auth.signInWithPassword(data);

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  redirect(resolveRedirect(formData.get('redirect')));
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/admin/login');
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient();

  const currentPassword = formData.get('currentPassword') as string;
  const newPassword = formData.get('newPassword') as string;
  const confirmPassword = formData.get('confirmPassword') as string;

  // 새 비밀번호 확인
  if (newPassword !== confirmPassword) {
    return { error: '새 비밀번호가 일치하지 않습니다.' };
  }

  // 비밀번호 최소 요구사항 검증
  if (newPassword.length < 6) {
    return { error: '비밀번호는 최소 6자 이상이어야 합니다.' };
  }

  // 현재 비밀번호 확인을 위해 재로그인 시도
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { error: '로그인이 필요합니다.' };
  }

  // 현재 비밀번호로 재인증
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (signInError) {
    return { error: '현재 비밀번호가 올바르지 않습니다.' };
  }

  // 비밀번호 업데이트
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    return { error: updateError.message };
  }

  return { success: true };
}

export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
