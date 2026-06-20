import fs from "fs";
import path from "path";

const ROOT = path.resolve("F:/NayeVault/naye-core");
const KNOWLEDGE_CONFIG_PATH = path.join(ROOT, "config", "knowledge.config.json");

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function normalizeText(text) {
  return String(text ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ñáéíóúü\s-]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  const stopwords = new Set([
    "el", "la", "los", "las", "un", "una", "unos", "unas",
    "de", "del", "a", "en", "y", "o", "que", "es", "son",
    "para", "por", "con", "sin", "como", "cual", "cuales",
    "que", "me", "mi", "tu", "su", "lo", "al", "se"
  ]);

  return normalizeText(text)
    .split(" ")
    .filter(token => token.length >= 3 && !stopwords.has(token));
}

function scoreDocument(queryTokens, document) {
  const haystack = normalizeText([
    document.title,
    document.relativePath,
    document.preview
  ].join(" "));

  let score = 0;

  for (const token of queryTokens) {
    if (haystack.includes(token)) {
      score += 1;
    }
  }

  if (haystack.includes("naye")) {
    score += 0.5;
  }

  return score;
}

function loadKnowledgeConfig() {
  if (!fs.existsSync(KNOWLEDGE_CONFIG_PATH)) {
    return {
      enabled: false,
      reason: "No existe config/knowledge.config.json"
    };
  }

  return readJson(KNOWLEDGE_CONFIG_PATH);
}

function loadKnowledgeIndex(config) {
  const indexFile = path.resolve(config.indexFile);

  if (!fs.existsSync(indexFile)) {
    return {
      exists: false,
      documents: [],
      path: indexFile
    };
  }

  const index = readJson(indexFile);

  return {
    exists: true,
    path: indexFile,
    documents: Array.isArray(index.documents) ? index.documents : [],
    indexedAt: index.indexedAt,
    documentCount: index.documentCount
  };
}

function retrieveKnowledgeContext({ input, maxDocuments = 3 }) {
  const config = loadKnowledgeConfig();

  if (!config.enabled) {
    return {
      enabled: false,
      used: false,
      message: "La memoria documental está deshabilitada.",
      contextText: "",
      sources: []
    };
  }

  const index = loadKnowledgeIndex(config);

  if (!index.exists) {
    return {
      enabled: true,
      used: false,
      message: "No existe índice de conocimiento. Ejecuta npm run index-knowledge.",
      contextText: "",
      sources: []
    };
  }

  const queryTokens = tokenize(input);

  if (queryTokens.length === 0) {
    return {
      enabled: true,
      used: false,
      message: "La consulta no contiene términos suficientes para recuperar conocimiento.",
      contextText: "",
      sources: []
    };
  }

  const ranked = index.documents
    .map(document => ({
      ...document,
      score: scoreDocument(queryTokens, document)
    }))
    .filter(document => document.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxDocuments);

  if (ranked.length === 0) {
    return {
      enabled: true,
      used: false,
      message: "No se encontraron documentos relevantes en la memoria aprobada.",
      contextText: "",
      sources: []
    };
  }

  const contextText = ranked.map((document, indexNumber) => {
    return [
      `Fuente ${indexNumber + 1}: ${document.title}`,
      `Ruta aprobada: ${document.relativePath}`,
      `Contenido relevante: ${document.preview}`
    ].join("\n");
  }).join("\n\n");

  return {
    enabled: true,
    used: true,
    message: "Conocimiento aprobado recuperado correctamente.",
    contextText,
    sources: ranked.map(document => ({
      id: document.id,
      title: document.title,
      relativePath: document.relativePath,
      score: document.score,
      modifiedAt: document.modifiedAt
    }))
  };
}

export { retrieveKnowledgeContext };
