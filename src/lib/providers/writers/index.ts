import type { Writer } from "../types";
import type { WriterConfig } from "../config";
import { makeClaudeWriter } from "./claude";
import { makeOpenAIWriter } from "./openai";
import { templateWriter } from "./template";

/** Build the concrete Writer for a resolved config. */
export function getWriter(config: WriterConfig): Writer {
  switch (config.kind) {
    case "claude":
      return makeClaudeWriter(config);
    case "openai":
      return makeOpenAIWriter(config);
    default:
      return templateWriter;
  }
}

export { makeClaudeWriter, makeOpenAIWriter, templateWriter };
