import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, CheckCircle, FileText, BarChart3, Share2, Zap } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Navigation */}
      <nav className="backdrop-blur-apple border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-semibold text-gray-900">Survey Table</span>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm">
                로그인
              </Button>
              <Button size="sm" asChild>
                <Link href="/create">
                  시작하기
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative px-4 py-24 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-8 inline-flex items-center px-4 py-2 rounded-full bg-blue-50 text-blue-700 text-sm font-medium">
            <Zap className="w-4 h-4 mr-2" />
            Apple처럼 간단한 설문 도구
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            설문조사를{" "}
            <span className="gradient-text">쉽고 빠르게</span>
          </h1>

          <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
            복잡한 기능은 숨기고 필요한 것만. 구글 폼보다 직관적이고,
            Apple처럼 아름다운 설문조사 플랫폼입니다.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4 mb-12">
            <Button size="lg" className="px-8 py-4 text-lg hover-lift" asChild>
              <Link href="/create">
                무료로 시작하기
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="px-8 py-4 text-lg">
              데모 보기
            </Button>
          </div>

          {/* Feature Preview */}
          <div className="relative mx-auto max-w-5xl">
            <div className="rounded-2xl bg-white shadow-2xl border border-gray-200 p-8 hover-lift">
              <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center">
                <div className="text-center">
                  <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">설문 생성 인터페이스 미리보기</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 py-24 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              모든 것이 <span className="gradient-text">간단합니다</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              복잡한 설정 없이 바로 시작하세요. 필요한 모든 기능이 직관적으로 배치되어 있습니다.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <Card className="hover-lift border-0 shadow-lg">
              <CardHeader className="pb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <CardTitle className="text-xl">직관적인 설문 생성</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base text-gray-600 leading-relaxed">
                  드래그 앤 드롭으로 질문을 추가하고 순서를 변경하세요.
                  실시간 미리보기로 결과를 바로 확인할 수 있습니다.
                </CardDescription>
              </CardContent>
            </Card>

            {/* Feature 2 */}
            <Card className="hover-lift border-0 shadow-lg">
              <CardHeader className="pb-4">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                  <Share2 className="w-6 h-6 text-green-600" />
                </div>
                <CardTitle className="text-xl">간편한 공유</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base text-gray-600 leading-relaxed">
                  공개 링크나 비공개 링크를 선택하여 설문을 공유하세요.
                  QR 코드도 자동으로 생성됩니다.
                </CardDescription>
              </CardContent>
            </Card>

            {/* Feature 3 */}
            <Card className="hover-lift border-0 shadow-lg">
              <CardHeader className="pb-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                  <BarChart3 className="w-6 h-6 text-purple-600" />
                </div>
                <CardTitle className="text-xl">실시간 분석</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base text-gray-600 leading-relaxed">
                  응답이 들어오는 즉시 대시보드에서 확인하세요.
                  CSV, Excel로 데이터를 내보낼 수 있습니다.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Advanced Features */}
      <section className="px-4 py-24 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              강력한 고급 기능
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              단순함 뒤에 숨겨진 강력한 기능들을 만나보세요.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                다양한 질문 유형 지원
              </h3>
              <ul className="space-y-4">
                {[
                  "텍스트 입력 (단답형/장문형)",
                  "선택형 질문 (라디오/체크박스)",
                  "다단계 Select (시/도/구 확장)",
                  "테이블 형식 질문",
                  "이미지/동영상 삽입 가능"
                ].map((feature, index) => (
                  <li key={index} className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-8 hover-lift">
              <div className="aspect-square bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-gray-600">질문 유형 미리보기</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-4 py-24 sm:px-6 lg:px-8 bg-blue-500">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            지금 바로 시작해보세요
          </h2>
          <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
            복잡한 설정 없이 3분 만에 첫 번째 설문조사를 만들어보세요.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
            <Button
              size="lg"
              variant="secondary"
              className="px-8 py-4 text-lg bg-white text-blue-500 hover:bg-gray-100"
              asChild
            >
              <Link href="/create">
                무료로 시작하기
                <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="px-8 py-4 text-lg border-white text-white hover:bg-white hover:text-blue-500"
            >
              예시 설문 보기
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-4 py-12 sm:px-6 lg:px-8 bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-semibold text-white">Survey Table</span>
            </div>
            <p className="text-gray-400 text-sm">
              © 2025 Survey Table. Made with ❤️ in Korea.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
