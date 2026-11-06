export interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
  digest?: string;
  details?: {
    format?: string;
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
  lastMetrics?: InferenceTelemetry | null;
}

export interface PromptTemplate {
  id: string;
  title: string;
  template: string;
  description: string;
}

export interface InferenceTelemetry {
  eval_count: number | null;
  eval_duration_ns: number | null;
  eval_duration_sec: number | null;
  tokens_per_second: number | null;
  load_duration_ms: number | null;
  prompt_eval_count: number | null;
  prompt_eval_duration_sec: number | null;
  timestamp: string;
}

export interface AppConfig {
  host: string;
  active_model: string;
  theme: 'dark' | 'light';
  timeout_seconds: number;
  max_context_tokens: number;
}

export type MenuState = 'main' | 'chat' | 'models' | 'models_pull' | 'prompts' | 'prompts_run' | 'prompts_add' | 'metrics' | 'theme';

export interface TerminalLogLine {
  id: string;
  text: string;
  type?: 'system' | 'user' | 'assistant' | 'header' | 'warning' | 'error' | 'success' | 'table' | 'metric';
  rawHtml?: boolean;
}
