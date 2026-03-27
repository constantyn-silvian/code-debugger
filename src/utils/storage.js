const getModel = () => {
  const saved = localStorage.getItem("gemini_model") || "gemini-2.5-flash";
  return saved.startsWith("gemini-") ? saved : "gemini-2.5-flash";
};
const GEMINI_URL = (key, model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

async function callGemini(apiKey, prompt, temperature = 0.5, maxTokens = 8192) {
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

// Extrage un bloc marcat cu @@TAG_START@@ ... @@TAG_END@@
// Folosim @@ in loc de <> ca sa nu interfereze cu codul C++
function extractBlock(raw, name) {
  const start = `@@${name}_START@@`;
  const end   = `@@${name}_END@@`;
  const si = raw.indexOf(start);
  const ei = raw.indexOf(end);
  if (si === -1 || ei === -1 || ei < si) return "";
  return raw.slice(si + start.length, ei).trim();
}

// Extrage tag-uri simple (fara cod inauntru) — pentru titlu, cerinta, etc.
function tag(raw, name) {
  const m = raw.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`, "i"));
  return m ? m[1].trim() : "";
}

// Extrage codul C++ din raspuns — incearca mai multe strategii
function extractCode(raw) {
  // Strategia 1: bloc marcat cu @@CODE_START@@ ... @@CODE_END@@
  const marked = extractBlock(raw, "CODE");
  if (marked && marked.includes("main")) return marked;

  // Strategia 2: markdown fences ```cpp ... ``` sau ``` ... ```
  const fenceMatch = raw.match(/```(?:cpp|c\+\+|C\+\+)?\s*\n([\s\S]*?)```/i);
  if (fenceMatch && fenceMatch[1].includes("main")) return fenceMatch[1].trim();

  // Strategia 3: tot ce vine dupa primul #include
  const includeIdx = raw.indexOf("#include");
  if (includeIdx !== -1) {
    const candidate = raw.slice(includeIdx).trim();
    if (candidate.includes("main")) return candidate;
  }

  return "";
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
  easy:   { id: "easy",   label: "Ușor",  icon: "🟢", description: "Algoritm simplu, max 20 linii",        bugCount: 2, codeLines: "10-20" },
  medium: { id: "medium", label: "Mediu", icon: "🟡", description: "Logică mai complexă, vectori/matrice",  bugCount: 3, codeLines: "20-40" },
  hard:   { id: "hard",   label: "Greu",  icon: "🔴", description: "DP, grafuri, recursivitate",            bugCount: 4, codeLines: "40-70" },
};

const DIFF_CTX = {
  easy:   { hint: "simpla O(n): suma, maxim, palindrom, cifre",   bugs: "off-by-one SI initializare gresita" },
  medium: { hint: "medie O(n^2): matrice, siruri, prime",          bugs: "off-by-one, operator gresit (+/-), conditie inversa" },
  hard:   { hint: "grea: DP sau BFS/DFS sau recursivitate",        bugs: "off-by-one, int vs long long, conditie DP/DFS gresita, caz de baza gresit" },
};

// ─── GENERARE: 2 requesturi ───────────────────────────────────────────────────
// Request 1: cerinta + cod corect  (~200 tok in, ~2000-4000 tok out)
// Request 2: injecteaza buguri     (~120 tok in + cod, ~cod out)
// Testele se genereaza la Submit — economie maxima de tokeni la creare
export async function generateNewProblem(apiKey, category, difficulty, existingTitles, onStatus) {
  if (!apiKey?.trim()) throw new Error("Token Gemini lipsă. Adaugă-l în Settings.");

  const diff = DIFFICULTIES[difficulty] || DIFFICULTIES.easy;
  const ctx  = DIFF_CTX[difficulty] || DIFF_CTX.easy;
  const exclude = existingTitles.slice(-3).join(", ");

  // ── REQUEST 1 ─────────────────────────────────────────────────────────────
  // Folosim @@MARKER@@ in loc de <TAG> pentru sectiunea de cod,
  // ca sa nu fie confundat cu #include <iostream> sau operatori << >>
  onStatus("1/2 — Generare problemă...");

  const p1 =
`Creaza o problema de informatica C++ tip PBInfo. Categorie: ${category.name}. Nivel: ${ctx.hint}.${exclude ? ` Evita titluri: ${exclude}.` : ""}

Raspunde EXACT in formatul de mai jos. Pastreaza tag-urile si markerii EXACT asa cum sunt scrisi.
IMPORTANT: Markerii @@CODE_START@@ si @@CODE_END@@ trebuie sa apara EXACT asa in raspuns.

<TITLE>titlu 2-3 cuvinte romana</TITLE>
<STATEMENT>cerinta clara 1-2 paragrafe romana</STATEMENT>
<INPUT>descriere date intrare</INPUT>
<OUTPUT>descriere date iesire</OUTPUT>
<CONSTRAINTS>restrictii: 1<=n<=1000, valori intregi</CONSTRAINTS>
<EX_IN_1>intrare exemplu 1</EX_IN_1>
<EX_OUT_1>iesire exemplu 1</EX_OUT_1>
<EX_IN_2>intrare exemplu 2</EX_IN_2>
<EX_OUT_2>iesire exemplu 2</EX_OUT_2>
@@CODE_START@@
// sursa C++ completa si corecta, cin/cout, fara fisiere
#include <iostream>
using namespace std;
int main() {
    // implementare completa
}
@@CODE_END@@`;

  let r1;
  try { r1 = await callGemini(apiKey, p1, 0.6, 8192); }
  catch (e) { throw new Error(e.message); }

  const title       = tag(r1, "TITLE");
  const statement   = tag(r1, "STATEMENT");
  const inputSpec   = tag(r1, "INPUT");
  const outputSpec  = tag(r1, "OUTPUT");
  const constraints = tag(r1, "CONSTRAINTS");
  const ex1in       = tag(r1, "EX_IN_1");
  const ex1out      = tag(r1, "EX_OUT_1");
  const ex2in       = tag(r1, "EX_IN_2");
  const ex2out      = tag(r1, "EX_OUT_2");
  const correctCode = extractCode(r1);

  if (!title)
    throw new Error("Gemini nu a returnat titlul. Răspuns:\n" + r1.slice(0, 300));
  if (!correctCode)
    throw new Error("Gemini nu a returnat cod C++ valid. Răspuns:\n" + r1.slice(0, 300));

  const examples = [];
  if (ex1in && ex1out) examples.push({ input: ex1in, output: ex1out });
  if (ex2in && ex2out) examples.push({ input: ex2in, output: ex2out });

  // ── REQUEST 2: injecteaza buguri ──────────────────────────────────────────
  onStatus("2/2 — Injectare bug-uri...");

  let buggyCode = correctCode;
  try {
    const p2 =
`Adauga exact ${diff.bugCount} bug-uri subtile (${ctx.bugs}) in codul C++ de mai jos.
Reguli stricte: codul modificat compileaza fara erori; nu adauga/sterge variabile sau functii; nu modifica liniile cu #include sau using namespace.
Raspunde DOAR cu codul C++ modificat intre markeri (nimic altceva in afara markerilor):
@@CODE_START@@
...codul modificat...
@@CODE_END@@

${correctCode}`;

    const r2 = await callGemini(apiKey, p2, 0.4, 8192);
    const extracted = extractCode(r2);
    if (extracted && extracted.includes("main")) buggyCode = extracted;
  } catch (e) {
    console.warn("Bug injection eșuat:", e.message);
  }

  const problem = {
    id: Date.now().toString(),
    title, statement, inputSpec, outputSpec, constraints, examples,
    tests: [],
    correctCode, buggyCode,
    category: category.name,
    difficulty: diff.id,
    solved: false,
    createdAt: new Date().toISOString(),
  };

  saveProblem(problem);
  return problem;
}
