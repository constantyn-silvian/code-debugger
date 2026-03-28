const getModel = () => {
  const saved = localStorage.getItem("gemini_model") || "gemini-2.5-flash";
  return saved.startsWith("gemini-") ? saved : "gemini-2.5-flash";
};
const GEMINI_URL = (key, model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

// Verifica codul userului pe testele salvate (generate o singura data la creare)
// Daca nu exista teste salvate, le genereaza acum si le salveaza
export async function runTests(problem, userCode, apiKey, onSaveTests) {
  if (!apiKey?.trim()) throw new Error("Token Gemini lipsă. Adaugă-l în Settings.");
  if (!userCode?.trim()) throw new Error("Codul este gol.");

  const model = getModel();

  // Daca avem teste salvate, le folosim direct — fara request extra
  if (problem.tests && problem.tests.length > 0) {
    return evaluateOnSavedTests(problem, userCode, apiKey, model);
  }

  // Fallback: genereaza teste acum si salveaza-le
  const tests = await generateTests(problem, apiKey, model);
  if (onSaveTests) onSaveTests(tests); // salveaza in problema
  return evaluateOnSavedTests({ ...problem, tests }, userCode, apiKey, model);
}

// Evalueaza codul pe testele salvate — un singur request
async function evaluateOnSavedTests(problem, userCode, apiKey, model) {
  const testsText = problem.tests.map((t, i) =>
    `Test ${i+1}: INPUT=${JSON.stringify(t.input)} EXPECTED=${JSON.stringify(t.expected)}`
  ).join("\n");

  const prompt =
`Esti un judge C++. Simuleaza mental executia codului de mai jos si determina outputul pentru fiecare test.
Problema: ${problem.title} — ${problem.statement?.slice(0, 200)}

COD:
${userCode}

TESTE:
${testsText}

Raspunde EXACT in formatul (tag-uri obligatorii pentru fiecare test):
<R1><GOT>ce ar printa programul</GOT><PASS>true/false</PASS></R1>
<R2><GOT>ce ar printa programul</GOT><PASS>true/false</PASS></R2>
<R3><GOT>ce ar printa programul</GOT><PASS>true/false</PASS></R3>
<R4><GOT>ce ar printa programul</GOT><PASS>true/false</PASS></R4>
<R5><GOT>ce ar printa programul</GOT><PASS>true/false</PASS></R5>`;

  let response;
  try {
    response = await fetch(GEMINI_URL(apiKey, model), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
      }),
    });
  } catch (e) { throw new Error("Eroare rețea evaluare: " + e.message); }

  if (!response.ok) {
    let body = {};
    try { body = await response.json(); } catch {}
    const msg = body?.error?.message || `HTTP ${response.status}`;
    if (response.status === 429) throw new Error("Rate limit la evaluare. Așteaptă câteva secunde.");
    throw new Error("Eroare evaluare: " + msg);
  }

  const data = await response.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  const results = problem.tests.map((t, i) => {
    const n = i + 1;
    const block = raw.match(new RegExp(`<R${n}>([\\s\\S]*?)<\\/R${n}>`, "i"));
    if (!block) return { input: t.input, expected: t.expected, actual: "?", passed: false };
    const got  = (block[1].match(/<GOT>([\s\S]*?)<\/GOT>/i)?.[1] || "").trim();
    const pass = block[1].match(/<PASS>([\s\S]*?)<\/PASS>/i)?.[1]?.trim().toLowerCase() === "true";
    return { input: t.input, expected: t.expected, actual: got, passed: pass };
  });

  if (!results.length) throw new Error("Evaluatorul nu a returnat rezultate. Încearcă din nou.");
  return results;
}

async function generateTests(problem, apiKey, model) {
  const prompt =
`Genereaza 5 teste diverse pentru problema C++: ${problem.title}.
Cerinta: ${problem.statement?.slice(0, 300)}
Intrare: ${problem.inputSpec} Iesire: ${problem.outputSpec}
Include: valori mici, valori la limita, edge cases.
<T1_IN>in1</T1_IN><T1_OUT>out1</T1_OUT>
<T2_IN>in2</T2_IN><T2_OUT>out2</T2_OUT>
<T3_IN>in3</T3_IN><T3_OUT>out3</T3_OUT>
<T4_IN>in4</T4_IN><T4_OUT>out4</T4_OUT>
<T5_IN>in5</T5_IN><T5_OUT>out5</T5_OUT>`;

  const resp = await fetch(GEMINI_URL(apiKey, model), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
    }),
  });
  if (!resp.ok) throw new Error("Nu s-au putut genera teste.");
  const data = await resp.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

  const tests = [];
  const t = (name) => { const m = raw.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`, "i")); return m ? m[1].trim() : ""; };
  for (let i = 1; i <= 5; i++) {
    const inp = t(`T${i}_IN`), out = t(`T${i}_OUT`);
    if (inp && out) tests.push({ input: inp, expected: out });
  }
  return tests;
}
