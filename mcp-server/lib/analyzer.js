/**
 * 로컬 5축 프롬프트 분석 엔진 (규칙 기반).
 * API 키 없이 즉시 실행 가능하다.
 *
 * 5축: clarity, completeness, specificity, context, output_format
 * 각 축은 0~100점. 종합 점수는 가중 평균.
 * 등급: A(80~100), B(60~79), C(40~59), D(0~39)
 */

// 모호한 표현 패턴 — clarity 감점 요소
const VAGUE_PATTERNS = [
  /\b(something|anything|whatever|somehow|etc|etc\.|some kind of)\b/i,
  /\b(좀|그냥|아무거나|뭔가|어떻게든|기타|뭐든)\b/,
  /\.{3,}/,         // 말줄임표 과다 사용
];

// 역할/페르소나 패턴 — completeness
const ROLE_PATTERNS = [
  /\b(you are|act as|role of|as a|as an)\b/i,
  /\b(당신은|너는|전문가로서|역할을|~로서|~로 행동)\b/,
];

// 출력 형식 지정 패턴 — output_format
const FORMAT_PATTERNS = [
  /\b(in (json|yaml|xml|csv|markdown|table|list|bullet|numbered|html))\b/i,
  /\b(format|formatted|output|return|respond with|provide)\b/i,
  /\b(json|yaml|xml|csv|markdown|표|목록|리스트|번호|형식|포맷|반환|출력)\b/i,
];

// 예시 제공 패턴 — specificity
const EXAMPLE_PATTERNS = [
  /\b(for example|e\.g\.|such as|like|sample|example)\b/i,
  /\b(예를 들어|예시|예:|가령|처럼|같은)\b/,
  /```[\s\S]*?```/,  // 코드 블록
];

// 컨텍스트/배경 패턴 — context
const CONTEXT_PATTERNS = [
  /\b(context|background|because|since|given that|assuming|scenario)\b/i,
  /\b(상황|배경|맥락|왜냐하면|이유는|전제|가정하면|시나리오)\b/,
];

// 구체적 지시 패턴 — specificity
const SPECIFIC_PATTERNS = [
  /\b(specifically|exactly|precisely|must|should|need to|step by step)\b/i,
  /\b(구체적으로|정확히|반드시|꼭|단계별로|상세히)\b/,
  /\b(\d+\s*(steps?|단계|개|가지|항목))\b/i,
];

// 자동 태그 규칙 (로컬 모드)
const TAG_RULES = [
  { keywords: [/번역|translate/i], tag: '#translate' },
  { keywords: [/요약|summarize|summary/i], tag: '#summarize' },
  { keywords: [/코드|code|function|함수|프로그램|program/i], tag: '#coding' },
  { keywords: [/json|yaml|xml|csv/i], tag: '#structured' },
  { keywords: [/분석|analyze|analysis/i], tag: '#analysis' },
  { keywords: [/작성|쓰|write|writing|글|essay|article/i], tag: '#writing' },
  { keywords: [/데이터|data|dataset/i], tag: '#data' },
  { keywords: [/창작|창의|creative|story|소설|fiction/i], tag: '#creative' },
  { keywords: [/설명|explain|explanation/i], tag: '#explain' },
  { keywords: [/리뷰|review|검토|평가/i], tag: '#review' },
  { keywords: [/생성|generate|만들어/i], tag: '#generate' },
  { keywords: [/list|목록|bullet|표|table/i], tag: '#list' },
];

function countMatches(text, patterns) {
  return patterns.reduce((n, p) => n + (p.test(text) ? 1 : 0), 0);
}

/**
 * 프롬프트 텍스트를 로컬 규칙으로 5축 분석한다.
 * @param {string} prompt
 * @returns {{ scores, grade, totalScore, missingElements, suggestedTags }}
 */
export function analyzeLocal(prompt) {
  const len = prompt.length;
  const wordCount = prompt.trim().split(/\s+/).length;

  // ── clarity (명확성) ──────────────────────────────────────
  // 모호한 표현이 적고, 문장이 잘 구성되어 있을수록 높다.
  const vagueCount = countMatches(prompt, VAGUE_PATTERNS);
  const clarityBase = Math.min(100, 50 + (wordCount >= 10 ? 20 : 0) + (wordCount >= 30 ? 10 : 0));
  const clarity = Math.max(0, clarityBase - vagueCount * 15);

  // ── completeness (완전성) ─────────────────────────────────
  // 역할, 태스크, 컨텍스트, 출력 형식이 있을수록 높다.
  let completenessScore = 20; // 기본 — 최소한 프롬프트 텍스트가 있음
  if (countMatches(prompt, ROLE_PATTERNS) > 0)    completenessScore += 25;
  if (len > 50)                                    completenessScore += 15;
  if (countMatches(prompt, CONTEXT_PATTERNS) > 0)  completenessScore += 20;
  if (countMatches(prompt, FORMAT_PATTERNS) > 0)   completenessScore += 20;
  const completeness = Math.min(100, completenessScore);

  // ── specificity (구체성) ──────────────────────────────────
  // 구체적 지시어, 예시, 수치가 있을수록 높다.
  let specificityScore = 20;
  specificityScore += Math.min(40, countMatches(prompt, SPECIFIC_PATTERNS) * 15);
  specificityScore += Math.min(30, countMatches(prompt, EXAMPLE_PATTERNS) * 15);
  specificityScore += wordCount >= 50 ? 10 : 0;
  const specificity = Math.min(100, specificityScore);

  // ── context (컨텍스트) ────────────────────────────────────
  let contextScore = 20;
  contextScore += Math.min(50, countMatches(prompt, CONTEXT_PATTERNS) * 20);
  contextScore += len > 100 ? 20 : 0;
  contextScore += len > 300 ? 10 : 0;
  const context = Math.min(100, contextScore);

  // ── output_format (출력 형식) ─────────────────────────────
  let formatScore = 20;
  formatScore += Math.min(80, countMatches(prompt, FORMAT_PATTERNS) * 25);
  const output_format = Math.min(100, formatScore);

  // ── 종합 점수 (가중 평균) ─────────────────────────────────
  const weights = { clarity: 0.25, completeness: 0.25, specificity: 0.20, context: 0.15, output_format: 0.15 };
  const totalScore = Math.round(
    clarity * weights.clarity +
    completeness * weights.completeness +
    specificity * weights.specificity +
    context * weights.context +
    output_format * weights.output_format
  );

  // ── 등급 ────────────────────────────────────────────────
  const grade = totalScore >= 80 ? 'A' : totalScore >= 60 ? 'B' : totalScore >= 40 ? 'C' : 'D';

  // ── 누락 요소 식별 ─────────────────────────────────────
  const missingElements = [];
  if (clarity < 60)       missingElements.push('명확한 언어 사용 (모호한 표현 제거)');
  if (completeness < 60)  missingElements.push('역할/페르소나 정의');
  if (context < 60)       missingElements.push('배경 및 컨텍스트 정보');
  if (output_format < 60) missingElements.push('출력 형식 명시');
  if (specificity < 60)   missingElements.push('구체적 지시사항 또는 예시');

  // ── 자동 태그 추천 ─────────────────────────────────────
  const suggestedTags = TAG_RULES
    .filter(rule => rule.keywords.some(k => k.test(prompt)))
    .map(rule => rule.tag);

  // missingElements 기반 품질 힌트 태그
  if (missingElements.length === 0) suggestedTags.push('#well-defined');
  else if (missingElements.length >= 3) suggestedTags.push('#needs-context');
  if (vagueCount > 0) suggestedTags.push('#ambiguous');

  return {
    scores: {
      clarity: Math.round(clarity),
      completeness: Math.round(completeness),
      specificity: Math.round(specificity),
      context: Math.round(context),
      output_format: Math.round(output_format),
    },
    totalScore,
    grade,
    missingElements,
    suggestedTags: [...new Set(suggestedTags)],
  };
}

/**
 * 누락 요소를 기반으로 개선된 프롬프트를 규칙 기반으로 생성한다.
 * 점수가 80 이상이면 null 반환 (이미 충분히 좋음).
 *
 * @param {string} prompt 원본 프롬프트
 * @param {string[]} missingElements analyzeLocal의 missingElements
 * @param {number} totalScore 종합 점수
 * @returns {string|null}
 */
export function buildEnhancedPrompt(prompt, missingElements, totalScore) {
  if (totalScore >= 80) return null;

  const parts = [];

  // 역할/페르소나가 누락된 경우 — 내용 기반으로 역할 추론
  if (missingElements.some(m => m.includes('역할'))) {
    let role = '전문가';
    if (/코드|code|함수|function|프로그램|program|개발|develop/i.test(prompt)) role = '소프트웨어 개발자';
    else if (/번역|translate/i.test(prompt)) role = '전문 번역가';
    else if (/요약|summarize|summary/i.test(prompt)) role = '전문 편집자';
    else if (/설계|design|아키텍처|architecture/i.test(prompt)) role = '시스템 아키텍트';
    else if (/분석|analyze|analysis|데이터|data/i.test(prompt)) role = '데이터 분석가';
    else if (/글|write|writing|작성|essay|article/i.test(prompt)) role = '전문 작가';
    parts.push(`당신은 ${role}입니다.`);
  }

  // 원본 프롬프트 본문
  parts.push(prompt.trim());

  // 출력 형식이 누락된 경우 — 내용 기반으로 형식 제안
  if (missingElements.some(m => m.includes('출력 형식'))) {
    let format = '명확하고 구조화된 형식';
    if (/코드|code|함수|function|구현|implement/i.test(prompt)) format = '코드 블록(```언어명```)과 함께 사용 예시 포함';
    else if (/단계|step|순서|procedure/i.test(prompt)) format = '번호 목록(1. 2. 3.) 형식';
    else if (/비교|compare|차이|versus|vs/i.test(prompt)) format = '표(table) 형식으로 항목별 비교';
    else if (/목록|list|나열|enumerate/i.test(prompt)) format = '글머리 기호(•) 목록 형식';
    parts.push(`\n출력 형식: ${format}으로 응답해 주세요.`);
  }

  // 배경 컨텍스트가 누락된 경우 — 플레이스홀더 제안
  if (missingElements.some(m => m.includes('배경'))) {
    parts.push(`\n참고 배경: [관련 배경 정보 또는 제약사항을 여기에 추가하세요]`);
  }

  return parts.join('\n\n');
}

/**
 * 개선된 프롬프트를 사용자가 바로 복사할 수 있는 독립 블록으로 포맷한다.
 *
 * @param {string|null} enhancedPrompt buildEnhancedPrompt 반환값
 * @param {string} entryId 저장된 엔트리 ID
 * @returns {string|null}
 */
export function buildEnhancedPromptBlock(enhancedPrompt, entryId) {
  if (!enhancedPrompt) return null;
  const divider = '─'.repeat(48);
  return [
    '✨ 개선된 프롬프트 (복사해서 바로 사용하세요):',
    divider,
    enhancedPrompt,
    divider,
    entryId ? `entryId: \`${entryId}\`` : '',
  ].filter(Boolean).join('\n');
}

/**
 * 점수 변화 요약 문자열 반환.
 */
export function formatScoreDelta(before, after) {
  const delta = after - before;
  const sign = delta > 0 ? '+' : '';
  return `${before} → ${after} (${sign}${delta})`;
}
