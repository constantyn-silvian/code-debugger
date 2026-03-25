// gemini-1.5-flash e disponibil pe TOATE cheile free-tier
const GEMINI_MODEL = "gemini-3.1-pro-preview";
const GEMINI_URL = (key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;

async function callGemini(apiKey, prompt, temperature = 0.7) {
  let response;
  try {
    response = await fetch(GEMINI_URL(apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature, maxOutputTokens: 4096 },
      }),
    });
  } catch (netErr) {
    throw new Error("Eroare retea: " + netErr.message);
  }

  if (!response.ok) {
    let body = {};
    try { body = await response.json(); } catch {}
    const msg = body?.error?.message || `HTTP ${response.status}`;
    if (response.status === 400) throw new Error("Token Gemini invalid sau request gresit: " + msg);
    if (response.status === 403) throw new Error("Token fara permisiuni - verifica ca ai activat 'Generative Language API' in Google Cloud Console: " + msg);
    if (response.status === 429) throw new Error("Rate limit depasit. Asteapta cateva secunde si incearca din nou.");
    throw new Error("Gemini API error " + response.status + ": " + msg);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  if (!candidate) {
    const blockReason = data.promptFeedback?.blockReason;
    throw new Error("Gemini a blocat raspunsul" + (blockReason ? ": " + blockReason : ""));
  }
  const text = candidate.content?.parts?.[0]?.text || "";
  if (!text) throw new Error("Raspuns gol de la Gemini.");
  return text;
}

function extractJSON(raw) {
  let text = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();
  try { return JSON.parse(text); } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch {}
  }
  throw new Error("Nu s-a putut parsa JSON. Raspuns: " + text.slice(0, 200));
}

// ─── localStorage helpers ────────────────────────────────────────────────────

const STORAGE_KEY = "debugger_problems";

export function getProblems() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}

export function saveProblem(problem) {
  const problems = getProblems();
  problems.unshift(problem);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(problems));
  return problem;
}

export function updateProblem(id, updates) {
  const problems = getProblems();
  const idx = problems.findIndex((p) => p.id === id);
  if (idx !== -1) {
    problems[idx] = { ...problems[idx], ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(problems));
  }
}

export function deleteProblem(id) {
  const problems = getProblems().filter((p) => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(problems));
}

// ─── Generator ───────────────────────────────────────────────────────────────

export async function generateNewProblem(apiKey, category, existingTitles, onStatus) {
  if (!apiKey || !apiKey.trim()) throw new Error("Token Gemini lipsa. Adauga-l in Settings.");

  onStatus("Se genereaza problema...");

  const excludeList = existingTitles.length > 0
    ? "Nu folosi aceste titluri deja generate: " + existingTitles.join(", ") + "."
    : "";

  const prompt = `Esti un generator de probleme de informatica similare cu cele de pe PBInfo.ro.

Categoria: ${category.name} - ${category.description}
${excludeList}

Genereaza o singura problema. Raspunde DOAR cu un JSON valid, fara backticks, fara text in afara JSON-ului.

Structura exacta:
{
  "title": "titlu scurt in romana",
  "statement": "cerinta problemei, 2-3 paragrafe",
  "inputSpec": "descriere date de intrare",
  "outputSpec": "descriere date de iesire",
  "constraints": "restrictii ex: 1 <= n <= 1000",
  "examples": [
    {"input": "5\n1 2 3 4 5", "output": "15"},
    {"input": "3\n10 20 30", "output": "60"}
  ],
  "correctCode": "sursa C++ completa si corecta cu #include si main",
  "tests": [
    {"input": "5\n1 2 3 4 5", "expected": "15"},
    {"input": "3\n10 20 30", "expected": "60"},
    {"input": "1\n7", "expected": "7"},
    {"input": "4\n0 0 0 0", "expected": "0"},
    {"input": "2\n-5 5", "expected": "0"}
  ]
}

Reguli:
- Sursa C++ trebuie sa fie 100% corecta si compilabila
- Testele trebuie sa fie corecte (output-ul sa corespunda cu sursa)
- Foloseste cin/cout
- Categoria: ${category.name}`;

  let rawText;
  try {
    rawText = await callGemini(apiKey, prompt, 0.8);
  } catch (e) {
    throw new Error("Generare problema esuata: " + e.message);
  }

  let parsed;
  try {
    parsed = extractJSON(rawText);
  } catch (e) {
    throw new Error("Parsare JSON esuata: " + e.message);
  }

  if (!parsed.title || !parsed.statement || !parsed.correctCode) {
    throw new Error("Raspuns incomplet de la Gemini (lipsesc title/statement/correctCode).");
  }
  if (!Array.isArray(parsed.tests) || parsed.tests.length === 0) {
    throw new Error("Gemini nu a generat teste.");
  }

  onStatus("Se injecteaza bug-uri in sursa...");

  let buggyCode = parsed.correctCode;
  try {
    buggyCode = await injectBugs(apiKey, parsed.correctCode, parsed.statement);
  } catch (e) {
    console.warn("Bug injection esuat, se foloseste sursa corecta:", e.message);
  }

  const problem = {
    id: Date.now().toString(),
    title: parsed.title,
    statement: parsed.statement,
    inputSpec: parsed.inputSpec || "",
    outputSpec: parsed.outputSpec || "",
    constraints: parsed.constraints || "",
    examples: Array.isArray(parsed.examples) ? parsed.examples : [],
    tests: parsed.tests,
    correctCode: parsed.correctCode,
    buggyCode,
    category: category.name,
    solved: false,
    createdAt: new Date().toISOString(),
  };

  saveProblem(problem);
  return problem;
}

async function injectBugs(apiKey, correctCode, statement) {
  const prompt = `Esti un expert C++ care adauga bug-uri subtile intr-o sursa corecta.

Sursa corecta:
${correctCode}

Cerinta: ${statement}

Adauga 2-3 bug-uri subtile din categoriile:
- Off-by-one: < in loc de <=
- Initializare gresita: s=1 in loc de s=0
- Operator gresit: + in loc de -
- Conditie inversa: > in loc de <

Reguli stricte:
- Nu modifica structura, nu adauga/sterge variabile
- Codul trebuie sa compileze fara erori
- Nu modifica #include si using namespace std

Raspunde DOAR cu codul C++ modificat, fara explicatii, fara backticks.`;

  const text = await callGemini(apiKey, prompt, 0.6);
  return text.replace(/```(?:cpp|c\+\+)?\s*/gi, "").replace(/```\s*/gi, "").trim() || correctCode;
}
