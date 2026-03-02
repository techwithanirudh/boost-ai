import { generateText, type UIMessage } from "ai";
import { provider } from "@/lib/providers";

const titlePrompt = `Generate a short chat title (2-5 words) for the user's message.
Output only the title text. No prefixes or formatting.`;
const TITLE_PREFIX_PATTERN = /^[#*"\s]+/;
const TITLE_SUFFIX_PATTERN = /["]+$/;

function getTextFromMessage(message: UIMessage): string {
  for (const part of message.parts) {
    if (part.type !== "text") {
      continue;
    }
    const text = part.text.trim();
    if (text) {
      return text;
    }
  }
  return "New chat";
}

export async function generateTitleFromUserMessage(
  message: UIMessage
): Promise<string> {
  const { text } = await generateText({
    model: provider.languageModel("title-model"),
    system: titlePrompt,
    prompt: getTextFromMessage(message),
  });

  const cleaned = text
    .replace(TITLE_PREFIX_PATTERN, "")
    .replace(TITLE_SUFFIX_PATTERN, "")
    .trim();
  return cleaned || "New chat";
}
