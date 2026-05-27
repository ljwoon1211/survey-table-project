import sanitizeHtml from 'sanitize-html';

// jsdom 의존을 끌어오는 isomorphic-dompurify 대신 sanitize-html 사용.
// 서버(Lambda) 런타임에서 ESM 모듈 require 충돌이 발생하던 문제 회피.
// 허용 정책은 기존 DOMPurify 설정과 1:1 매핑 — 보안 수준 동일.
const RICH_CONFIG: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'span', 'div',
    'strong', 'em', 'u', 's', 'mark',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li',
    'blockquote', 'code', 'pre',
    'a', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  allowedAttributes: {
    '*': ['class', 'style'],
    a: [
      'href', 'target', 'rel', 'download',
      // notice 파일 첨부 노드 marker (a[data-file-attachment])
      'data-file-attachment', 'data-key', 'data-filename', 'data-size', 'data-mime',
    ],
    img: ['src', 'alt', 'width', 'height'],
    td: ['colspan', 'rowspan', 'colwidth'],
    th: ['colspan', 'rowspan', 'colwidth'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  // TipTap inline style (text-align, image wrapperStyle 의 width/height/float 등) 을 raw 보존.
  // DOMPurify 기본 동작과 동등 — style 값을 파싱·필터링하지 않고 그대로 통과.
  // expression() 같은 legacy IE vector 는 modern 브라우저·메일 클라이언트에서 무력화됨.
  parseStyleAttributes: false,
};

// TipTap 이 Enter 로 만든 빈 paragraph 는 `<p></p>` 로 직렬화되는데, inline content 가
// 없어 브라우저·메일 클라이언트 모두 height 0 으로 collapse 한다. 시각 줄간격을 보존하려고
// &nbsp; 한 글자를 채워 한 줄 높이를 강제. <br> 보다 Outlook/Gmail 호환이 안정적.
const EMPTY_P_RE = /<p([^>]*)>(\s*)<\/p>/g;

function fillEmptyParagraphs(html: string): string {
  return html.replace(EMPTY_P_RE, '<p$1>&nbsp;</p>');
}

export function sanitizeRichHtml(input: string | null | undefined): string {
  if (input == null) return '';
  return fillEmptyParagraphs(sanitizeHtml(input, RICH_CONFIG));
}
