// PromptCraft Prototype — Backend API (Express + Mock Claude Analysis)
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// ============================================================
// Mock Claude API Analysis
// 실제 구현에서는 Claude API를 호출하지만, 프로토타입에서는
// 규칙 기반으로 분석 결과를 생성합니다.
// ============================================================

const KNOWN_TERMS = {
  // 프로그래밍 언어 & 프레임워크
  'react': { category: 'framework', explanation: 'JavaScript UI 라이브러리로 해석' },
  'vue': { category: 'framework', explanation: 'JavaScript 프론트엔드 프레임워크로 해석' },
  'angular': { category: 'framework', explanation: 'Google의 TypeScript 프론트엔드 프레임워크로 해석' },
  'node.js': { category: 'runtime', explanation: 'JavaScript 서버사이드 런타임으로 해석' },
  'nodejs': { category: 'runtime', explanation: 'JavaScript 서버사이드 런타임으로 해석' },
  'typescript': { category: 'language', explanation: '정적 타입의 JavaScript 슈퍼셋으로 해석' },
  'python': { category: 'language', explanation: '범용 프로그래밍 언어로 해석' },
  'java': { category: 'language', explanation: '정적 타입 OOP 언어로 해석' },
  'go': { category: 'language', explanation: 'Google의 시스템 프로그래밍 언어로 해석' },
  'rust': { category: 'language', explanation: '메모리 안전 시스템 프로그래밍 언어로 해석' },
  'c#': { category: 'language', explanation: 'Microsoft .NET 생태계 언어로 해석' },

  // 웹 기술
  'html': { category: 'web', explanation: '웹 마크업 언어로 해석' },
  'css': { category: 'web', explanation: '웹 스타일링 언어로 해석' },
  'tailwind': { category: 'styling', explanation: '유틸리티 기반 CSS 프레임워크로 해석' },
  'api': { category: 'architecture', explanation: '애플리케이션 프로그래밍 인터페이스로 해석' },
  'rest': { category: 'architecture', explanation: 'RESTful API 설계 패턴으로 해석' },
  'graphql': { category: 'architecture', explanation: 'Facebook의 쿼리 언어로 해석' },

  // DB
  'postgresql': { category: 'database', explanation: '관계형 데이터베이스로 해석' },
  'mysql': { category: 'database', explanation: '관계형 데이터베이스로 해석' },
  'mongodb': { category: 'database', explanation: 'NoSQL 문서 데이터베이스로 해석' },
  'redis': { category: 'database', explanation: '인메모리 캐시/데이터 저장소로 해석' },

  // 일반 개발 용어
  '로그인': { category: 'feature', explanation: '사용자 인증 기능으로 해석' },
  '로그인 폼': { category: 'ui', explanation: '사용자 인증 입력 UI로 해석' },
  '회원가입': { category: 'feature', explanation: '사용자 등록 기능으로 해석' },
  '대시보드': { category: 'ui', explanation: '데이터 시각화 관리 화면으로 해석' },
  '게시판': { category: 'feature', explanation: 'CRUD 기반 게시물 관리 기능으로 해석' },
  '채팅': { category: 'feature', explanation: '실시간 메시징 기능으로 해석' },
  '결제': { category: 'feature', explanation: '온라인 결제/트랜잭션 기능으로 해석' },
  '검색': { category: 'feature', explanation: '콘텐츠 검색/필터링 기능으로 해석' },
  '알림': { category: 'feature', explanation: '푸시/인앱 알림 기능으로 해석' },
  '업로드': { category: 'feature', explanation: '파일 업로드 기능으로 해석' },
  '테이블': { category: 'ui', explanation: '데이터 테이블 UI 컴포넌트로 해석' },
  '폼': { category: 'ui', explanation: '입력 폼 UI 컴포넌트로 해석' },
  '버튼': { category: 'ui', explanation: 'UI 인터랙션 요소로 해석' },
  '모달': { category: 'ui', explanation: '오버레이 팝업 UI 컴포넌트로 해석' },
};

const INFERENCE_RULES = [
  { keywords: ['react', 'vue', 'angular', 'html', 'css'], infer: { term: '웹 애플리케이션', explanation: '프론트엔드 기술 언급으로 웹 환경 추론', confidence: 'high' }},
  { keywords: ['react'], infer: { term: '함수형 컴포넌트', explanation: '최신 React 관행으로 함수형 컴포넌트 사용 추론', confidence: 'medium' }},
  { keywords: ['react'], infer: { term: 'JSX 문법', explanation: 'React의 기본 문법으로 JSX 사용 추론', confidence: 'high' }},
  { keywords: ['node.js', 'nodejs', 'express'], infer: { term: '서버사이드 렌더링 가능', explanation: 'Node.js 환경에서 SSR 가능성 추론', confidence: 'low' }},
  { keywords: ['api', 'rest'], infer: { term: 'JSON 응답 형식', explanation: 'REST API의 표준 응답 형식 추론', confidence: 'high' }},
  { keywords: ['로그인', '회원가입'], infer: { term: '비밀번호 암호화 필요', explanation: '인증 기능에 보안 요구사항 추론', confidence: 'high' }},
  { keywords: ['로그인'], infer: { term: '세션/토큰 관리', explanation: '로그인 후 인증 상태 유지 방식 추론', confidence: 'medium' }},
  { keywords: ['대시보드'], infer: { term: '차트/그래프 라이브러리', explanation: '대시보드에 데이터 시각화 필요 추론', confidence: 'medium' }},
  { keywords: ['게시판'], infer: { term: 'CRUD 패턴', explanation: '게시판의 기본 동작 패턴 추론', confidence: 'high' }},
  { keywords: ['채팅'], infer: { term: 'WebSocket 통신', explanation: '실시간 메시징에 WebSocket 필요 추론', confidence: 'high' }},
  { keywords: ['결제'], infer: { term: 'PG사 연동', explanation: '온라인 결제 시 결제 대행사 연동 추론', confidence: 'high' }},
  { keywords: ['typescript'], infer: { term: '인터페이스/타입 정의', explanation: 'TypeScript 사용 시 타입 시스템 활용 추론', confidence: 'high' }},
];

const MISSING_INFO_RULES = [
  { keywords: ['로그인', '회원가입', '인증'], missing: [
    { field: '인증 방식', suggestion: '이메일/비밀번호? OAuth(Google/GitHub)? SSO?' },
    { field: '비밀번호 정책', suggestion: '최소 길이, 특수문자 필수 여부 등' },
  ]},
  { keywords: ['react', 'vue', 'angular'], missing: [
    { field: '스타일링 방식', suggestion: 'CSS Modules? Tailwind? styled-components? SCSS?' },
    { field: '상태 관리', suggestion: 'useState? Redux? Zustand? Recoil?' },
    { field: '라우팅', suggestion: 'React Router? Next.js? 싱글 페이지?' },
  ]},
  { keywords: ['api', 'rest', '백엔드', '서버'], missing: [
    { field: 'API 인증', suggestion: 'JWT? API Key? OAuth 2.0?' },
    { field: '에러 핸들링', suggestion: 'HTTP 상태 코드 규칙, 에러 응답 형식' },
    { field: '데이터베이스', suggestion: 'PostgreSQL? MySQL? MongoDB?' },
  ]},
  { keywords: ['대시보드'], missing: [
    { field: '데이터 소스', suggestion: '어떤 데이터를 시각화할 것인지' },
    { field: '갱신 주기', suggestion: '실시간? 주기적 폴링? 수동 새로고침?' },
  ]},
  { keywords: ['게시판'], missing: [
    { field: '권한 체계', suggestion: '작성자만 수정/삭제? 관리자 권한?' },
    { field: '첨부파일', suggestion: '이미지만? 문서? 최대 용량?' },
  ]},
  { keywords: ['채팅'], missing: [
    { field: '참여자 수', suggestion: '1:1? 그룹 채팅? 최대 인원?' },
    { field: '메시지 저장', suggestion: '영구 저장? 일정 기간 후 삭제?' },
  ]},
  { keywords: ['결제'], missing: [
    { field: '결제 수단', suggestion: '카드? 계좌이체? 간편결제(카카오페이, 네이버페이)?' },
    { field: '정기/일회성', suggestion: '구독 결제? 일회성 결제? 둘 다?' },
  ]},
  // 일반적으로 항상 부족한 정보
  { keywords: [], missing: [
    { field: '대상 사용자', suggestion: '개발자? 일반 사용자? B2B? B2C?' },
    { field: '배포 환경', suggestion: 'AWS? Vercel? 온프레미스?' },
    { field: '브라우저 호환', suggestion: 'Chrome만? 크로스 브라우저? 모바일 대응?' },
  ]},
];

function analyzePrompt(prompt, context) {
  const lowerPrompt = prompt.toLowerCase();

  // 1. Referenced — 프롬프트에서 명확히 식별된 용어
  const referenced = [];
  for (const [term, info] of Object.entries(KNOWN_TERMS)) {
    if (lowerPrompt.includes(term.toLowerCase())) {
      referenced.push({ term, explanation: info.explanation });
    }
  }

  // 2. Inferred — 추론된 맥락
  const inferred = [];
  const inferredTerms = new Set();
  for (const rule of INFERENCE_RULES) {
    if (rule.keywords.some(k => lowerPrompt.includes(k))) {
      if (!inferredTerms.has(rule.infer.term)) {
        inferredTerms.add(rule.infer.term);
        inferred.push({ ...rule.infer });
      }
    }
  }

  // 3. Missing — 부재 정보
  const missing = [];
  const missingFields = new Set();
  for (const rule of MISSING_INFO_RULES) {
    const matches = rule.keywords.length === 0 || rule.keywords.some(k => lowerPrompt.includes(k));
    if (matches) {
      for (const m of rule.missing) {
        if (!missingFields.has(m.field)) {
          missingFields.add(m.field);
          // 프로필 맥락에서 자동 보충 가능한지 확인
          const autoFill = checkAutoFillable(m.field, context);
          missing.push({
            ...m,
            autoFillable: autoFill.fillable,
            profileValue: autoFill.value || null,
          });
        }
      }
    }
  }

  // 4. Enhanced Prompt 생성
  const enhancedPrompt = buildEnhancedPrompt(prompt, context, missing);

  return { referenced, inferred, missing, enhancedPrompt };
}

function checkAutoFillable(field, context) {
  if (!context) return { fillable: false, value: null };
  const map = {
    '스타일링 방식': context.techStack?.find(t => ['tailwind', 'scss', 'styled-components', 'css modules'].includes(t.toLowerCase())),
    '상태 관리': context.techStack?.find(t => ['redux', 'zustand', 'recoil', 'mobx'].includes(t.toLowerCase())),
    '라우팅': context.techStack?.find(t => ['react router', 'next.js', 'nuxt'].includes(t.toLowerCase())),
    '데이터베이스': context.techStack?.find(t => ['postgresql', 'mysql', 'mongodb', 'redis'].includes(t.toLowerCase())),
    '대상 사용자': context.domain ? `${context.domain} 분야 사용자` : null,
    '배포 환경': context.techStack?.find(t => ['aws', 'vercel', 'gcp', 'azure'].includes(t.toLowerCase())),
    '브라우저 호환': context.preferences?.includes('크로스 브라우저') ? '크로스 브라우저 지원' : null,
  };
  const value = map[field];
  return { fillable: !!value, value: value || null };
}

function buildEnhancedPrompt(originalPrompt, context, missing) {
  let parts = [];

  if (context) {
    parts.push('[PromptCraft Context]');
    if (context.role) parts.push(`역할: ${context.role}`);
    if (context.domain) parts.push(`도메인: ${context.domain}`);
    if (context.techStack?.length) parts.push(`기술 스택: ${context.techStack.join(', ')}`);
    if (context.preferences) parts.push(`선호: ${context.preferences}`);
    if (context.customContext) parts.push(`추가 맥락: ${context.customContext}`);
    parts.push('[/PromptCraft Context]');
    parts.push('');
  }

  parts.push(originalPrompt);

  // 자동 보충 가능한 항목 추가
  const autoFilled = missing.filter(m => m.autoFillable && m.profileValue);
  if (autoFilled.length > 0) {
    parts.push('');
    parts.push('추가 조건:');
    for (const item of autoFilled) {
      parts.push(`- ${item.field}: ${item.profileValue}`);
    }
  }

  return parts.join('\n');
}

// ============================================================
// API Endpoints
// ============================================================

// POST /api/analyze — 해석 분석
app.post('/api/analyze', (req, res) => {
  const { prompt, context } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt is required' });
  }

  // 분석 딜레이 시뮬레이션 (실제 Claude API 호출처럼)
  const delay = 500 + Math.random() * 1000;
  setTimeout(() => {
    const result = analyzePrompt(prompt, context || null);
    res.json(result);
  }, delay);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '0.1.0-prototype' });
});

// ============================================================
// Start Server
// ============================================================
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`\n  PromptCraft API Server`);
  console.log(`  ─────────────────────`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Health:  http://localhost:${PORT}/api/health`);
  console.log(`  Analyze: POST http://localhost:${PORT}/api/analyze\n`);
});
