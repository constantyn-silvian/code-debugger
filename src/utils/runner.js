const getModel = () => {
  const saved = localStorage.getItem("gemini_model") || "gemini-2.5-flash";
  return saved.startsWith("gemini-") ? saved : "gemini-2.5-flash";
};
const GEMINI_URL = (key, model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

// La Submit, Gemini:
// 1. Genereaza 5 teste (edge cases incluse) pentru problema
// 2. Simuleaza executia codului userului pe fiecare test
// 3. Returneaza rezultatele
// Un singur request - economie maxima de tokeni
export async function runTests(problem, userCode, apiKey) {
  if (!apiKey?.trim()) throw new Error("Token Gemini lipsă. Adaugă-l în Settings.");
  if (!userCode?.trim()) throw new Error("Codul este gol.");

  const model = getModel();

  const prompt =
`Esti un judge automat pentru C++. Ai urmatoarea problema si codul unui student.

PROBLEMA: ${problem.title}
Cerinta: ${problem.statement}
Date intrare: ${problem.inputSpec}
Date iesire: ${problem.outputSpec}
Restrictii: ${problem.constraints}
${problem.examples?.length ? `Exemple:\n${problem.examples.map(e => `Input: ${e.input}\nOutput: ${e.output}`).join("\n")}` : ""}

COD STUDENT:
${userCode}

Sarcina ta:
1. Genereaza 5 teste diverse (incluzand edge cases: n=1, valori la limita, valori negative daca au sens)
2. Pentru fiecare test, simuleaza mental executia codului de mai sus (nu a solutiei corecte!) si determina ce ar printa
3. Compara cu outputul corect al problemei

Raspunde EXACT in formatul urmator (pastreaza tag-urile):
<TEST_1>
<IN>datele de intrare</IN>
<EXPECTED>outputul corect al problemei</EXPECTED>
<GOT>ce ar printa codul studentului</GOT>
<PASS>true sau false</PASS>
</TEST_1>
<TEST_2>
<IN>datele de intrare</IN>
<EXPECTED>outputul corect</EXPECTED>
<GOT>ce ar printa codul studentului</GOT>
<PASS>true sau false</PASS>
</TEST_2>
<TEST_3>
<IN>datele de intrare</IN>
<EXPECTED>outputul corect</EXPECTED>
<GOT>ce ar printa codul studentului</GOT>
<PASS>true sau false</PASS>
</TEST_3>
<TEST_4>
<IN>datele de intrare</IN>
<EXPECTED>outputul corect</EXPECTED>
<GOT>ce ar printa codul studentului</GOT>
<PASS>true sau false</PASS>
</TEST_4>
<TEST_5>
<IN>datele de intrare</IN>
<EXPECTED>outputul corect</EXPECTED>
<GOT>ce ar printa codul studentului</GOT>
<PASS>true sau false</PASS>
</TEST_5>`;

  let response;
  try {
    response = await fetch(GEMINI_URL(apiKey, model), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
      }),
    });
  } catch (e) { throw new Error("Eroare rețea: " + e.message); }

  if (!response.ok) {
    let body = {};
    try { body = await response.json(); } catch {}
    const msg = body?.error?.message || `HTTP ${response.status}`;
    if (response.status === 429) throw new Error("Rate limit la evaluare. Așteaptă câteva secunde.");
    throw new Error("Eroare evaluare: " + msg);
  }

  const data = await response.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!raw) throw new Error("Răspuns gol de la evaluator.");

  // Parsare rezultate
  const results = [];
  for (let i = 1; i <= 5; i++) {
    const block = raw.match(new RegExp(`<TEST_${i}>([\\s\\S]*?)<\\/TEST_${i}>`, "i"));
    if (!block) continue;
    const b = block[1];
    const t = (name) => {
      const m = b.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`, "i"));
      return m ? m[1].trim() : "";
    };
    const passStr = t("PASS").toLowerCase();
    results.push({
      input:    t("IN"),
      expected: t("EXPECTED"),
      actual:   t("GOT"),
      passed:   passStr === "true",
    });
  }

  if (!results.length) throw new Error("Evaluatorul nu a returnat rezultate valide. Încearcă din nou.");
  return results;
}
