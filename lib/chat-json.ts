/**
 * Some OpenAI-compatible providers answer a non-streaming request with an SSE
 * body (`text/event-stream`, `data: {...}` lines, `data: [DONE]`) — seen on
 * ai.ekasir.id when max_tokens is too small for a reasoning model. This turns
 * either shape into the plain completion object the rest of the app expects.
 */

type Completion = {
  choices?: { message?: { content?: string; reasoning?: string } }[];
};

export function parseCompletion(raw: string): Completion {
  const text = raw.trim();
  if (!text) throw new Error("Respons API kosong.");

  if (!/^data:/m.test(text)) return JSON.parse(text) as Completion;

  // SSE: the whole body may be one line, or several chunks
  let merged: Completion | null = null;
  let content = "";
  for (const line of text.split(/\r?\n/)) {
    const payload = line.startsWith("data:") ? line.slice(5).trim() : line.trim();
    if (!payload || payload === "[DONE]") continue;
    let chunk: {
      choices?: {
        delta?: { content?: string };
        message?: { content?: string; reasoning?: string };
      }[];
    };
    try {
      chunk = JSON.parse(payload);
    } catch {
      continue;
    }
    const choice = chunk.choices?.[0];
    if (!choice) continue;
    content += choice.delta?.content ?? choice.message?.content ?? "";
    merged = {
      choices: [{ message: { content: undefined, reasoning: choice.message?.reasoning } }],
    };
  }
  if (!merged || !content) throw new Error("Respons SSE tanpa isi.");
  merged.choices = [{ message: { content, reasoning: merged.choices?.[0]?.message?.reasoning } }];
  return merged;
}
