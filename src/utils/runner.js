// ─── Runner: Judge0 (compilator real GCC) + fallback Gemini ──────────────────
//
// Judge0 CE public instance: https://ce.judge0.com  (gratuit, fara cheie, ~100 req/zi)
// RapidAPI Judge0:            https://judge0-ce.p.rapidapi.com  (cheie RapidAPI, 50 req/zi)
//
// Fluxul:
//  1. La generare: Gemini produce cerinta + correctCode + buggyCode
//  2. Runner compileaza correctCode pe Judge0, ruleaza pe inputurile generate de Gemini
//     => obtine expected outputs REALE (nu simulate)
//  3. La Submit: compileaza codul userului, ruleaza pe aceleasi inputuri, compara cu expected

const J0_LANG = 54; // C++ GCC 9.2.0

function j0Config() {
  const key  = localStorage.getItem("judge0_key")  || "";
  const host = localStorage.getItem("judge0_host") || "https://ce.judge0.com";
  const useRapid = !!key;
  return {
    url: useRapid
      ? "https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true"
      : `${host}/submissions?base64_encoded=false&wait=true`,
    headers: {
      "Content-Type": "application/json",
      ...(useRapid ? { "X-RapidAPI-Key": key, "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com" } : {}),
    },
  };
}

async function j0Run(code, input) {
  const cfg = j0Config();
  let resp;
  try {
    resp = await fetch(cfg.url, {
      method: "POST",
      headers: cfg.headers,
      body: JSON.stringify({
        language_id: J0_LANG,
        source_code: code,
        stdin: input ?? "",
        cpu_time_limit: 5,
        memory_limit: 65536,
      }),
    });
  } catch (e) {
    throw new Error("Nu pot contacta Judge0: " + e.message);
  }

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    if (resp.status === 429) throw new Error("judge0_rate_limit");
    throw new Error(`Judge0 HTTP ${resp.status}: ${txt.slice(0, 120)}`);
  }

  const d = await resp.json();
  const sid = d.status?.id;

  if (sid === 6)       return { ok: false, error: "Eroare compilare:\n" + (d.compile_output || "").trim() };
  if (sid === 5)       return { ok: false, error: "TLE" };
  if (sid >= 7)        return { ok: false, error: "Runtime Error: " + (d.stderr || d.status?.description || "").trim() };
  return { ok: true, output: (d.stdout || "").trim() };
}

function norm(s) {
  return (s || "").split("\n").map(l => l.trimEnd()).join("\n").trim();
}

// ─── Gemini fallback (daca Judge0 nu e disponibil) ────────────────────────────
const getModel = () => localStorage.getItem("gemini_model") || "gemini-2.5-flash";

async function geminiFallbackRun(code, input, apiKey) {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${getModel()}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text:
          `Executa mental exact acest cod C++ cu inputul dat. Raspunde DOAR cu outputul exact, nimic altceva.
Cod:\n${code}\nInput:\n${input}`
        }] }],
        generationConfig: { temperature: 0.0, maxOutputTokens: 512 },
      }),
    }
  );
  if (!resp.ok) throw new Error("Gemini fallback error");
  const d = await resp.json();
  return (d.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
}

// ─── Export: genereaza expected outputs rulând correctCode pe Judge0 ──────────
export async function generateExpectedOutputs(problem, apiKey) {
  if (!problem.tests?.length) return [];
  const results = [];
  let useGeminiFallback = false;

  for (const t of problem.tests) {
    if (!useGeminiFallback) {
      try {
        const res = await j0Run(problem.correctCode, t.input);
        if (res.ok) {
          results.push({ ...t, expected: res.output });
        } else if (res.error === "judge0_rate_limit" || res.error?.includes("Nu pot contacta")) {
          useGeminiFallback = true;
        } else {
          // Eroare de compilare sau runtime in correctCode — pastreaza expected-ul vechi
          results.push(t);
        }
      } catch (e) {
        if (e.message.includes("judge0_rate_limit") || e.message.includes("Nu pot contacta")) {
          useGeminiFallback = true;
        } else {
          results.push(t);
        }
      }
    }

    if (useGeminiFallback && apiKey) {
      try {
        const out = await geminiFallbackRun(problem.correctCode, t.input, apiKey);
        results.push({ ...t, expected: out });
      } catch {
        results.push(t);
      }
    }
  }
  return results;
}

// ─── Export: ruleaza codul userului si compara cu expected ────────────────────
export async function runTests(problem, userCode, apiKey, onSaveTests) {
  if (!userCode?.trim()) throw new Error("Codul este gol.");

  let tests = problem.tests || [];
  if (!tests.length) throw new Error("Niciun test disponibil. Regenerează problema.");

  // Daca testele nu au expected calculat de compilator (au doar cel de la Gemini la generare),
  // recalculeaza-le cu Judge0 prima data
  const needsRecompute = tests.some(t => !t.verifiedByCompiler);
  if (needsRecompute && problem.correctCode) {
    const recomputed = await generateExpectedOutputs(problem, apiKey);
    if (recomputed.length === tests.length) {
      tests = recomputed.map(t => ({ ...t, verifiedByCompiler: true }));
      if (onSaveTests) onSaveTests(tests);
    }
  }

  // Ruleaza codul userului pe fiecare test
  const results = [];
  let compileErr = null;
  let useGeminiFallback = false;

  for (let i = 0; i < tests.length; i++) {
    const t = tests[i];

    if (!useGeminiFallback) {
      try {
        const res = await j0Run(userCode, t.input);
        if (!res.ok) {
          if (res.error?.startsWith("Eroare compilare")) {
            compileErr = res.error;
            break;
          }
          results.push({ input: t.input, expected: t.expected, actual: `[${res.error}]`, passed: false });
          continue;
        }
        const got = norm(res.output);
        const exp = norm(t.expected);
        results.push({ input: t.input, expected: t.expected, actual: res.output, passed: got === exp });
        continue;
      } catch (e) {
        if (e.message.includes("judge0_rate_limit") || e.message.includes("Nu pot contacta")) {
          useGeminiFallback = true;
        } else {
          results.push({ input: t.input, expected: t.expected, actual: `[${e.message}]`, passed: false });
          continue;
        }
      }
    }

    // Fallback Gemini
    if (useGeminiFallback && apiKey) {
      try {
        const out = await geminiFallbackRun(userCode, t.input, apiKey);
        const got = norm(out), exp = norm(t.expected);
        results.push({ input: t.input, expected: t.expected, actual: out, passed: got === exp });
      } catch {
        results.push({ input: t.input, expected: t.expected, actual: "?", passed: false });
      }
    }
  }

  if (compileErr) throw new Error(compileErr);
  if (!results.length) throw new Error("Niciun test nu a putut fi rulat.");
  return results;
}

// Test conexiune Judge0
export async function testJudge0() {
  try {
    const res = await j0Run(`#include<iostream>\nusing namespace std;\nint main(){cout<<42;}`, "");
    if (res.ok && res.output === "42") return "ok";
    return res.error || "Output neasteptat: " + res.output;
  } catch (e) {
    return "eroare: " + e.message;
  }
}
