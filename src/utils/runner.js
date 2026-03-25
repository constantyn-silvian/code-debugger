const GEMINI_MODEL = "gemini-3.1-pro-preview";
const GEMINI_URL = (key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;

export async function runTests(code, tests, apiKey) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error("Token Gemini lipsa. Adauga-l in Settings.");
  }
  if (!tests || tests.length === 0) {
    throw new Error("Niciun test disponibil pentru aceasta problema.");
  }

  const testList = tests
    .map((t, i) => `Test ${i + 1}:\nInput: ${t.input}\nOutput asteptat: ${t.expected}`)
    .join("\n\n");

  const prompt = `Esti un interpret C++ precis. Executa mental urmatorul cod pentru fiecare test si returneaza output-ul exact.

Cod C++:
${code}

${testList}

Reguli:
- Simuleaza exact cum ar rula g++ (tipuri, overflow, bucle, conditii)
- Pentru fiecare test returneaza exact ce printeaza programul
- Daca e Runtime Error scrie "RE", daca e bucla infinita scrie "TLE"
- Compara output-ul cu cel asteptat (ignora spatii/newline la final)

Raspunde DOAR cu JSON valid, fara backticks:
{
  "results": [
    {"test": 1, "actual": "output exact", "passed": true},
    {"test": 2, "actual": "output exact", "passed": false}
  ]
}`;

  let response;
  try {
    response = await fetch(GEMINI_URL(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
      }),
    });
  } catch (netErr) {
    throw new Error("Eroare retea la evaluare: " + netErr.message);
  }

  if (!response.ok) {
    let body = {};
    try { body = await response.json(); } catch {}
    const msg = body?.error?.message || `HTTP ${response.status}`;
    throw new Error("Gemini evaluator error: " + msg);
  }

  const data = await response.json();
  let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  text = text.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) try { parsed = JSON.parse(m[0]); } catch {}
    if (!parsed) throw new Error("Nu s-a putut parsa raspunsul evaluatorului.");
  }

  return tests.map((t, i) => {
    const r = parsed.results?.find((x) => x.test === i + 1) || {};
    const actual = String(r.actual ?? "").trim();
    const expected = String(t.expected ?? "").trim();
    const passed =
      actual === expected ||
      actual.replace(/\s+/g, " ") === expected.replace(/\s+/g, " ");

    return {
      input: t.input,
      expected: t.expected,
      actual: r.actual !== undefined ? String(r.actual) : "(no output)",
      passed,
    };
  });
}
