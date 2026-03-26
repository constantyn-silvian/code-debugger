const getModel = () => {
  const saved = localStorage.getItem("gemini_model") || "gemini-2.5-flash";
  return saved.startsWith("gemini-") ? saved : "gemini-2.5-flash";
};
const GEMINI_URL = (key, model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

async function callGemini(apiKey, prompt, temperature = 0.7, maxTokens = 8192) {
  const model = getModel();
  let response;
  try {
    response = await fetch(GEMINI_URL(apiKey, model), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      }),
    });
  } catch (e) { throw new Error("Eroare rețea: " + e.message); }

  if (!response.ok) {
    let body = {};
    try { body = await response.json(); } catch {}
    const msg = body?.error?.message || `HTTP ${response.status}`;
    if (response.status === 429) {
      const s = msg.match(/(\d+)s/)?.[1];
      throw new Error(`Rate limit depășit.${s ? ` Retryează în ${s}s.` : ""} Încearcă Gemini 3.1 Flash Lite din Settings (500 req/zi).`);
    }
    if (response.status === 403) throw new Error("Token fără permisiuni. Activează Generative Language API în Google Cloud Console.");
    throw new Error("Gemini error " + response.status + ": " + msg);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!text) throw new Error("Răspuns gol de la Gemini.");
  return text;
}

// ─── localStorage ─────────────────────────────────────────────────────────────
const STORAGE_KEY = "debugger_problems";
export function getProblems() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
export function saveProblem(p) {
  const all = getProblems(); all.unshift(p);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); return p;
}
export function updateProblem(id, updates) {
  const all = getProblems(); const i = all.findIndex(p => p.id === id);
  if (i !== -1) { all[i] = { ...all[i], ...updates }; localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); }
}
export function deleteProblem(id) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getProblems().filter(p => p.id !== id)));
}

// ─── Difficulty ───────────────────────────────────────────────────────────────
export const DIFFICULTIES = {
  easy:   { id: "easy",   label: "Ușor",  icon: "🟢", description: "Problemă simplă, algoritm direct, max 20 linii", bugCount: 2, codeLines: "10-20" },
  medium: { id: "medium", label: "Mediu", icon: "🟡", description: "Logică mai complexă, vectori/matrice",            bugCount: 3, codeLines: "20-40" },
  hard:   { id: "hard",   label: "Greu",  icon: "🔴", description: "Algoritmi avansați: DP, grafuri, recursivitate",  bugCount: 4, codeLines: "40-70" },
};

const DIFF_CONTEXT = {
  easy:   { hint: "simpla O(n), ex: suma elemente, maxim, numara cifre, palindrom",  bugs: "un off-by-one SI o initializare gresita" },
  medium: { hint: "moderata O(n^2), ex: matrice, siruri, numere prime, interclasare", bugs: "off-by-one, operator gresit (+/-), conditie inversa" },
  hard:   { hint: "grea: DP sau BFS/DFS sau recursivitate, ex: rucsac, componente, permutari", bugs: "off-by-one, int vs long long, conditie DP/DFS gresita, caz de baza gresit" },
};

// ─── Generator — 3 requesturi, FĂRĂ JSON cu cod înăuntru ─────────────────────
export async function generateNewProblem(apiKey, category, difficulty, existingTitles, onStatus) {
  if (!apiKey?.trim()) throw new Error("Token Gemini lipsă. Adaugă-l în Settings.");

  const diff = DIFFICULTIES[difficulty] || DIFFICULTIES.easy;
  const ctx  = DIFF_CONTEXT[difficulty]  || DIFF_CONTEXT.easy;
  const exclude = existingTitles.slice(-3).join(", ");

  // ══ REQUEST 1 — cerință + teste cu format fix, FĂRĂ pipe, FĂRĂ JSON ════════
  // Folosim tag-uri XML-like ca delimitatori — mult mai robust decât | sau JSON
  // pentru că Gemini le respectă indiferent de conținut
  onStatus("1/3 — Generare cerință și teste...");

  const p1 =
`Esti un profesor de informatica care creaza o problema de concurs C++ tip PBInfo.
Categorie: ${category.name}. Nivel dificultate: ${ctx.hint}.${exclude ? ` Nu repeta aceste titluri: ${exclude}.` : ""}

Scrie problema in formatul EXACT de mai jos (pastreaza tag-urile exact asa):

<TITLE>titlu problema in romana, 2-3 cuvinte</TITLE>
<STATEMENT>cerinta problemei, 2 paragrafe, in romana</STATEMENT>
<INPUT>descrierea datelor de intrare</INPUT>
<OUTPUT>descrierea datelor de iesire</OUTPUT>
<CONSTRAINTS>restrictii, ex: 1 <= n <= 1000, valorile din sir sunt intregi</CONSTRAINTS>
<EXAMPLE_IN_1>datele de intrare pentru exemplul 1</EXAMPLE_IN_1>
<EXAMPLE_OUT_1>datele de iesire pentru exemplul 1</EXAMPLE_OUT_1>
<EXAMPLE_IN_2>datele de intrare pentru exemplul 2</EXAMPLE_IN_2>
<EXAMPLE_OUT_2>datele de iesire pentru exemplul 2</EXAMPLE_OUT_2>
<TEST_IN_1>date intrare test 1</TEST_IN_1>
<TEST_OUT_1>raspuns corect test 1</TEST_OUT_1>
<TEST_IN_2>date intrare test 2</TEST_IN_2>
<TEST_OUT_2>raspuns corect test 2</TEST_OUT_2>
<TEST_IN_3>date intrare test 3</TEST_IN_3>
<TEST_OUT_3>raspuns corect test 3</TEST_OUT_3>
<TEST_IN_4>date intrare test 4</TEST_IN_4>
<TEST_OUT_4>raspuns corect test 4</TEST_OUT_4>
<TEST_IN_5>date intrare test 5</TEST_IN_5>
<TEST_OUT_5>raspuns corect test 5</TEST_OUT_5>

Important: testele trebuie sa fie corecte si diverse (edge cases, n=1, valori negative daca are sens).`;

  let r1;
  try { r1 = await callGemini(apiKey, p1, 0.7, 2048); }
  catch (e) { throw new Error(e.message); }

  onStatus("1/3 — Se parsează cerința...");
  const meta = parseXMLFormat(r1);

  if (!meta.title)   throw new Error("Gemini nu a generat titlul. Răspuns primit:\n" + r1.slice(0, 300));
  if (!meta.tests?.length) throw new Error("Gemini nu a generat teste. Răspuns primit:\n" + r1.slice(0, 300));

  // ══ REQUEST 2 — sursă C++ corectă, text pur, fără JSON ════════════════════
  onStatus("2/3 — Generare sursă C++...");

  // Construim testele ca text simplu pentru context
  const testsText = meta.tests.map((t, i) =>
    `Test ${i+1}:\nInput:\n${t.input}\nOutput asteptat:\n${t.expected}`
  ).join("\n---\n");

  const p2 =
`Scrie sursa C++ completa si corecta (100 puncte) pentru urmatoarea problema.
Foloseste cin/cout. Raspunde DOAR cu codul C++, fara explicatii, fara backticks markdown.

Titlu: ${meta.title}
Cerinta: ${meta.statement}
Date intrare: ${meta.inputSpec}
Date iesire: ${meta.outputSpec}
Restrictii: ${meta.constraints}

Sursa ta trebuie sa produca OUTPUT-UL EXACT pentru aceste teste:
${testsText}`;

  let correctCode;
  try {
    const r2 = await callGemini(apiKey, p2, 0.2, 4096);
    correctCode = r2
      .replace(/^```(?:cpp|c\+\+|C\+\+)?\s*/im, "")
      .replace(/\s*```\s*$/im, "")
      .trim();
  } catch (e) { throw new Error("Generare cod eșuată: " + e.message); }

  if (!correctCode.includes("main"))
    throw new Error("Gemini nu a generat cod C++ valid. Încearcă din nou.");

  // ══ REQUEST 3 — injectare buguri, text pur, fără JSON ═════════════════════
  onStatus("3/3 — Injectare bug-uri...");

  let buggyCode = correctCode;
  try {
    const p3 =
`Adauga exact ${diff.bugCount} bug-uri subtile (${ctx.bugs}) in codul C++ de mai jos.
Reguli stricte: codul modificat trebuie sa compileze fara erori de sintaxa; nu adauga/sterge variabile sau functii; nu modifica #include si using namespace.
Raspunde DOAR cu codul C++ modificat, fara backticks, fara alte cuvinte:

${correctCode}`;

    const r3 = await callGemini(apiKey, p3, 0.5, 4096);
    const cleaned = r3
      .replace(/^```(?:cpp|c\+\+|C\+\+)?\s*/im, "")
      .replace(/\s*```\s*$/im, "")
      .trim();
    if (cleaned.includes("main")) buggyCode = cleaned;
  } catch (e) {
    console.warn("Bug injection eșuat:", e.message);
  }

  const problem = {
    id: Date.now().toString(),
    title: meta.title,
    statement: meta.statement,
    inputSpec: meta.inputSpec,
    outputSpec: meta.outputSpec,
    constraints: meta.constraints,
    examples: meta.examples,
    tests: meta.tests,
    correctCode,
    buggyCode,
    category: category.name,
    difficulty: diff.id,
    solved: false,
    createdAt: new Date().toISOString(),
  };

  saveProblem(problem);
  return problem;
}

// ─── Parser XML-like ──────────────────────────────────────────────────────────
function tag(raw, name) {
  const m = raw.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`));
  return m ? m[1].trim() : "";
}

function parseXMLFormat(raw) {
  const examples = [];
  for (let i = 1; i <= 3; i++) {
    const inp = tag(raw, `EXAMPLE_IN_${i}`);
    const out = tag(raw, `EXAMPLE_OUT_${i}`);
    if (inp && out) examples.push({ input: inp, output: out });
  }

  const tests = [];
  for (let i = 1; i <= 5; i++) {
    const inp = tag(raw, `TEST_IN_${i}`);
    const out = tag(raw, `TEST_OUT_${i}`);
    if (inp && out) tests.push({ input: inp, expected: out });
  }

  return {
    title:       tag(raw, "TITLE"),
    statement:   tag(raw, "STATEMENT"),
    inputSpec:   tag(raw, "INPUT"),
    outputSpec:  tag(raw, "OUTPUT"),
    constraints: tag(raw, "CONSTRAINTS"),
    examples,
    tests,
  };
}
