import { Question, TableColumn, TableRow, TableCell, CheckboxOption, RadioOption } from '@/types/survey';

// OTT 서비스 데이터
const ottServices = [
  // 공개 방송통신사업자
  { category: "공개 방송통신사업자", name: "Wave", logoUrl: "https://image.wavve.com/logo/wavve-logo.png" },
  { category: "공개 방송통신사업자", name: "Tving", logoUrl: "https://i.namu.wiki/i/zOKJCJb_1LKmhWw9C-0bsHrOlgtILLdNkRE0z7o2iYg.svg" },
  { category: "공개 방송통신사업자", name: "시즌(Seezn)", logoUrl: "https://seezn.com/web/img/common/logo_seezn.png" },
  { category: "공개 방송통신사업자", name: "U+모바일 TV", logoUrl: "https://www.uplus.co.kr/static/images/common/logo_uplus.png" },
  { category: "공개 방송통신사업자", name: "곰TV", logoUrl: "https://www.gomtv.com/images/common/logo.png" },
  { category: "공개 방송통신사업자", name: "네이버 TV", logoUrl: "https://ssl.pstatic.net/static/nid/login/img/bi_naver.png" },

  // 공개 인터넷서비스사업자
  { category: "공개 인터넷서비스사업자", name: "V live", logoUrl: "https://www.vlive.tv/favicon.ico" },
  { category: "공개 인터넷서비스사업자", name: "아프리카 TV", logoUrl: "https://res.afreecatv.com/images/afmain/img_logo.png" },
  { category: "공개 인터넷서비스사업자", name: "왓챠 플레이", logoUrl: "https://watcha.com/images/watcha_logo.png" },
  { category: "공개 인터넷서비스사업자", name: "카카오 TV", logoUrl: "https://tv.kakao.com/favicon.ico" },
  { category: "공개 인터넷서비스사업자", name: "쿠팡 플레이", logoUrl: "https://m.coupangplay.com/favicon.ico" },
  { category: "공개 인터넷서비스사업자", name: "판도라 TV", logoUrl: "https://www.pandora.tv/favicon.ico" },

  // 해외 인터넷서비스사업자
  { category: "해외 인터넷서비스사업자", name: "넷플릭스", logoUrl: "https://assets.nflxext.com/us/ffe/siteui/common/icons/nficon2016.png" },
  { category: "해외 인터넷서비스사업자", name: "데일리 모션", logoUrl: "https://www.dailymotion.com/favicon.ico" },
  { category: "해외 인터넷서비스사업자", name: "디즈니 플러스", logoUrl: "https://www.disneyplus.com/favicon.ico" },
  { category: "해외 인터넷서비스사업자", name: "아마존 프라임", logoUrl: "https://m.media-amazon.com/images/G/01/digital/video/web/Logo-min.png" },
  { category: "해외 인터넷서비스사업자", name: "유튜브", logoUrl: "https://www.youtube.com/favicon.ico" },
  { category: "해외 인터넷서비스사업자", name: "트위치", logoUrl: "https://www.twitch.tv/favicon.ico" },
  { category: "해외 인터넷서비스사업자", name: "틱톡", logoUrl: "https://www.tiktok.com/favicon.ico" },
  { category: "해외 인터넷서비스사업자", name: "페이스북", logoUrl: "https://www.facebook.com/favicon.ico" }
];

// OTT 설문지 자동 생성 함수
export function generateOTTSurvey(): Question {
  // 테이블 열 생성 (헤더)
  const columns: TableColumn[] = [
    { id: 'category', label: '사업자 유형', width: 150 },
    { id: 'service', label: '온라인 동영상 제공 서비스', width: 200 },
    { id: 'image', label: '이미지', width: 100 },
    { id: 'usage', label: '이용 여부', width: 100 },
    { id: 'payment', label: '월정액 또는 추가요금 여부', width: 180 }
  ];

  // 카테고리별로 그룹화
  const servicesByCategory = ottServices.reduce((acc, service) => {
    if (!acc[service.category]) {
      acc[service.category] = [];
    }
    acc[service.category].push(service);
    return acc;
  }, {} as Record<string, typeof ottServices>);

  // 테이블 행 생성
  const rows: TableRow[] = [];
  let serviceIndex = 1;

  Object.entries(servicesByCategory).forEach(([category, services]) => {
    // 각 서비스 행 추가 (카테고리의 첫 행에만 사업자 유형 셀 표시)
    services.forEach((service, index) => {
      const rowId = `row-${serviceIndex}`;
      const isFirstInCategory = index === 0;

      // 사업자 유형 셀 (첫 행에만 rowspan 적용)
      const categoryCell: TableCell = isFirstInCategory
        ? {
          id: `${rowId}-category`,
          content: category.replace('공개 ', '국내 ').replace('사업자', '\n사업자'),
          type: 'text',
          rowspan: services.length, // 카테고리 내 서비스 수만큼 병합
        }
        : {
          id: `${rowId}-category`,
          content: '',
          type: 'text',
          isHidden: true, // rowspan에 의해 숨겨진 셀
        };

      // 서비스 이름 셀
      const serviceNameCell: TableCell = {
        id: `${rowId}-service`,
        content: `${String.fromCharCode(9312 + serviceIndex - 1)} ${service.name}`,
        type: 'text'
      };

      // 이미지 셀
      const imageCell: TableCell = {
        id: `${rowId}-image`,
        content: service.name,
        type: 'image',
        imageUrl: service.logoUrl
      };

      // 이용 여부 체크박스 셀
      const usageCell: TableCell = {
        id: `${rowId}-usage`,
        content: '',
        type: 'checkbox',
        checkboxOptions: [
          {
            id: `usage-${serviceIndex}`,
            label: '',
            value: service.name,
            checked: false
          }
        ]
      };

      // 결제 방식 라디오 버튼 셀
      const paymentCell: TableCell = {
        id: `${rowId}-payment`,
        content: '',
        type: 'radio',
        radioGroupName: `payment-${serviceIndex}`,
        radioOptions: [
          {
            id: `free-${serviceIndex}`,
            label: '무료',
            value: 'free',
            selected: false
          },
          {
            id: `paid-${serviceIndex}`,
            label: '유료',
            value: 'paid',
            selected: false
          }
        ]
      };

      rows.push({
        id: rowId,
        label: service.name,
        height: 60,
        cells: [categoryCell, serviceNameCell, imageCell, usageCell, paymentCell]
      });

      serviceIndex++;
    });
  });

  // "기타" 행 추가
  const otherRowId = 'row-other';
  const otherRow: TableRow = {
    id: otherRowId,
    label: '기타',
    height: 60,
    cells: [
      {
        id: `${otherRowId}-category`,
        content: '',
        type: 'text'
      },
      {
        id: `${otherRowId}-service`,
        content: `${String.fromCharCode(9312 + serviceIndex - 1)} 기타 (                    )`,
        type: 'text'
      },
      {
        id: `${otherRowId}-image`,
        content: '',
        type: 'text'
      },
      {
        id: `${otherRowId}-usage`,
        content: '',
        type: 'checkbox',
        checkboxOptions: [
          {
            id: `usage-other`,
            label: '',
            value: 'other',
            checked: false
          }
        ]
      },
      {
        id: `${otherRowId}-payment`,
        content: '',
        type: 'radio',
        radioGroupName: 'payment-other',
        radioOptions: [
          {
            id: 'free-other',
            label: '무료',
            value: 'free',
            selected: false
          },
          {
            id: 'paid-other',
            label: '유료',
            value: 'paid',
            selected: false
          }
        ]
      }
    ]
  };

  rows.push(otherRow);

  // 최종 질문 객체 생성
  const ottQuestion: Question = {
    id: `ott-survey-${Date.now()}`,
    type: 'table',
    title: 'OTT 서비스 이용 현황 조사',
    description: '',
    required: false,
    order: 0,
    tableTitle: 'A6-1. 이용하고 계시는 OTT 서비스가 무료인지, 아니면 월 정액제를 이용하거나 추가 요금을 지불하고 이용하고 계신 지 체크해 주세요. (복수응답)',
    tableColumns: columns,
    tableRowsData: rows
  };

  return ottQuestion;
}

// OTT 설문지를 현재 설문에 추가하는 헬퍼 함수
export function addOTTSurveyToBuilder(addPreparedQuestion: (question: Question) => void) {
  const ottQuestion = generateOTTSurvey();
  addPreparedQuestion(ottQuestion);
  return ottQuestion.id;
}

// 설문 응답 데이터 검증 함수
export function validateOTTSurveyResponse(tableRowsData: TableRow[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  let hasAnyUsage = false;

  tableRowsData.forEach((row, index) => {
    const usageCell = row.cells.find(cell => cell.type === 'checkbox');
    const paymentCell = row.cells.find(cell => cell.type === 'radio');

    if (usageCell?.checkboxOptions) {
      const isUsed = usageCell.checkboxOptions.some(option => option.checked);

      if (isUsed) {
        hasAnyUsage = true;

        // 이용한다고 체크한 서비스는 결제 방식도 선택해야 함
        if (paymentCell?.radioOptions) {
          const hasPaymentSelected = paymentCell.radioOptions.some(option => option.selected);
          if (!hasPaymentSelected) {
            errors.push(`${row.label} 서비스의 결제 방식을 선택해주세요.`);
          }
        }
      }
    }
  });

  if (!hasAnyUsage) {
    errors.push('최소 하나의 OTT 서비스를 선택해주세요.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// 응답 데이터 분석 함수
export function analyzeOTTSurveyResponses(responses: TableRow[][]): {
  totalResponses: number;
  serviceUsage: Record<string, { total: number; paid: number; free: number }>;
  categoryUsage: Record<string, number>;
} {
  const analysis = {
    totalResponses: responses.length,
    serviceUsage: {} as Record<string, { total: number; paid: number; free: number }>,
    categoryUsage: {
      '공개 방송통신사업자': 0,
      '공개 인터넷서비스사업자': 0,
      '해외 인터넷서비스사업자': 0
    }
  };

  // 각 서비스별 초기화
  ottServices.forEach(service => {
    analysis.serviceUsage[service.name] = { total: 0, paid: 0, free: 0 };
  });

  // 응답 데이터 분석
  responses.forEach(response => {
    response.forEach(row => {
      const usageCell = row.cells.find(cell => cell.type === 'checkbox');
      const paymentCell = row.cells.find(cell => cell.type === 'radio');

      if (usageCell?.checkboxOptions?.some(option => option.checked)) {
        const serviceName = row.label;
        const service = ottServices.find(s => s.name === serviceName);

        if (service && analysis.serviceUsage[serviceName]) {
          analysis.serviceUsage[serviceName].total++;
          analysis.categoryUsage[service.category]++;

          const selectedPayment = paymentCell?.radioOptions?.find(option => option.selected);
          if (selectedPayment?.value === 'paid') {
            analysis.serviceUsage[serviceName].paid++;
          } else if (selectedPayment?.value === 'free') {
            analysis.serviceUsage[serviceName].free++;
          }
        }
      }
    });
  });

  return analysis;
}