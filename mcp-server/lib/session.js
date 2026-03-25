/**
 * 세션 컨텍스트 — MCP 서버 프로세스 생존 기간 동안 entryId 이력을 추적한다.
 * 서버 재시작 시 초기화된다 (의도된 동작).
 *
 * recentEntryIds: 최대 10개 링 버퍼. 인덱스 0이 가장 최근 항목.
 * >> last N 트리거에서 N번째 이전 항목을 O(1)로 조회한다.
 */
const sessionCtx = {
  lastEntryId: null,       // 기존 호환용 — recentEntryIds[0]과 항상 동일
  lastProjectId: null,
  recentEntryIds: [],      // 최대 10개 링 버퍼
};

const RECENT_LIMIT = 10;

// ── 기존 API (하위 호환 유지) ───────────────────────────────────────────

export function getLastEntryId() {
  return sessionCtx.lastEntryId;
}

/** @deprecated pushRecentEntryId 사용 권장. 기존 코드 호환용으로만 유지. */
export function setLastEntryId(id) {
  sessionCtx.lastEntryId = id;
}

export function getLastProjectId() {
  return sessionCtx.lastProjectId;
}

export function setLastProjectId(id) {
  sessionCtx.lastProjectId = id;
}

// ── 링 버퍼 API (>> last N 지원) ──────────────────────────────────────

/**
 * 분석 완료 시마다 호출한다. 버퍼 앞에 삽입하고 초과분은 뒤에서 제거한다.
 * lastEntryId도 함께 갱신하므로 기존 getLastEntryId() 호출은 수정 불필요.
 */
export function pushRecentEntryId(id) {
  sessionCtx.recentEntryIds.unshift(id);
  if (sessionCtx.recentEntryIds.length > RECENT_LIMIT) {
    sessionCtx.recentEntryIds.pop();
  }
  sessionCtx.lastEntryId = id;
}

/**
 * n번째 이전 entryId를 반환한다 (1-based: 1 = 가장 최근).
 * 존재하지 않으면 null 반환.
 */
export function getRecentEntryIdAt(n) {
  return sessionCtx.recentEntryIds[n - 1] ?? null;
}

/** 현재 버퍼에 쌓인 항목 수 반환 (0~10). */
export function getRecentEntryCount() {
  return sessionCtx.recentEntryIds.length;
}
