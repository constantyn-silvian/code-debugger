const getModel = () => {
  const saved = localStorage.getItem("gemini_model") || "gemini-2.5-flash";
  return saved.startsWith("gemini-") ? saved : "gemini-2.5-flash";
};
const GEMINI_URL = (key, model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

async function callGemini(apiKey, prompt, maxTokens = 2048) {
  const model = getModel();
  const resp = await fetch(GEMINI_URL(apiKey, model), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.0, maxOutputTokens: maxTokens },
    }),
  });
  if (!resp.ok) {
    let body = {};
    try { body = await resp.json(); } catch {}
    const msg = body?.error?.message || `HTTP ${resp.status}`;
    if (resp.status === 429) throw new Error("Rate limit. Încearcă din nou în câteva secunde.");
    throw new Error("Gemini error: " + msg);
  }
  const data = await resp.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

function tag(raw, name) {
  const m = raw.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`, "i"));
  return m ? m[1].trim() : "";
}

function normalize(s) {
  return (s || "").split("\n").map(l => l.trimEnd()).join("\n").trim();
}

// ─── Evaluare cod pe teste ─────────────────────────────────────────────────────
// Strategia: dam Gemini SURSA CORECTA + testele + codul userului
// Gemini calculeaza expected rulând sursa corecta mental (cod simplu, max 30 linii)
// si compara cu ce produce codul userului
// Asa expected-ul e calculat din sursa corecta, nu inventat

export async function runTests(problem, userCode, apiKey, onSaveTests) {
  if (!apiKey?.trim()) throw new Error("Token Gemini lipsă. Adaugă-l în Settings.");
  if (!userCode?.trim()) throw new Error("Codul este gol.");

  let tests = problem.tests || [];

  // Daca nu avem teste salvate, genereaza-le acum cu expected calculat din sursa corecta
  if (!tests.length) {
    tests = await generateAndVerifyTests(problem, apiKey);
    if (onSaveTests) onSaveTests(tests);
  }

  if (!tests.length) throw new Error("Nu s-au putut genera teste. Încearcă din nou.");

  // Evalueaza codul userului pe teste — un singur request cu toate testele
  return evaluateUserCode(problem, userCode, tests, apiKey);
}

// Genereaza teste SI calculeaza expected rulând sursa corecta
// Sursa corecta vine din problema — e generata de Gemini si e corecta
async function generateAndVerifyTests(problem, apiKey) {
  const prompt =
`Esti un profesor de informatica care creaza teste pentru o problema C++.

PROBLEMA: ${problem.title}
Cerinta: ${problem.statement?.slice(0, 300)}
Intrare: ${problem.inputSpec}
Iesire: ${problem.outputSpec}
Restrictii: ${problem.constraints}

SURSA C++ CORECTA (ruleaza-o mental pentru a calcula outputul exact):
${problem.correctCode}

Genereaza 5 teste diverse. Pentru fiecare test:
1. Alege un input valid conform restrictiilor
2. Ruleaza mental SURSA C++ CORECTA de mai sus pe acel input
3. Scrie outputul exact pe care il produce sursa corecta

Teste diverse: valori mici, n=1, valori la limita, valori negative daca are sens, edge case.

Raspunde DOAR cu tag-urile (nimic altceva):
<T1_IN>input test 1</T1_IN>
<T1_OUT>output exact al sursei corecte pentru input 1</T1_OUT>
<T2_IN>input test 2</T2_IN>
<T2_OUT>output exact al sursei corecte pentru input 2</T2_OUT>
<T3_IN>input test 3</T3_IN>
<T3_OUT>output exact al sursei corecte pentru input 3</T3_OUT>
<T4_IN>input test 4</T4_IN>
<T4_OUT>output exact al sursei corecte pentru input 4</T4_OUT>
<T5_IN>input test 5</T5_IN>
<T5_OUT>output exact al sursei corecte pentru input 5</T5_OUT>`;

  const raw = await callGemini(apiKey, prompt, 2048);
  const tests = [];
  for (let i = 1; i <= 5; i++) {
    const inp = tag(raw, `T${i}_IN`);
    const out = tag(raw, `T${i}_OUT`);
    if (inp && out) tests.push({ input: inp, expected: out });
  }
  return tests;
}

// Evalueaza codul userului: Gemini ruleaza mental AMBELE coduri si compara
async function evaluateUserCode(problem, userCode, tests, apiKey) {
  const testsBlock = tests.map((t, i) =>
    `<TEST id="${i+1}">\n<INPUT>${t.input}</INPUT>\n<EXPECTED>${t.expected}</EXPECTED>\n</TEST>`
  ).join("\n");

  const prompt =
`Esti un interpret C++ precis. Ai doua surse si trebuie sa determini daca produc acelasi output.

SURSA CORECTA (referinta — outputul ei e cel asteptat):
${(problem.correctCode || "").slice(0, 1500)}

CODUL STUDENTULUI (de evaluat):
${userCode.slice(0, 1500)}

TESTE (inputul si outputul asteptat calculat din sursa corecta):
${testsBlock}

Pentru fiecare test, executa mental CODUL STUDENTULUI cu inputul dat si compara cu EXPECTED.
Fii foarte precis: verifica fiecare variabila, fiecare bucla, fiecare conditie din codul studentului.

Raspunde EXACT in formatul (nimic altceva):
<R1><GOT>output exact al codului studentului</GOT><PASS>true</PASS></R1>
<R2><GOT>output exact al codului studentului</GOT><PASS>false</PASS></R2>
...etc pentru fiecare test`;

  const raw = await callGemini(apiKey, prompt, 2048);

  const results = tests.map((t, i) => {
    const n = i + 1;
    const block = raw.match(new RegExp(`<R${n}>([\\s\\S]*?)<\\/R${n}>`, "i"));
    if (!block) return { input: t.input, expected: t.expected, actual: "?", passed: false };
    const got  = tag(block[1], "GOT");
    const pass = tag(block[1], "PASS").toLowerCase() === "true";
    // Dubla verificare: compara si noi textual
    const normGot = normalize(got);
    const normExp = normalize(t.expected);
    const actuallyPassed = pass || normGot === normExp;
    return { input: t.input, expected: t.expected, actual: got || "?", passed: actuallyPassed };
  });

  if (!results.length) throw new Error("Evaluatorul nu a returnat rezultate. Încearcă din nou.");
  return results;
}
