# Code Debugger 🐛

O aplicație web React inspirată de secțiunea **Interoperabilitate Software** de pe AcadNet — primești surse C++ sabotate de AI și trebuie să le repari.

## Setup

```bash
npm install
npm run dev
```

## Cum funcționează

1. **Landing Page** — pagina principală cu prezentarea aplicației
2. **Settings** — adaugă-ți tokenul Gemini API (gratuit de pe [Google AI Studio](https://aistudio.google.com/app/apikey))
3. **Probleme** — lista problemelor generate, stocată în `localStorage`
4. **Generare problemă** — alege o categorie (tablouri, DP, grafuri etc.), Gemini generează:
   - Cerința problemei
   - Sursa C++ corectă de 100 de puncte
   - Buguri subtile adăugate în sursă
   - Seturi de teste cu input/output expected
5. **Debug** — editează codul direct în browser, dă Submit, Gemini simulează execuția și compară output-urile
6. **Hint** — dacă ești blocat, cere un hint AI care nu dezvăluie bug-ul direct

## Stiva tehnică

- **React 18** + Vite
- **Gemini 2.0 Flash API** — generare probleme, injectare buguri, evaluare teste
- **localStorage** — persistența problemelor între sesiuni
- **CSS pur** — design dark theme, font Space Mono + Syne

## Structura proiectului

```
src/
├── App.jsx              # Router simplu între pagini
├── pages/
│   ├── LandingPage.jsx  # Prima pagină
│   ├── ProblemsPage.jsx # Lista problemelor + generator
│   └── DebugPage.jsx    # Editor + teste + hint
├── components/
│   └── SettingsModal.jsx # Configurare Gemini key
└── utils/
    ├── storage.js       # localStorage + Gemini problem generator
    ├── runner.js        # Evaluare teste cu Gemini
    └── categories.js    # Categorii PBInfo
```

## Note

- Evaluarea testelor se face prin Gemini care simulează execuția C++ mental — nu este un judge real, dar funcționează bine pentru probleme simple
- Pentru un judge real, conectează un backend cu un sandbox (ex. Judge0)
- Toate problemele sunt stocate local, nu se trimit pe niciun server extern (în afară de Gemini API)
