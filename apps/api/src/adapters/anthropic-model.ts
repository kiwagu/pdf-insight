import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { llmAnalysisSchema, llmOutputFormatSchema, type LlmAnalysis } from '@pdf-insight/contracts';
import {
  AnalysisTimeoutError,
  createDeadline,
  MODEL_CALL_TIMEOUT_MS,
  ModelOutputInvalidError,
  ModelUpstreamError,
  withinDeadline,
  type ChunkInput,
  type ModelCallOptions,
  type ModelPort,
  type ReduceInput,
} from '@pdf-insight/domain';
import { buildChunkMessages, buildReduceMessages, type MessageContentBlock } from './prompt.ts';

interface Options {
  apiKey: string;
  model: string;
  effort: 'low' | 'medium' | 'high';
}

// The loose schema shapes the model's structured output (the API accepts only a JSON Schema
// subset); the strict schema validates the answer afterwards.
const OUTPUT_FORMAT = zodOutputFormat(llmOutputFormatSchema);

export function createAnthropicModel(options: Options): ModelPort {
  // Retries and the time budget are owned by the domain: the SDK retries nothing, and each call
  // carries the timeout the domain hands it.
  const client = new Anthropic({
    apiKey: options.apiKey,
    maxRetries: 0,
    timeout: MODEL_CALL_TIMEOUT_MS,
  });

  async function complete(
    system: string,
    content: MessageContentBlock[],
    call: ModelCallOptions,
  ): Promise<LlmAnalysis> {
    let response: Anthropic.Message;
    // The SDK's own timeout stops at the response headers; this timer covers the whole call, body
    // included, and aborts the request when it fires.
    const controller = new AbortController();
    try {
      // `create`, not `parse`: `parse` throws a plain SDK error on a truncated or refused answer
      // before the stop reason can be read, so the answer is checked and parsed here instead.
      response = await withinDeadline(
        client.messages.create(
          {
            model: options.model,
            max_tokens: 16_000,
            system,
            messages: [{ role: 'user', content }],
            output_config: { format: OUTPUT_FORMAT, effort: options.effort },
          },
          { timeout: call.timeoutMs, signal: controller.signal },
        ),
        createDeadline(call.timeoutMs, Date.now),
        () => controller.abort(),
      );
    } catch (error) {
      // A timeout is a connection error too, so it is told apart first. Either timer may fire
      // first; both mean this call ran out of its time, so the domain may retry it.
      if (
        error instanceof AnalysisTimeoutError ||
        error instanceof Anthropic.APIConnectionTimeoutError
      ) {
        throw new AnalysisTimeoutError(`the model call timed out after ${call.timeoutMs} ms`, true);
      }
      if (error instanceof Anthropic.APIConnectionError) {
        throw new ModelUpstreamError(error.message, true);
      }
      if (error instanceof Anthropic.APIError) {
        const status = typeof error.status === 'number' ? error.status : 0;
        throw new ModelUpstreamError(error.message, status === 429 || status >= 500);
      }
      throw error;
    }
    if (response.stop_reason === 'refusal') {
      throw new ModelUpstreamError('The model declined this document.', false);
    }
    if (response.stop_reason === 'max_tokens') {
      throw new ModelOutputInvalidError('the answer was cut off at max_tokens');
    }
    const text = response.content.find((block) => block.type === 'text');
    if (!text) throw new ModelOutputInvalidError('the answer has no text block');
    let output: unknown;
    try {
      output = JSON.parse(text.text);
    } catch {
      throw new ModelOutputInvalidError('the answer is not valid JSON');
    }
    const strict = llmAnalysisSchema.safeParse(output);
    if (!strict.success) throw new ModelOutputInvalidError(strict.error.message);
    return strict.data;
  }

  return {
    analyzeChunk: (input: ChunkInput, call: ModelCallOptions) => {
      const { system, content } = buildChunkMessages(input);
      return complete(system, content, call);
    },
    reduce: (input: ReduceInput, call: ModelCallOptions) => {
      const { system, content } = buildReduceMessages(input);
      return complete(system, content, call);
    },
  };
}
