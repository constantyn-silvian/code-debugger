const getModel = () => {
  const saved = localStorage.getItem("gemini_model") || "gemini-2.5-flash";
  return saved.startsWith("gemini-") ? saved : "gemini-2.5-flash";
};
const GEMINI_URL = (key, model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

async function callGemini(apiKey, prompt, temperature = 0.5) {
  const model = getModel();
  let response;
  try {
    response = await fetch(GEMINI_URL(apiKey, model), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature, maxOutputTokens: 8192 },
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

function extractCode(raw) {
  const si = raw.indexOf("@@CODE_START@@");
  const ei = raw.indexOf("@@CODE_END@@");
  if (si !== -1 && ei > si) {
    const c = raw.slice(si + 14, ei).trim();
    if (c.includes("main") || c.includes("int ")) return c;
  }
  const fence = raw.match(/```(?:cpp|c\+\+)?\s*\n([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  const idx = raw.indexOf("#include");
  if (idx !== -1) return raw.slice(idx).trim();
  return "";
}

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

// ─── Config per dificultate si tip ────────────────────────────────────────────
export const DIFFICULTIES = {
  easy:   { id: "easy",   label: "Ușor",  icon: "🟢", description: "2-3 taskuri simple, evidente",         taskCount: "2-3", codeLines: "15-25" },
  medium: { id: "medium", label: "Mediu", icon: "🟡", description: "4-5 taskuri intermediare, edge cases",  taskCount: "4-5", codeLines: "30-50" },
  hard:   { id: "hard",   label: "Greu",  icon: "🔴", description: "5+ taskuri dificile, algoritmi avansați", taskCount: "5+",  codeLines: "50-90" },
};

// Specificatii detaliate per (tip, dificultate) — ce si cat genereaza Gemini
const SPEC = {
  // ── DEBUG: bug-uri de gasit si reparat ────────────────────────────────────
  debug: {
    easy: {
      algo: "simpla O(n): suma elemente, maxim/minim, numara cifre, palindrom simplu",
      codeLen: "15-25 linii, o singura functie main",
      bugs: `Adauga exact 2 bug-uri SIMPLE si EVIDENTE — vizibile dupa 1-2 minute:
1. Off-by-one clar: ex i=1 in loc de i=0, sau i<n in loc de i<=n
2. Initializare gresita evidenta: ex s=1 in loc de s=0, maxi=-1 in loc de 0
Studentul e incepator. Bug-urile nu trebuie sa fie ascunse.`,
      testNote: "n=1, n=0 daca are sens, valori mici pozitive, un test cu toate elementele egale",
    },
    medium: {
      algo: "medie O(n^2): matrice, siruri, numere prime, interclasare, ciurul lui Eratostene",
      codeLen: "25-45 linii, poate include o functie auxiliara",
      bugs: `Adauga exact 4 bug-uri de dificultate MEDIE — necesita 5-15 minute:
1. Off-by-one subtil intr-o bucla imbricate (ex j<n in loc de j<=n)
2. Operator logic gresit (ex && in loc de ||, sau & in loc de &&)
3. Conditie inversa intr-un if (ex a[i]>maxi in loc de a[i]<mini)
4. Calcul gresit: ex inmultire in loc de adunare, sau impartire gresita
Studentul e intermediar. Bug-urile apar la edge cases sau valori limita.`,
      testNote: "n=1, valori negative, valori la limita superioara, array sortat crescator si descrescator",
    },
    hard: {
      algo: "dificila: DP (rucsac, LCS, LIS), BFS/DFS pe matrice sau graf, recursivitate cu memoizare",
      codeLen: "45-70 linii, multiple functii",
      bugs: `Adauga exact 5 bug-uri DIFICILE — necesita analiza profunda a algoritmului:
1. Caz de baza gresit in DP sau recursie (ex dp[0]=1 in loc de dp[0]=0)
2. int in loc de long long pentru sume sau produse mari
3. Conditie BFS/DFS gresita (ex vizitare duplicata, sau directie de vecin lipsa)
4. Index off-by-one intr-o structura 2D (ex dp[i][j-1] in loc de dp[i-1][j])
5. Initializare gresita a unui vector/matrice (ex fill cu 0 in loc de INF sau invers)
Studentul e avansat. Bug-urile sunt in logica algoritmului, nu sintaxa.`,
      testNote: "n=1, n la limita maxima, caz fara solutie, toate elementele egale, caz cu solutie unica",
    },
  },

  // ── COMPLETEAZĂ: parti de cod lipsa, studentul le scrie ───────────────────
  complete: {
    easy: {
      algo: "simpla O(n): suma, maxim, palindrom, cifre",
      codeLen: "15-25 linii",
      todoSpec: `Lasa 2-3 locuri TODO simple si independente:
- corpul buclei principale (ex: logica de acumulare sau comparatie)
- calculul rezultatului final
Citirea datelor si structura generala sunt scrise. Studentul completeaza 2-3 linii per TODO.
Exemplu: for-ul e scris, dar inauntru e // TODO: actualizeaza suma si maximul
NU dezvalui cum se calculeaza in comentarii.`,
      testNote: "valori mici, n=1, valori negative daca are sens",
    },
    medium: {
      algo: "medie O(n^2): matrice, siruri, prime, sortare",
      codeLen: "30-50 linii",
      todoSpec: `Lasa 4-5 locuri TODO de complexitate medie:
- o functie auxiliara completa (ex: bool estePrim(int n))
- 2-3 bucle sau conditii cheie din main
- eventual o functie de afisare sau formatare rezultat
Scheletul cu declaratii si citire e scris. Studentul implementeaza logica.
NU da hints despre algoritm in comentarii — doar // TODO: implementeaza functia X`,
      testNote: "valori mici, valori la limita, n=0 daca are sens",
    },
    hard: {
      algo: "dificila: DP, BFS/DFS, recursivitate",
      codeLen: "50-75 linii",
      todoSpec: `Lasa 5+ locuri TODO care formeaza impreuna algoritmul principal:
- 2-3 functii ale algoritmului (ex: initializare DP, tranzitii, reconstructie)
- conditii de terminare sau caz de baza
- logica de actualizare a structurii de date
Doar declaratii, structuri de date si main-ul schelet sunt scrise.
NU da hints despre implementare — studentul trebuie sa deduca algoritmul din cerinta.`,
      testNote: "n=1, n la limita, cazuri degenerate, caz fara solutie",
    },
  },

  // ── REIMPLEMENTEAZĂ LIBRARII: cu pointeri ─────────────────────────────────
  rewrite_lib: {
    easy: {
      algo: "pointeri simpli: strlen si strcpy",
      codeLen: "25-40 linii",
      libSpec: `Problema: studentul implementeaza 2 functii simple cu pointeri char*.
- strlen: implementata CORECT ca exemplu de stil cu pointeri (nu folosi [])
- strcpy: marcata // TODO — studentul o implementeaza
Functia strlen e scrisa si comentata ca sa arate stilul cu pointeri.
Main-ul testeaza ambele functii cu 3-4 siruri diferite.
NU folosi string.h, cstring. Foloseste mereu using namespace std.`,
      testNote: "sir gol, sir cu un caracter, sir scurt, sir cu spatii",
    },
    medium: {
      algo: "pointeri intermediari: strcmp, strcat, strchr sau strrev",
      codeLen: "45-65 linii",
      libSpec: `Problema: 4-5 functii cu pointeri char* sau int*:
- 2 functii implementate CORECT ca exemple (ex: strlen, strcpy)
- 2 functii marcate // TODO (ex: strcmp, strcat)
- optionat: 1 functie implementata GRESIT (are un bug subtil) — studentul o repara
Aritmetica de pointeri, nu indexare cu []. Main-ul testeaza toate functiile.
NU folosi string.h, cstring, cmath. Foloseste mereu using namespace std.`,
      testNote: "siruri egale, siruri diferite, sir gol, caractere speciale",
    },
    hard: {
      algo: "pointeri avansati: strstr, strtok, memcpy, sqrt Newton, sau implementare vector dinamic",
      codeLen: "65-90 linii",
      libSpec: `Problema: 6-7 functii cu pointeri, complexitate crescanda:
- 2 functii implementate CORECT ca exemple avansate (ex: strstr cu pointeri)
- 3-4 functii marcate // TODO (ex: strtok, memcpy, sqrt Newton)
- 1 functie implementata GRESIT cu bug dificil (ex: off-by-one in memcpy)
Include pointer la pointer (**), alocare dinamica (new/delete), sau struct cu pointeri.
Main-ul are teste extinse pentru toate functiile.
NU folosi string.h, cstring, cmath, stdlib. Foloseste mereu using namespace std.`,
      testNote: "pointer null, buffer mare, caractere speciale, valori limita pentru functii numerice",
    },
  },
};

// ─── Prompt builder compact ────────────────────────────────────────────────────
function buildPrompt(type, category, difficulty, exclude) {
  const sp = SPEC[type]?.[difficulty];
  if (!sp) throw new Error(`Tip/dificultate necunoscut: ${type}/${difficulty}`);

  const excl = exclude ? ` Evita titluri: ${exclude}.` : "";

  // Format metadate — fara cod inauntru
  const meta = `<TITLE>titlu 2-3 cuvinte romana</TITLE>
<STATEMENT>cerinta 1-2 paragrafe romana</STATEMENT>
<INPUT>date intrare</INPUT>
<o>date iesire</o>
<CONSTRAINTS>restrictii: 1 le n le 1000</CONSTRAINTS>
<EX_IN_1>intrare ex1</EX_IN_1><EX_OUT_1>iesire ex1</EX_OUT_1>
<EX_IN_2>intrare ex2</EX_IN_2><EX_OUT_2>iesire ex2</EX_OUT_2>`;

  if (type === "debug") {
    return `Problema informatica C++ tip PBInfo. Categorie: ${category.name}. Algoritm: ${sp.algo}.${excl}

Format raspuns (respecta EXACT markerii, ei nu apar in C++):
${meta}
@@CODE_START@@
#include <iostream>
using namespace std;
// Cod ${sp.codeLen} cu ${sp.bugs}
// NU adauga comentarii care indica unde sunt bug-urile
// Poti comenta linii complexe corecte cu "// nu modifica"
// Codul compileaza fara erori
int main() { }
@@CODE_END@@`;
  }

  if (type === "complete") {
    return `Problema informatica C++ tip PBInfo unde studentul completeaza partile lipsa. Categorie: ${category.name}. Algoritm: ${sp.algo}.${excl}

${sp.todoSpec}

Format raspuns (respecta EXACT markerii):
${meta}
@@CODE_START@@
#include <iostream>
using namespace std;
// Cod ${sp.codeLen} cu parti TODO
// NU dezvalui algoritmul in comentarii
int main() { }
@@CODE_END@@`;
  }

  if (type === "rewrite_lib") {
    return `Problema informatica C++ cu pointeri. Categorie: Pointeri. Algoritm: ${sp.algo}.${excl}

${sp.libSpec}

Format raspuns (respecta EXACT markerii):
${meta}
@@CODE_START@@
#include <iostream>
using namespace std;
// Cod ${sp.codeLen}
// NU include string.h, cstring, cmath pentru functiile de implementat
int main() { }
@@CODE_END@@`;
  }
}

// ─── Prompt pentru teste — include teste care SA DEA GRESIT pe codul cu buguri ─
function buildTestsPrompt(title, statement, inputSpec, outputSpec, constraints, examples, type, difficulty) {
  const sp = SPEC[type]?.[difficulty];
  const exStr = examples.length
    ? examples.map(e => `in: ${e.input} -> out: ${e.output}`).join("; ")
    : "";

  // Pentru debug: vrem teste care sa dea gresit pe cod cu buguri
  // Pentru complete/rewrite_lib: vrem teste care verifica implementarea
  const testGoal = type === "debug"
    ? `IMPORTANT: cel putin 3 din 5 teste trebuie sa fie proiectate sa detecteze bug-uri tipice (${sp?.testNote || "valori edge"}).
Alege inputuri care scot la iveala off-by-one, initializari gresite, conditii inverse.`
    : `Alege inputuri diverse care verifica corectitudinea implementarii. ${sp?.testNote || ""}`;

  return `Genereaza 5 teste pentru problema C++: "${title}"
Cerinta: ${statement?.slice(0, 250)}
Intrare: ${inputSpec} | Iesire: ${outputSpec} | Restrictii: ${constraints}
${exStr ? `Exemple: ${exStr}` : ""}
${testGoal}

Raspunde DOAR cu tag-urile (nimic altceva):
<T1_IN>in1</T1_IN><T1_OUT>out1</T1_OUT>
<T2_IN>in2</T2_IN><T2_OUT>out2</T2_OUT>
<T3_IN>in3</T3_IN><T3_OUT>out3</T3_OUT>
<T4_IN>in4</T4_IN><T4_OUT>out4</T4_OUT>
<T5_IN>in5</T5_IN><T5_OUT>out5</T5_OUT>`;
}

// ─── GENERARE PROBLEMA — 2 requesturi ─────────────────────────────────────────
export async function generateNewProblem(apiKey, category, difficulty, problemType, existingTitles, onStatus) {
  if (!apiKey?.trim()) throw new Error("Token Gemini lipsă. Adaugă-l în Settings.");

  const diff    = DIFFICULTIES[difficulty] || DIFFICULTIES.easy;
  const exclude = existingTitles.slice(-3).join(", ");

  // ── REQUEST 1: cerinta + cod ──────────────────────────────────────────────
  onStatus("1/2 — Generare problemă...");
  const p1 = buildPrompt(problemType, category, difficulty, exclude);

  let r1;
  try { r1 = await callGemini(apiKey, p1, 0.65); }
  catch (e) { throw new Error(e.message); }

  const title       = tag(r1, "TITLE");
  const statement   = tag(r1, "STATEMENT");
  const inputSpec   = tag(r1, "INPUT");
  const outputSpec  = tag(r1, "OUTPUT");
  const constraints = tag(r1, "CONSTRAINTS");
  const ex1in = tag(r1, "EX_IN_1"), ex1out = tag(r1, "EX_OUT_1");
  const ex2in = tag(r1, "EX_IN_2"), ex2out = tag(r1, "EX_OUT_2");
  const mainCode = extractCode(r1);

  if (!title)    throw new Error("Gemini nu a returnat titlul.\n" + r1.slice(0, 300));
  if (!mainCode) throw new Error("Gemini nu a returnat cod C++.\n" + r1.slice(0, 300));

  const examples = [];
  if (ex1in && ex1out) examples.push({ input: ex1in, output: ex1out });
  if (ex2in && ex2out) examples.push({ input: ex2in, output: ex2out });

  // ── REQUEST 2: teste cu expected calculat din sursa corecta ─────────────
  // IMPORTANT: dam Gemini sursa corecta si ii cerem sa ruleze mental pe inputuri
  // alese de el — asa expected-ul e consistent cu sursa, nu inventat
  onStatus("2/2 — Generare și verificare teste...");
  let savedTests = [];
  try {
    const sp = SPEC[problemType]?.[difficulty];
    const testNote = sp?.testNote || "n=1, valori mici, edge cases";
    const p2 =
`Genereaza 5 teste pentru problema C++: "${title}"
Cerinta: ${statement?.slice(0, 250)}
Intrare: ${inputSpec} | Iesire: ${outputSpec} | Restrictii: ${constraints}
${examples.length ? `Exemple: ${examples.map(e=>`in:${e.input}->out:${e.output}`).join("; ")}` : ""}
Teste diverse: ${testNote}

SURSA C++ CORECTA (ruleaza-o mental pentru a calcula outputul exact al fiecarui test):
${mainCode.slice(0, 1200)}

Pentru fiecare test: alege input valid, ruleaza mental sursa de mai sus, scrie outputul exact.

Raspunde DOAR cu tag-urile:
<T1_IN>input1</T1_IN><T1_OUT>output sursa corecta pentru input1</T1_OUT>
<T2_IN>input2</T2_IN><T2_OUT>output sursa corecta pentru input2</T2_OUT>
<T3_IN>input3</T3_IN><T3_OUT>output sursa corecta pentru input3</T3_OUT>
<T4_IN>input4</T4_IN><T4_OUT>output sursa corecta pentru input4</T4_OUT>
<T5_IN>input5</T5_IN><T5_OUT>output sursa corecta pentru input5</T5_OUT>`;

    const r2 = await callGemini(apiKey, p2, 0.0);
    for (let i = 1; i <= 5; i++) {
      const inp = tag(r2, `T${i}_IN`);
      const out = tag(r2, `T${i}_OUT`);
      if (inp && out) savedTests.push({ input: inp, expected: out });
    }
  } catch (e) { console.warn("Teste eșuate:", e.message); }

  const problem = {
    id: Date.now().toString(),
    title, statement, inputSpec, outputSpec, constraints, examples,
    tests: savedTests,
    buggyCode: mainCode,
    correctCode: mainCode,
    category: category.name,
    difficulty: diff.id,
    problemType,
    solved: false,
    createdAt: new Date().toISOString(),
  };

  saveProblem(problem);
  return problem;
}
