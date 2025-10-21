# Survey Table - Apple 스타일 디자인 시스템

## 🎨 Design Philosophy

Apple의 Human Interface Guidelines를 기반으로 한 미니멀하고 직관적인 디자인 시스템

### Core Principles

- **Clarity**: 기능보다 사용성 우선
- **Deference**: 콘텐츠가 UI를 지배
- **Depth**: 계층과 활력을 통한 이해도 증진

---

## 🎯 Color Palette

### Primary Colors

```css
/* Blue - Primary Actions */
--blue-50: #F0F9FF
--blue-100: #E0F2FE
--blue-500: #007AFF  /* Primary */
--blue-600: #0056CC
--blue-900: #0C4A6E

/* Gray - Neutral */
--gray-50: #F9FAFB
--gray-100: #F2F2F7   /* Background */
--gray-200: #E5E5EA   /* Border */
--gray-500: #8E8E93   /* Secondary Text */
--gray-900: #1C1C1E   /* Primary Text */
```

### Semantic Colors

```css
/* Success */
--green-500: #34C759

/* Warning */
--orange-500: #FF9500

/* Error */
--red-500: #FF3B30
```

---

## 📝 Typography

### Font Stack

```css
font-family: "Pretendard", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
```

### Scale

```css
/* Headlines */
.text-display: 28px/34px, font-weight: 700
.text-headline: 24px/30px, font-weight: 600
.text-title: 20px/26px, font-weight: 600

/* Body */
.text-body: 16px/24px, font-weight: 400
.text-body-medium: 16px/24px, font-weight: 500
.text-small: 14px/20px, font-weight: 400

/* Caption */
.text-caption: 12px/16px, font-weight: 400
```

---

## 📐 Spacing & Layout

### Grid System

```css
/* 8px 기반 */
--spacing-1: 8px
--spacing-2: 16px
--spacing-3: 24px
--spacing-4: 32px
--spacing-6: 48px
--spacing-8: 64px
--spacing-12: 96px
```

### Container Sizes

```css
--container-sm: 640px
--container-md: 768px
--container-lg: 1024px
--container-xl: 1280px
--container-2xl: 1536px
```

---

## 🔲 Component Specifications

### Buttons

#### Primary Button

```tsx
<Button
  className="
  bg-blue-500 hover:bg-blue-600
  text-white font-medium
  px-6 py-3 rounded-lg
  transition-colors duration-200
  shadow-sm hover:shadow-md
"
>
  Create Survey
</Button>
```

#### Secondary Button

```tsx
<Button
  variant="outline"
  className="
  border-gray-200 hover:border-gray-300
  text-gray-900 font-medium
  px-6 py-3 rounded-lg
  transition-all duration-200
"
>
  Cancel
</Button>
```

### Cards

```tsx
<Card
  className="
  border-gray-200 rounded-xl
  shadow-sm hover:shadow-md
  transition-shadow duration-200
  bg-white
"
>
  <CardContent className="p-6">{/* Content */}</CardContent>
</Card>
```

### Form Controls

#### Input Field

```tsx
<Input
  className="
  border-gray-200 rounded-lg
  px-4 py-3 text-base
  focus:border-blue-500 focus:ring-1 focus:ring-blue-500
  transition-colors duration-200
  placeholder:text-gray-500
"
/>
```

#### Select Dropdown

```tsx
<Select>
  <SelectTrigger
    className="
    border-gray-200 rounded-lg
    px-4 py-3 text-base
    focus:border-blue-500 focus:ring-1 focus:ring-blue-500
  "
  >
    <SelectValue placeholder="Choose option..." />
  </SelectTrigger>
</Select>
```

---

## 📱 Page Layouts

### Homepage Hero Section

```tsx
<section
  className="
  min-h-screen flex items-center justify-center
  bg-gradient-to-b from-gray-50 to-white
  px-4 py-12
"
>
  <div className="max-w-4xl mx-auto text-center">
    <h1 className="text-display text-gray-900 mb-6">
      설문조사를 <span className="text-blue-500">쉽고 빠르게</span>
    </h1>
    <p className="text-body text-gray-500 mb-8 max-w-2xl mx-auto">
      복잡한 기능은 숨기고 필요한 것만. Apple처럼 간단하고 직관적인 설문 도구
    </p>
    <Button size="lg" className="px-8 py-4">
      무료로 시작하기
    </Button>
  </div>
</section>
```

### Survey Builder Layout

```tsx
<div className="h-screen flex bg-gray-50">
  {/* Left Sidebar - Question Types */}
  <aside className="w-80 bg-white border-r border-gray-200 p-6">
    <h2 className="text-title mb-6">질문 유형</h2>
    {/* Question type buttons */}
  </aside>

  {/* Main Content - Survey Preview */}
  <main className="flex-1 p-8 overflow-auto">
    <div className="max-w-3xl mx-auto">{/* Survey content */}</div>
  </main>

  {/* Right Sidebar - Settings */}
  <aside className="w-80 bg-white border-l border-gray-200 p-6">
    <h2 className="text-title mb-6">설정</h2>
    {/* Settings panel */}
  </aside>
</div>
```

---

## 🎭 Animation & Interactions

### Micro Interactions

```css
/* Hover states */
.hover-lift {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.hover-lift:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

/* Focus states */
.focus-ring {
  transition: box-shadow 0.2s ease;
}
.focus-ring:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.3);
}

/* Loading states */
.loading-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
```

### Page Transitions

```tsx
// Framer Motion variants
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -20 },
};

const pageTransition = {
  type: "tween",
  ease: "anticipate",
  duration: 0.4,
};
```

---

## 🧩 Question Type Components

### Text Input Question

```tsx
<Card className="border-gray-200 rounded-xl p-6">
  <div className="mb-4">
    <Label className="text-body font-medium text-gray-900 mb-2 block">질문 제목 *</Label>
    <Input placeholder="답변을 입력하세요..." className="w-full" />
  </div>
</Card>
```

### Multiple Choice Question

```tsx
<Card className="border-gray-200 rounded-xl p-6">
  <Label className="text-body font-medium text-gray-900 mb-4 block">선택형 질문</Label>
  <RadioGroup className="space-y-3">
    <div className="flex items-center space-x-3">
      <RadioGroupItem value="option1" />
      <label>옵션 1</label>
    </div>
    <div className="flex items-center space-x-3">
      <RadioGroupItem value="option2" />
      <label>옵션 2</label>
    </div>
  </RadioGroup>
</Card>
```

### Table Question Component

```tsx
<Card className="border-gray-200 rounded-xl p-6">
  <Label className="text-body font-medium text-gray-900 mb-4 block">테이블 질문</Label>
  <div className="overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>항목</TableHead>
          <TableHead>매우 좋음</TableHead>
          <TableHead>좋음</TableHead>
          <TableHead>보통</TableHead>
          <TableHead>나쁨</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>서비스 품질</TableCell>
          <TableCell>
            <RadioGroupItem value="5" />
          </TableCell>
          <TableCell>
            <RadioGroupItem value="4" />
          </TableCell>
          <TableCell>
            <RadioGroupItem value="3" />
          </TableCell>
          <TableCell>
            <RadioGroupItem value="2" />
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</Card>
```

---

## 📊 Dashboard Components

### Stats Card

```tsx
<Card className="border-gray-200 rounded-xl p-6">
  <div className="flex items-center justify-between mb-2">
    <h3 className="text-small font-medium text-gray-500 uppercase tracking-wide">총 응답 수</h3>
    <TrendingUpIcon className="w-4 h-4 text-green-500" />
  </div>
  <p className="text-display font-semibold text-gray-900">1,247</p>
  <p className="text-caption text-green-600 mt-1">+12% from last week</p>
</Card>
```

### Survey List Item

```tsx
<Card className="border-gray-200 rounded-xl p-6 hover-lift cursor-pointer">
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-body font-medium text-gray-900">고객 만족도 조사</h3>
    <Badge variant="secondary" className="bg-green-100 text-green-800">
      활성
    </Badge>
  </div>
  <p className="text-small text-gray-500 mb-4">123명 응답 • 2일 전 생성</p>
  <div className="flex items-center space-x-2">
    <Button size="sm" variant="outline">
      분석보기
    </Button>
    <Button size="sm">공유하기</Button>
  </div>
</Card>
```

---

## 🎪 Responsive Design

### Breakpoints

```css
/* Mobile First */
.container {
  padding: 1rem;
}

@media (min-width: 640px) {
  .container {
    padding: 1.5rem;
  }
}

@media (min-width: 768px) {
  .container {
    padding: 2rem;
  }
}

@media (min-width: 1024px) {
  .container {
    padding: 2.5rem;
  }
}
```

### Mobile Adaptations

- 사이드바를 하단 시트로 변경
- 테이블을 카드 형태로 재구성
- 터치 친화적 버튼 크기 (최소 44px)
- 스와이프 제스처 지원

---

## ♿ Accessibility

### Focus Management

```tsx
// 키보드 네비게이션
<Button
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      handleClick();
    }
  }}
  aria-label="새 설문 만들기"
>
  Create Survey
</Button>
```

### Screen Reader Support

```tsx
<div role="region" aria-labelledby="survey-stats">
  <h2 id="survey-stats">설문 통계</h2>
  <div aria-live="polite">{responseCount}개의 응답이 수집되었습니다</div>
</div>
```

### Color Contrast

- WCAG AA 준수 (4.5:1 이상)
- 색상에만 의존하지 않는 정보 전달
- 다크모드 지원 준비

---

_이 디자인 시스템은 Survey Table의 일관된 사용자 경험을 위한 기준점입니다. Apple의 디자인 철학을 바탕으로 한국 사용자에게 최적화된 인터페이스를 제공합니다._
