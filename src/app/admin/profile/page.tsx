"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updatePassword, logout } from "@/actions/auth-actions";
import { ArrowLeft, Lock, CheckCircle, AlertCircle, LogOut, User } from "lucide-react";

export default function AdminProfilePage() {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    const result = await updatePassword(formData);

    if (result?.error) {
      setError(result.error);
    } else if (result?.success) {
      setSuccess(true);
      // 폼 초기화
      const form = document.getElementById("password-form") as HTMLFormElement;
      form?.reset();
    }

    setIsLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <Link
            href="/admin/surveys"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>설문 관리로 돌아가기</span>
          </Link>
          <form action={logout}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4 mr-2" />
              로그아웃
            </Button>
          </form>
        </div>

        {/* 프로필 카드 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <CardTitle>관리자 프로필</CardTitle>
                <CardDescription>계정 정보를 관리합니다</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* 비밀번호 변경 카드 */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <Lock className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <CardTitle className="text-lg">비밀번호 변경</CardTitle>
                <CardDescription>보안을 위해 정기적으로 비밀번호를 변경하세요</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form id="password-form" action={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span>비밀번호가 성공적으로 변경되었습니다.</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="currentPassword" className="text-sm font-medium">
                  현재 비밀번호
                </Label>
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  placeholder="현재 비밀번호를 입력하세요"
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-sm font-medium">
                  새 비밀번호
                </Label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  placeholder="새 비밀번호를 입력하세요 (최소 6자)"
                  required
                  minLength={6}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium">
                  새 비밀번호 확인
                </Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="새 비밀번호를 다시 입력하세요"
                  required
                  minLength={6}
                  disabled={isLoading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    변경 중...
                  </span>
                ) : (
                  "비밀번호 변경"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


