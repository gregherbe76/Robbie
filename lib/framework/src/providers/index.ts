/**
 * Provider abstraction.
 *
 * The framework is provider-agnostic. Every model call goes through a
 * `LLMProvider` interface so OpenAI, Anthropic, or any future model vendor
 * can be swapped without touching agent/skill code.
 */

import type { Provenance } from "../shared/index.js";

export type ProviderKind = "openai" | "anthropic" | "custom";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
}

export interface CompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /**
   * Optional JSON schema describing the expected response shape.
   * Providers that support structured output should enforce it; others
   * fall back to best-effort JSON parsing.
   */
  responseSchema?: unknown;
}

export interface CompletionResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  raw?: unknown;
}

export interface LLMProvider {
  readonly id: string;
  readonly kind: ProviderKind;
  readonly models: readonly string[];
  isConfigured(): boolean;
  complete(req: CompletionRequest): Promise<CompletionResponse>;
}

export interface ProviderInvocationLog {
  providerId: string;
  model: string;
  request: CompletionRequest;
  response?: CompletionResponse;
  error?: string;
  startedAt: string;
  finishedAt: string;
  provenance: Provenance;
}

/**
 * Provider registry. Agents resolve providers by id at orchestration time so
 * routing decisions stay declarative and observable.
 */
export class ProviderRegistry {
  private readonly providers = new Map<string, LLMProvider>();

  register(provider: LLMProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: string): LLMProvider | undefined {
    return this.providers.get(id);
  }

  list(): LLMProvider[] {
    return Array.from(this.providers.values());
  }
}

export const globalProviderRegistry = new ProviderRegistry();
