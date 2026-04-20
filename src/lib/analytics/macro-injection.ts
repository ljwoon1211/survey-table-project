/**
 * Macro Injection — xlsx 버퍼에 템플릿의 VBA 프로젝트를 주입하여 .xlsm으로 만든다.
 *
 * ExcelJS의 xlsm 지원이 불완전하여 (load → save 사이에 vbaProject.bin이 손상되거나 소실)
 * zip 레벨에서 직접 주입하는 방식을 쓴다. 이 모듈은 zip 바이너리 조작을 담당하며
 * spreadsheet export 오케스트레이션과 독립적이다.
 */
import JSZip from 'jszip';

/** 매크로 템플릿 public 경로 — 브라우저 fetch 대상 */
export const MACRO_TEMPLATE_PATH = '/assets/cleaning-export-template.xlsm';

/**
 * 브라우저에서 매크로 템플릿(`.xlsm`)을 가져온다.
 * - 시트 간 필터 연동을 활성화한 경우에만 호출한다 (VBA가 시트 간 동기화 담당).
 * - 실패 시 undefined 반환 → caller는 매크로 없는 xlsx로 폴백.
 */
export async function fetchMacroTemplate(): Promise<ArrayBuffer | undefined> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return undefined;
  try {
    const res = await fetch(MACRO_TEMPLATE_PATH);
    if (!res.ok) return undefined;
    return await res.arrayBuffer();
  } catch {
    return undefined;
  }
}

/**
 * 순수 xlsx 버퍼에 템플릿의 vbaProject.bin을 주입하여 .xlsm으로 변환한다.
 *
 * 주입 단계:
 *   1) `xl/vbaProject.bin` 엔트리 추가
 *   2) `[Content_Types].xml` — workbook part의 ContentType을 xlsm용으로 변경 +
 *      vbaProject Override 추가
 *   3) `xl/_rels/workbook.xml.rels` — vbaProject relationship 추가
 *   4) `xl/workbook.xml` — workbookPr.codeName을 템플릿 값과 일치시킴
 *      (VBA ThisWorkbook 모듈 바인딩 + 이벤트 발화 필수 조건)
 */
export async function injectVbaProject(
  xlsxBuffer: ArrayBuffer,
  templateBuffer: ArrayBuffer,
): Promise<ArrayBuffer> {
  const templateZip = await JSZip.loadAsync(templateBuffer);
  const vbaFile = templateZip.file('xl/vbaProject.bin');
  if (!vbaFile) throw new Error('템플릿에 xl/vbaProject.bin이 없습니다');
  const vbaBin = await vbaFile.async('uint8array');

  // 템플릿 workbookPr의 codeName만 정확히 추출 (sheet codeName과 헷갈리지 않도록)
  const tplWbXml = await templateZip.file('xl/workbook.xml')?.async('text');
  const codeNameMatch = tplWbXml?.match(/<workbookPr\b[^>]*\bcodeName="([^"]+)"/);
  const codeName = codeNameMatch?.[1] ?? 'ThisWorkbook';

  const zip = await JSZip.loadAsync(xlsxBuffer);

  // 1) vbaProject.bin
  zip.file('xl/vbaProject.bin', vbaBin);

  // 2) [Content_Types].xml
  const ctFile = zip.file('[Content_Types].xml');
  if (!ctFile) throw new Error('생성된 xlsx에 [Content_Types].xml이 없습니다');
  let ctXml = await ctFile.async('text');
  ctXml = ctXml.replace(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml',
    'application/vnd.ms-excel.sheet.macroEnabled.main+xml',
  );
  if (!ctXml.includes('vbaProject')) {
    ctXml = ctXml.replace(
      '</Types>',
      '<Override PartName="/xl/vbaProject.bin" ContentType="application/vnd.ms-office.vbaProject"/></Types>',
    );
  }
  zip.file('[Content_Types].xml', ctXml);

  // 3) xl/_rels/workbook.xml.rels
  const relsFile = zip.file('xl/_rels/workbook.xml.rels');
  if (!relsFile) throw new Error('xl/_rels/workbook.xml.rels 없음');
  let relsXml = await relsFile.async('text');
  if (!relsXml.includes('vbaProject')) {
    const existingIds = [...relsXml.matchAll(/Id="(rId\d+)"/g)].map((m) => m[1]);
    let n = 1;
    while (existingIds.includes(`rId${n}`)) n++;
    relsXml = relsXml.replace(
      '</Relationships>',
      `<Relationship Id="rId${n}" Type="http://schemas.microsoft.com/office/2006/relationships/vbaProject" Target="vbaProject.bin"/></Relationships>`,
    );
  }
  zip.file('xl/_rels/workbook.xml.rels', relsXml);

  // 4) xl/workbook.xml — workbookPr.codeName을 반드시 템플릿 값과 일치시켜야
  //    VBA의 ThisWorkbook 모듈이 바인딩되고 Workbook_SheetCalculate 등 이벤트가 발화한다.
  const wbFile = zip.file('xl/workbook.xml');
  if (wbFile) {
    let wbXml = await wbFile.async('text');
    const wbprCodeName = /<workbookPr\b[^>]*\bcodeName="([^"]+)"/.exec(wbXml);
    if (wbprCodeName) {
      if (wbprCodeName[1] !== codeName) {
        wbXml = wbXml.replace(
          /(<workbookPr\b[^>]*\bcodeName=")[^"]+(")/,
          `$1${codeName}$2`,
        );
      }
    } else if (/<workbookPr\b/.test(wbXml)) {
      wbXml = wbXml.replace(/<workbookPr\b/, `<workbookPr codeName="${codeName}"`);
    } else {
      wbXml = wbXml.replace(/<workbook([^>]*)>/, `<workbook$1><workbookPr codeName="${codeName}"/>`);
    }
    zip.file('xl/workbook.xml', wbXml);
  }

  // 압축 레벨을 명시하지 않으면 JSZip이 STORE(무압축)로 재저장해 파일이 수십 배 커지고
  // Excel이 "내용 문제" 경고를 띄운다. xlsx 표준에 맞춰 DEFLATE 압축으로 고정.
  return zip.generateAsync({
    type: 'arraybuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}
