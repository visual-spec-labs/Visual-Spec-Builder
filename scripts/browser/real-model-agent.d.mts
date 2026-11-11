export interface AgentSpawnPlan {
  file: string;
  args: string[];
  options: { shell: false; windowsVerbatimArguments?: boolean };
}
export interface AgentRunDetails {
  step: string;
  stage: "spawn" | "exit" | "agent-result" | "nl-response" | "tickets";
  command?: string;
  exitCode: number | null;
  signal: string | null;
  stderrTail: string;
  stdoutTail?: string;
  seconds?: number;
  [key: string]: unknown;
}
export class AgentRunError extends Error {
  details: AgentRunDetails;
  constructor(message: string, details: AgentRunDetails);
}
export function agentArgv(agent: string, options?: { ws?: string; model?: string }): string[];
export function resolveWindowsCommand(command: string, env?: NodeJS.ProcessEnv): string | null;
export function quoteCmdShimArgument(arg: string): string;
export function agentSpawnPlan(command: string, argv: string[],
  options?: { platform?: NodeJS.Platform; env?: NodeJS.ProcessEnv }): AgentSpawnPlan;
export function runAgentProcess(plan: AgentSpawnPlan, options?: {
  cwd?: string; env?: NodeJS.ProcessEnv; input?: string; step?: string;
  onTick?: () => unknown; tickMs?: number;
}): Promise<{ step: string; command: string; exitCode: number | null; signal: string | null; stdout: string;
  stderr: string; stderrTail: string; stdoutTail: string; seconds: number; ticks: number }>;
export function summarizeAgentOutput(agent: string, stdout: string): { summary: Record<string, unknown>; failure: string | null };
export interface NlGuiState { kind: "success" | "error" | "confirmation" | "timeout"; text?: string }
export function nlFailure(input: { requestId: string; response: unknown; malformed?: boolean; gui: NlGuiState | null }): string | null;
export interface TicketRunState {
  running: boolean;
  runError: string | null;
  tickets: readonly { id: string; status: string; error?: string }[];
}
export function ticketRunFailure(input: { waves: readonly unknown[]; final: TicketRunState; limit: string | null }): string | null;
export function readNlGuiState(): NlGuiState | null;
