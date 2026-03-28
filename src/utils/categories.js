export const PBINFO_CATEGORIES = [
  { id: "arrays",      name: "Tablouri / Arrays",       icon: "📊", description: "Operații pe tablouri 1D și 2D" },
  { id: "strings",     name: "Șiruri de Caractere",     icon: "🔤", description: "Prelucrare și manipulare șiruri" },
  { id: "sorting",     name: "Sortare",                 icon: "📋", description: "Algoritmi de sortare și căutare" },
  { id: "math",        name: "Matematică",              icon: "🔢", description: "Numere prime, divizori, CMMDC" },
  { id: "recursion",   name: "Recursivitate",           icon: "🔄", description: "Funcții recursive, backtracking" },
  { id: "stack_queue", name: "Stivă / Coadă",          icon: "📚", description: "Structuri stivă și coadă" },
  { id: "greedy",      name: "Greedy",                  icon: "💡", description: "Algoritmi greedy clasici" },
  { id: "dp",          name: "Programare Dinamică",     icon: "⚡", description: "Rucsac, subșir comun maxim etc." },
  { id: "graphs",      name: "Grafuri",                 icon: "🕸",  description: "BFS, DFS, componente conexe" },
  { id: "trees",       name: "Arbori",                  icon: "🌳", description: "Arbori binari, arbori cu rădăcină" },
  { id: "matrix",      name: "Matrice",                 icon: "🔲", description: "Parcurgere și operații pe matrice" },
  { id: "pointers",    name: "Pointeri",                icon: "👉", description: "Lucru cu pointeri, alocare dinamică" },
];

// Tipuri de probleme — ce fel de challenge primeste userul
export const PROBLEM_TYPES = [
  {
    id: "debug",
    label: "Debug",
    icon: "🐛",
    description: "Găsește și repară bug-urile din sursă",
    tag: "BUG HUNT",
    tagColor: "red",
  },
  {
    id: "complete",
    label: "Completează",
    icon: "✏️",
    description: "Completează părțile lipsă marcate cu // TODO",
    tag: "FILL IN",
    tagColor: "yellow",
  },
  {
    id: "rewrite_lib",
    label: "Reimplementează",
    icon: "📦",
    description: "Reimplementează funcții de librărie (cstring, cmath) cu pointeri",
    tag: "LIBRARY",
    tagColor: "purple",
  },
];
