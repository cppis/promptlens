/**
 * PromptLens — Sample prompt analysis data
 * Used by visualization components for demonstration
 */

// ---------- 1. Prompt structure tree (D3 hierarchy) ----------
export const promptStructure = {
  name: 'Prompt',
  type: 'root',
  children: [
    {
      name: 'Role',
      type: 'role',
      value: 'You are a senior backend engineer specializing in distributed systems.',
      score: 92,
      children: [
        { name: 'Expertise', type: 'detail', value: 'distributed systems', score: 95 },
        { name: 'Seniority', type: 'detail', value: 'senior', score: 88 }
      ]
    },
    {
      name: 'Context',
      type: 'context',
      value: 'We are migrating a monolithic e-commerce platform to microservices on AWS EKS.',
      score: 85,
      children: [
        { name: 'Domain', type: 'detail', value: 'e-commerce platform', score: 80 },
        { name: 'Current State', type: 'detail', value: 'monolithic architecture', score: 90 },
        { name: 'Target State', type: 'detail', value: 'microservices on AWS EKS', score: 88 }
      ]
    },
    {
      name: 'Instruction',
      type: 'instruction',
      value: 'Design a service decomposition strategy with clear bounded contexts.',
      score: 78,
      children: [
        { name: 'Action', type: 'detail', value: 'Design decomposition strategy', score: 82 },
        { name: 'Constraint', type: 'detail', value: 'clear bounded contexts', score: 75 },
        { name: 'Missing', type: 'warning', value: 'No output format specified', score: 40 }
      ]
    },
    {
      name: 'Output Format',
      type: 'format',
      value: '(not specified)',
      score: 30,
      children: [
        { name: 'Missing', type: 'warning', value: 'Add: table, diagram, or markdown structure', score: 20 }
      ]
    },
    {
      name: 'Examples',
      type: 'example',
      value: '(not provided)',
      score: 15,
      children: [
        { name: 'Missing', type: 'warning', value: 'Include a sample service boundary example', score: 10 }
      ]
    }
  ]
};

// ---------- 2. Five-axis radar scores ----------
export const radarScores = {
  axes: ['Clarity', 'Specificity', 'Context', 'Structure', 'Actionability'],
  current: [78, 85, 82, 55, 70],
  improved: [92, 95, 90, 88, 93]
};

// ---------- 3. Token distribution ----------
export const tokenDistribution = [
  { name: 'Role', tokens: 14, pct: 17, color: '#7c3aed' },
  { name: 'Context', tokens: 22, pct: 27, color: '#2563eb' },
  { name: 'Instruction', tokens: 18, pct: 22, color: '#059669' },
  { name: 'Constraints', tokens: 8, pct: 10, color: '#d97706' },
  { name: 'Filler Words', tokens: 12, pct: 15, color: '#dc2626' },
  { name: 'Other', tokens: 7, pct: 9, color: '#6b7280' }
];

// ---------- 4. History trend (last 7 days) ----------
export const historyTrend = [
  { date: '03-15', score: 62, prompts: 5 },
  { date: '03-16', score: 68, prompts: 8 },
  { date: '03-17', score: 71, prompts: 6 },
  { date: '03-18', score: 65, prompts: 3 },
  { date: '03-19', score: 78, prompts: 7 },
  { date: '03-20', score: 82, prompts: 9 },
  { date: '03-21', score: 85, prompts: 4 }
];

// ---------- 5. Inline annotation data ----------
export const annotatedPrompt = {
  raw: `You are a senior backend engineer specializing in distributed systems. We are migrating a monolithic e-commerce platform to microservices on AWS EKS. Design a service decomposition strategy with clear bounded contexts.`,
  segments: [
    { start: 0, end: 73, text: 'You are a senior backend engineer specializing in distributed systems.', type: 'role', label: 'Role Definition', quality: 'good', tip: null },
    { start: 74, end: 169, text: 'We are migrating a monolithic e-commerce platform to microservices on AWS EKS.', type: 'context', label: 'Context', quality: 'good', tip: 'Add current pain points for richer context' },
    { start: 170, end: 248, text: 'Design a service decomposition strategy with clear bounded contexts.', type: 'instruction', label: 'Instruction', quality: 'warning', tip: 'Specify output format (table, diagram, list) and depth of detail' }
  ],
  missingElements: [
    { type: 'format', label: 'Output Format', suggestion: 'Add: "Present as a table with columns: Service Name, Responsibility, Dependencies, Data Ownership"' },
    { type: 'example', label: 'Example', suggestion: 'Add: "For reference, here is how the Order service boundary might look: ..."' },
    { type: 'constraint', label: 'Constraints', suggestion: 'Add: "Each microservice should own its database and expose async events via SNS/SQS"' }
  ]
};

// ---------- 6. Overall score gauge ----------
export const overallScore = {
  value: 68,
  grade: 'B-',
  label: 'Good foundation, needs structure improvements'
};
