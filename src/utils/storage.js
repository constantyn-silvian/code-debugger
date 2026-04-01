// ─── Gemini API ───────────────────────────────────────────────────────────────
const getModel = () => {
  const s = localStorage.getItem("gemini_model") || "gemini-2.5-flash";
  return s.startsWith("gemini-") ? s : "gemini-2.5-flash";
};
const G_URL = k =>
  `https://generativelanguage.googleapis.com/v1beta/models/${getModel()}:generateContent?key=${k}`;

const SYSTEM_PROMPT = `You are an advanced competitive programming problem generator and controlled bug-injection system.
Generate C++ problems, correct solutions, test cases, and intentionally buggy solutions. Follow ALL rules strictly.

LANGUAGE: C++ ONLY. ALWAYS include using namespace std; Competitive programming style. Realistic contest code.

PROBLEM TYPE HANDLING:
- DEBUG / COMPLETE problems: generate ONLY from the user-specified category. Respect it strictly.
- REIMPLEMENTATION problems: randomly choose a category yourself. User does not choose.

CORRECT SOLUTION: Fully correct C++. MUST pass ALL 5 tests.

BUGGY SOLUTION — HARD REQUIREMENT:
Buggy solution MUST FAIL ALL TEST CASES. If it passes even ONE test → modify until it fails ALL.

Bug rules by difficulty:
EASY (2-4 bugs): mostly syntax (missing semicolons, wrong operators, typos) + 1-2 small logic bugs
MEDIUM (4-6 bugs): mix syntax+logic — off-by-one, wrong conditions, incorrect loops — MUST fail ALL tests
HARD (8+ bugs): complex logic bugs dominate — incorrect algorithms, broken assumptions, edge-case failures, some syntax — MUST fail ALL tests

FORCED FAILURE GUARANTEE (VERY IMPORTANT):
To ensure buggy fails ALL tests, use these strategies:
- Wrong core formula or algorithm
- Always-incorrect condition in main logic
- Corrupt a key variable used everywhere
- Break main loop termination or direction
Then simulate mentally and confirm ALL outputs are wrong. If not → ADD MORE BUGS.

BUG DISTRIBUTION: Spread bugs across the code. Never cluster. Make some subtle.
ANTI-ACCIDENTAL CORRECTNESS: For MEDIUM and HARD, deliberately alter logic AFTER writing correct code.
NEVER add comments indicating where bugs are.

TEST CASES: 5 diverse correct tests. Include: n=1, boundary values, all-equal, zero result, normal case.
Different from examples. Validate each against correct solution. NEVER generate broken tests.

GENERATION ORDER (STRICT):
Step 1: Generate problem
Step 2: Generate correct solution
Step 3: Generate and validate 5 tests
Step 4: Inject bugs
Step 5: Simulate buggy on ALL tests — ensure ALL fail
Step 6: Output using ONLY the tags from user prompt. No text outside tags.`;

async function gemini(apiKey, userPrompt, temp = 0.4) {
  const r = await fetch(G_URL(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      // system_instruction injectat ca primul mesaj — suportat de Gemini API
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: temp, maxOutputTokens: 8192 },
    }),
  });
  if (!r.ok) {
    let b = {}; try { b = await r.json(); } catch {}
    const m = b?.error?.message || `HTTP ${r.status}`;
    if (r.status === 429) {
      const s = m.match(/(\d+)s/)?.[1];
      throw new Error(`Rate limit.${s ? ` Retry în ${s}s.` : ""} Încearcă Gemini 3.1 Flash Lite.`);
    }
    if (r.status === 403) throw new Error("Token fără permisiuni. Activează Generative Language API.");
    throw new Error("Gemini error " + r.status + ": " + m);
  }
  const d = await r.json();
  const t = d.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!t) throw new Error("Răspuns gol Gemini.");
  return t;
}

function extractCode(raw) {
  const si = raw.indexOf("@@CODE_START@@"), ei = raw.indexOf("@@CODE_END@@");
  if (si !== -1 && ei > si) {
    const c = raw.slice(si + 14, ei).trim();
    if (c.includes("main") || c.includes("#include")) return c;
  }
  const f = raw.match(/```(?:cpp|c\+\+)?\s*\n([\s\S]*?)```/i);
  if (f) return f[1].trim();
  const idx = raw.indexOf("#include");
  if (idx !== -1) return raw.slice(idx).trim();
  return "";
}

function tag(raw, name) {
  const m = raw.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`, "i"));
  return m ? m[1].trim() : "";
}

// ─── localStorage ─────────────────────────────────────────────────────────────
const KEY = "debugger_problems";
export const getProblems   = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
export const saveProblem   = p  => { const a = getProblems(); a.unshift(p); localStorage.setItem(KEY, JSON.stringify(a)); return p; };
export const deleteProblem = id => localStorage.setItem(KEY, JSON.stringify(getProblems().filter(p => p.id !== id)));
export function updateProblem(id, upd) {
  const a = getProblems(), i = a.findIndex(p => p.id === id);
  if (i !== -1) { a[i] = { ...a[i], ...upd }; localStorage.setItem(KEY, JSON.stringify(a)); }
}

// ─── Difficulty config ────────────────────────────────────────────────────────
export const DIFFICULTIES = {
  easy:   { id: "easy",   label: "Ușor",  icon: "🟢", description: "Locală — algoritm direct, 15-35 linii" },
  medium: { id: "medium", label: "Mediu", icon: "🟡", description: "Județeană — logică complexă, structuri de date" },
  hard:   { id: "hard",   label: "Greu",  icon: "🔴", description: "Națională — algoritmi avansați, design complex" },
};

// ─── Styles per (type × difficulty) ──────────────────────────────────────────
// Calibrate on real examples: easy=local, medium=county, hard=national
const STYLE = {
  debug: {
    easy: `LOCAL level (school/local olympiad stage). Simple direct algorithms.
Problem types: digit sum/control, primes in interval, matrix sum/product/transpose,
Collatz sequence, struct transfer, cstring operations, student grade averages, simple simulations.
Correct code: 15-35 lines, 1-3 simple functions, no advanced STL.
DIFFICULTY: EASY`,
    medium: `COUNTY level (county olympiad stage). Data structures and algorithms.
Problem types: dynamic stack/queue with pointers, fast exponentiation O(log p), Lee/BFS maze,
bit operations (verify/set bits), 3x3 kernel convolution, multi-criteria sort,
IRV voting with checksum validation, frequency in sorted array with lower/upper_bound, strtok string processing.
Correct code: 30-60 lines, STL (vector, map, queue, set), O(n log n) or O(n*m) algorithms.
DIFFICULTY: MEDIUM`,
    hard: `NATIONAL/LOT level (ONI final, national team selection). Advanced algorithms and complex design.
Problem types: BFS with bitmask state, Hamming(8,4) decoding, double Vigenere decryption,
interval_map with std::map, multi-dimensional DP, Freivalds randomized verification,
Diamond inheritance C++, AST + Visitor pattern, XOR self-referential operations, blockchain RSA simulation.
Correct code: 50-100 lines, templates, OOP, advanced bit manipulation, complex STL.
DIFFICULTY: HARD`,
  },

  complete: {
    easy: `LOCAL level. Code with 2-3 TODO sections. Simple algorithm skeleton provided.
Reading and general structure written. Student completes the core logic.
TODOs must be meaningful (not just one line) — delete entire loop bodies or calculations.`,
    medium: `COUNTY level. Code with 4-5 TODO sections. Includes auxiliary function to implement.
Skeleton with declarations and reading written. Student implements the algorithm.
TODOs: one complete auxiliary function + 2-3 key conditions/loops in main.`,
    hard: `NATIONAL level. Code with 5+ TODO sections. Classes/structs defined, student implements algorithm.
Only declarations, data structures, and main skeleton provided.
TODOs: 2-3 core algorithm methods + termination conditions + state transitions.`,
  },

  rewrite_lib: {
    easy: `LOCAL level. 2 pointer functions: one correct as example, one TODO or one buggy.
No string.h, cstring. using namespace std always. 25-40 lines.`,
    medium: `COUNTY level. 4-5 pointer functions: 2 correct examples, 2 TODO, optionally 1 buggy.
Pure pointer arithmetic (no [] indexing). No string.h, cstring, cmath. 40-65 lines.`,
    hard: `NATIONAL level. 6-7 advanced pointer functions: 2 correct examples, 3-4 TODO, 1 buggy.
Include pointer-to-pointer (**), dynamic allocation new/delete, structs with pointers.
Functions: strstr, strtok, memcpy, Newton sqrt, or dynamic vector. 60-90 lines.`,
  },
};

// ─── User prompt per type — compact, token-efficient ─────────────────────────
function buildUserPrompt(type, category, difficulty, exclude) {
  const style = STYLE[type]?.[difficulty] || "";
  const excl  = exclude ? `Avoid these titles: ${exclude}. ` : "";
  const cat   = type === "rewrite_lib" ? "Pointers/Library" : category.name;
  const D     = difficulty.toUpperCase();

  // Tests + metadata tags (no code inside — avoids << >> XML issues)
  const ioTags = `<TITLE>2-3 word Romanian title</TITLE>
<STATEMENT>problem statement in Romanian, 1-2 paragraphs</STATEMENT>
<INPUT>input format</INPUT>
<OUTPUT_SPEC>output format</OUTPUT_SPEC>
<CONSTRAINTS>constraints</CONSTRAINTS>
<EX_IN_1>example 1 input</EX_IN_1><EX_OUT_1>example 1 output</EX_OUT_1>
<EX_IN_2>example 2 input</EX_IN_2><EX_OUT_2>example 2 output</EX_OUT_2>
<T1_IN>test 1 input</T1_IN><T1_OUT>correct output</T1_OUT>
<T2_IN>test 2 input</T2_IN><T2_OUT>correct output</T2_OUT>
<T3_IN>test 3 input</T3_IN><T3_OUT>correct output</T3_OUT>
<T4_IN>test 4 input</T4_IN><T4_OUT>correct output</T4_OUT>
<T5_IN>test 5 input</T5_IN><T5_OUT>correct output</T5_OUT>`;

  const codeTags = `@@CORRECT_START@@
// correct solution here
@@CORRECT_END@@
@@BUGGY_START@@
// buggy solution here
@@BUGGY_END@@`;

  if (type === "debug") return `Generate a ${D} C++ competitive programming debug problem.
Category: ${cat}. ${excl}${style}

Follow system prompt steps: correct → tests → inject ${D} bugs → verify bugs fail tests.
5 test cases: include n=1, boundary values, all-equal elements, zero result, normal case.
Tests must differ from examples. Buggy solution must FAIL most/all tests.

Output ONLY these tags (code between @@ markers, never inside XML):
${ioTags}
${codeTags}`;

  if (type === "complete") return `Generate a ${D} C++ competitive programming problem where student completes missing parts.
Category: ${cat}. ${excl}${style}

Follow system prompt steps: correct → tests → create incomplete version with TODO comments.
TODOs: EASY=2-3, MEDIUM=4-5, HARD=5+. Delete significant blocks, not single lines.
TODO comments: describe WHAT to do, NOT HOW. Incomplete code must fail tests.

Output ONLY these tags (code between @@ markers):
${ioTags}
@@CORRECT_START@@
// complete correct solution
@@CORRECT_END@@
@@BUGGY_START@@
// incomplete version with // TODO: comments
@@BUGGY_END@@`;

  if (type === "rewrite_lib") return `Generate a ${D} C++ problem about reimplementing stdlib functions with pointers.
${excl}${style}

Rules: no string.h/cstring/cmath, pure pointer arithmetic (no [] indexing), using namespace std always.
Steps: correct (all functions) → tests → student version (1-2 examples correct, rest TODO, optionally 1 buggy).
Student version must fail tests.

Output ONLY these tags (code between @@ markers):
${ioTags}
@@CORRECT_START@@
// all functions correctly implemented with pointers
@@CORRECT_END@@
@@BUGGY_START@@
// student version: some TODO, optionally 1 subtle bug
@@BUGGY_END@@`;
}


// ─── GENERATE PROBLEM — single focused Gemini request ─────────────────────────
export async function generateNewProblem(apiKey, category, difficulty, problemType, existingTitles, onStatus) {
  if (!apiKey?.trim()) throw new Error("Token Gemini lipsă. Adaugă-l în Settings.");

  const diff    = DIFFICULTIES[difficulty] || DIFFICULTIES.easy;
  const exclude = existingTitles.slice(-3).join(", ");

  // ── Single Gemini request with system_instruction ──────────────────────────
  // System prompt enforces: correct solution first → validate tests → inject bugs → verify bugs fail
  onStatus("1/2 — Generare problemă...");

  let raw;
  try {
    raw = await gemini(apiKey, buildUserPrompt(problemType, category, difficulty, exclude), 0.4);
  } catch (e) { throw new Error(e.message); }

  // Parse metadata
  const title       = tag(raw, "TITLE");
  const statement   = tag(raw, "STATEMENT");
  const inputSpec   = tag(raw, "INPUT");
  const outputSpec  = tag(raw, "OUTPUT_SPEC");
  const constraints = tag(raw, "CONSTRAINTS");
  const ex1in = tag(raw, "EX_IN_1"), ex1out = tag(raw, "EX_OUT_1");
  const ex2in = tag(raw, "EX_IN_2"), ex2out = tag(raw, "EX_OUT_2");

  if (!title) throw new Error("Gemini nu a returnat titlul.\n" + raw.slice(0, 300));

  // Parse tests (T1..T5)
  const tests = [];
  for (let i = 1; i <= 5; i++) {
    const inp = tag(raw, `T${i}_IN`);
    const out = tag(raw, `T${i}_OUT`);
    if (inp && out) tests.push({ input: inp, expected: out, verifiedByCompiler: false });
  }

  // Parse correct and buggy code using @@ markers (safe from C++ operators)
  const extractMarked = (startMark, endMark) => {
    const si = raw.indexOf(startMark), ei = raw.indexOf(endMark);
    if (si !== -1 && ei > si) {
      const c = raw.slice(si + startMark.length, ei).trim();
      if (c.includes("main") || c.includes("#include")) return c;
    }
    return "";
  };

  let correctCode = extractMarked("@@CORRECT_START@@", "@@CORRECT_END@@");
  let buggyCode   = extractMarked("@@BUGGY_START@@",   "@@BUGGY_END@@");

  // Fallbacks if markers missing
  if (!correctCode) correctCode = extractCode(raw);
  if (!buggyCode)   buggyCode   = correctCode;

  if (!correctCode) throw new Error("Gemini nu a returnat codul C++.\n" + raw.slice(0, 400));

  const examples = [];
  if (ex1in && ex1out) examples.push({ input: ex1in, output: ex1out });
  if (ex2in && ex2out) examples.push({ input: ex2in, output: ex2out });

  // ── Judge0: recompute expected using real GCC compiler ─────────────────────
  // This ensures test expected outputs are always correct regardless of AI errors
  if (tests.length > 0 && correctCode) {
    onStatus("2/2 — Verificare teste cu compilatorul C++...");
    try {
      const { generateExpectedOutputs } = await import("./runner.js");
      const verified = await generateExpectedOutputs({ correctCode, tests }, apiKey);
      if (verified.length === tests.length) {
        // Replace AI-generated expected with compiler-verified ones
        for (let i = 0; i < tests.length; i++) {
          if (verified[i].expected !== "") {
            tests[i].expected = verified[i].expected;
            tests[i].verifiedByCompiler = true;
          }
        }
      }
    } catch (e) {
      console.warn("Judge0 indisponibil — expected-urile sunt cele generate de AI:", e.message);
    }
  }

  const problem = {
    id: Date.now().toString(),
    title, statement, inputSpec, outputSpec, constraints, examples,
    tests,
    correctCode,
    buggyCode,
    category: category.name,
    difficulty: diff.id,
    problemType,
    solved: false,
    createdAt: new Date().toISOString(),
  };

  saveProblem(problem);
  return problem;
}
