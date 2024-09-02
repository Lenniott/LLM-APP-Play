import { OllamaEmbeddings } from "@langchain/ollama";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { supabase } from "$lib/supabaseClient";

const ollamaEmbeddings = new OllamaEmbeddings({
  model: "nomic-embed-text",
  baseUrl: "http://localhost:11434", // default Ollama URL
});

const vectorStore = new SupabaseVectorStore(ollamaEmbeddings, {
  client: supabase,
  tableName: "documents",
  queryName: "match_documents",
});

const retriever = vectorStore.asRetriever({ k: 4 });

export default retriever;