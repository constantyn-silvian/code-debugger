const getModel = () => {
  const saved = localStorage.getItem("gemini_model") || "gemini-2.5-flash";
  return saved.startsWith("gemini-") ? saved : "gemini-2.5-flash";
};
const GEMINI_URL = (key, model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

// maxOutputTokens in functie de dificultate
const MAX_TOKENS = { easy: 8192, medium: 8192, hard: 8192 };

async function callGemini(apiKey, prompt, temperature = 0.5, maxTokens = 4096) {
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

// Extrage cod C++ din raspuns — incearca mai multe strategii
function extractCode(raw) {
  // 1. Markeri @@CODE_START@@ / @@CODE_END@@
  const si = raw.indexOf("@@CODE_START@@");
  const ei = raw.indexOf("@@CODE_END@@");
  if (si !== -1 && ei > si) {
    const c = raw.slice(si + 14, ei).trim();
    if (c.includes("main")) return c;
  }
  // 2. Markdown fences ```cpp sau ```
  const fence = raw.match(/```(?:cpp|c\+\+)?\s*\n([\s\S]*?)```/i);
  if (fence && fence[1].includes("main")) return fence[1].trim();
  // 3. De la primul #include pana la sfarsit
  const idx = raw.indexOf("#include");
  if (idx !== -1) {
    const c = raw.slice(idx).trim();
    if (c.includes("main")) return c;
  }
  return "";
}

// Tag simplu (fara cod inauntru)
function tag(raw, name) {
  const m = raw.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`, "i"));
  return m ? m[1].trim() : "";
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
  easy:   { id: "easy",   label: "Ușor",  icon: "🟢", description: "Algoritm simplu, max 20 linii",       bugCount: 2, codeLines: "10-20" },
  medium: { id: "medium", label: "Mediu", icon: "🟡", description: "Logică mai complexă, vectori/matrice", bugCount: 3, codeLines: "20-40" },
  hard:   { id: "hard",   label: "Greu",  icon: "🔴", description: "DP, grafuri, recursivitate",           bugCount: 4, codeLines: "40-70" },
};

const DIFF_CTX = {
  easy:   { hint: "simpla O(n): suma, maxim, palindrom, cifre",  bugs: "off-by-one SI initializare gresita" },
  medium: { hint: "medie O(n^2): matrice, siruri, prime",         bugs: "off-by-one, operator gresit (+/-), conditie inversa" },
  hard:   { hint: "grea: DP sau BFS/DFS sau recursivitate",       bugs: "off-by-one, int vs long long, conditie DP/DFS gresita, caz de baza gresit" },
};

// ─── Prompturi per tip de problema ───────────────────────────────────────────
function buildPrompt(type, category, ctx, exclude, diff) {
  const base = `Categorie: ${category.name}. Nivel: ${ctx.hint}.${exclude ? ` Evita titluri: ${exclude}.` : ""}`;

  // Format comun pentru metadate (titlu, cerinta, exemple)
  // Codul C++ vine DUPA markerii @@CODE_START@@ / @@CODE_END@@
  // care nu pot aparea niciodata in cod C++
  const metaFormat = `
<TITLE>titlu 2-3 cuvinte romana</TITLE>
<STATEMENT>cerinta clara 1-2 paragrafe romana</STATEMENT>
<INPUT>descriere date intrare</INPUT>
<o>descriere date iesire</o>
<CONSTRAINTS>restrictii ex: 1 le n le 1000, valori intregi</CONSTRAINTS>
<EX_IN_1>intrare exemplu 1</EX_IN_1>
<EX_OUT_1>iesire exemplu 1</EX_OUT_1>
<EX_IN_2>intrare exemplu 2</EX_IN_2>
<EX_OUT_2>iesire exemplu 2</EX_OUT_2>`;

  if (type === "debug") {
    return `Creaza o problema de informatica C++ tip PBInfo. ${base}

Raspunde EXACT in formatul urmator (markerii @@CODE_START@@ si @@CODE_END@@ sunt obligatorii si trebuie sa apara exact asa):
${metaFormat}
@@CODE_START@@
// Sursa C++ completa, corecta, cin/cout, using namespace std;
// Adauga ${diff.bugCount} bug-uri subtile (${DIFF_CTX[diff.id]?.bugs || "off-by-one, initializare gresita"}) direct in cod
// IMPORTANT: nu adauga comentarii care sa indice unde sunt bug-urile
// Poti adauga comentarii de tipul "// nu modificati aceasta functie" pe linii complexe corecte
// Codul TREBUIE sa compileze fara erori de sintaxa
#include <iostream>
using namespace std;
int main() {
    // implementare cu bug-uri
}
@@CODE_END@@`;
  }

  if (type === "complete") {
    return `Creaza o problema de informatica C++ tip PBInfo unde studentul trebuie sa completeze partile lipsa. ${base}

Raspunde EXACT in formatul urmator:
${metaFormat}
@@CODE_START@@
// Sursa C++ cu parti intentionat lasate goale marcate cu TODO
// Lasa o parte semnificativa de implementat (nu doar o linie)
// Poti lasa goala: o functie auxiliara, corpul unui for, logica principala
#include <iostream>
using namespace std;
// Exemplu de structura:
// void rezolva(int n) {
//     // TODO: implementeaza algoritmul
// }
int main() {
    // TODO: citire date si apel functii
}
@@CODE_END@@`;
  }

  if (type === "rewrite_lib") {
    return `Creaza o problema de informatica C++ unde studentul trebuie sa reimplementeze functii din librarii standard FOLOSIND POINTERI. ${base}
Tipuri de functii de reimplementat: strlen, strcpy, strcat, strcmp, strrev, memset, memcpy, pow, abs, sqrt (cu metoda Newton).
Nu folosi string.h, cstring, cmath sau alte librarii pentru functiile de reimplementat. Foloseste pointeri char* si aritmetica de pointeri.

Raspunde EXACT in formatul urmator:
${metaFormat}
@@CODE_START@@
#include <iostream>
using namespace std;
// Reimplementeaza functiile cerute cu pointeri (fara a folosi libraria originala)
// Lasa TODO pentru functiile pe care studentul trebuie sa le implementeze
// Functiile deja implementate servesc ca exemplu de stil
// TODO: implementeaza functia X cu pointeri
int main() {
    // teste pentru functiile implementate
}
@@CODE_END@@`;
  }

  return "";
}

// ─── GENERARE PROBLEMA ────────────────────────────────────────────────────────
// Request 1: cerinta + cod (cu buguri deja incluse pentru "debug", sau cu TODO pentru "complete")
// Request 2: pentru "debug" — genereaza si salveaza teste bune o singura data
// Testele se salveaza in problema si se refolosesc la fiecare Submit
export async function generateNewProblem(apiKey, category, difficulty, problemType, existingTitles, onStatus) {
  if (!apiKey?.trim()) throw new Error("Token Gemini lipsă. Adaugă-l în Settings.");

  const diff    = DIFFICULTIES[difficulty] || DIFFICULTIES.easy;
  const ctx     = DIFF_CTX[difficulty]     || DIFF_CTX.easy;
  const tokBase = MAX_TOKENS[difficulty]   || 4096;
  const exclude = existingTitles.slice(-3).join(", ");

  // ── REQUEST 1: cerinta + cod ──────────────────────────────────────────────
  onStatus("1/2 — Generare problemă...");

  const p1 = buildPrompt(problemType, category, ctx, exclude, diff);

  let r1;
  try { r1 = await callGemini(apiKey, p1, 0.6, tokBase); }
  catch (e) { throw new Error(e.message); }

  const title       = tag(r1, "TITLE");
  const statement   = tag(r1, "STATEMENT");
  const inputSpec   = tag(r1, "INPUT");
  const outputSpec  = tag(r1, "OUTPUT");
  const constraints = tag(r1, "CONSTRAINTS");
  const ex1in = tag(r1, "EX_IN_1"), ex1out = tag(r1, "EX_OUT_1");
  const ex2in = tag(r1, "EX_IN_2"), ex2out = tag(r1, "EX_OUT_2");
  const mainCode = extractCode(r1);

  if (!title)    throw new Error("Gemini nu a returnat titlul. Răspuns:\n" + r1.slice(0, 300));
  if (!mainCode) throw new Error("Gemini nu a returnat cod C++ valid. Răspuns:\n" + r1.slice(0, 300));

  const examples = [];
  if (ex1in && ex1out) examples.push({ input: ex1in, output: ex1out });
  if (ex2in && ex2out) examples.push({ input: ex2in, output: ex2out });

  // ── REQUEST 2: genereaza teste bune (salvate permanent) ───────────────────
  // Testele se genereaza O SINGURA DATA si se salveaza — nu se mai regenereaza la Submit
  onStatus("2/2 — Generare teste...");

  let savedTests = [];
  // Pentru "complete" si "rewrite_lib" nu avem buggyCode, codul e cel cu TODO
  // Pentru "debug" avem codul cu buguri
  // In ambele cazuri avem nevoie de teste bazate pe cerinta + exemple
  try {
    const p2 =
`Esti un profesor de informatica. Genereaza 5 teste diverse pentru urmatoarea problema C++.
Problema: ${title}
Cerinta: ${statement}
Intrare: ${inputSpec}
Iesire: ${outputSpec}
Restrictii: ${constraints}
${examples.length ? `Exemple: ${examples.map(e=>`in="${e.input}" out="${e.output}"`).join(", ")}` : ""}

Testele trebuie sa fie DIVERSE si sa includa: valori mici, valori la limita, edge cases (n=1, array gol daca are sens, valori negative).
Raspunde EXACT in formatul urmator (5 teste, exact aceste tag-uri):
<T1_IN>date intrare test 1</T1_IN><T1_OUT>iesire corecta test 1</T1_OUT>
<T2_IN>date intrare test 2</T2_IN><T2_OUT>iesire corecta test 2</T2_OUT>
<T3_IN>date intrare test 3</T3_IN><T3_OUT>iesire corecta test 3</T3_OUT>
<T4_IN>date intrare test 4</T4_IN><T4_OUT>iesire corecta test 4</T4_OUT>
<T5_IN>date intrare test 5</T5_IN><T5_OUT>iesire corecta test 5</T5_OUT>`;

    const r2 = await callGemini(apiKey, p2, 0.3, 2048);
    for (let i = 1; i <= 5; i++) {
      const inp = tag(r2, `T${i}_IN`);
      const out = tag(r2, `T${i}_OUT`);
      if (inp && out) savedTests.push({ input: inp, expected: out });
    }
  } catch (e) {
    console.warn("Generare teste eșuată:", e.message);
  }

  const problem = {
    id: Date.now().toString(),
    title, statement, inputSpec, outputSpec, constraints, examples,
    tests: savedTests,          // salvate permanent, refolosite la fiecare Submit
    buggyCode: mainCode,        // pentru debug: cod cu buguri; pentru complete/rewrite: cod cu TODO
    correctCode: mainCode,      // pastram si versiunea originala
    category: category.name,
    difficulty: diff.id,
    problemType,                // "debug" | "complete" | "rewrite_lib"
    solved: false,
    createdAt: new Date().toISOString(),
  };

  saveProblem(problem);
  return problem;
}
