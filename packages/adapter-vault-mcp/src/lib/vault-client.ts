import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from '@modelcontextprotocol/sdk/client/stdio.js';
import type { z } from 'zod';
import {
  DueForReviewResult,
  FilingResult,
  ListNotesResult,
  ReadNoteResult,
  RecordSessionResult,
  SearchResult,
  Tier2Payload,
  VaultGraphResult,
  type BucketFilter,
  type ParaBucket,
  type Tier,
  type Verdict,
} from './schemas.js';

export interface VaultClientOptions {
  serverBin: string;
  vault?: string;
  node?: string;
}

export class VaultToolError extends Error {
  constructor(
    readonly tool: string,
    message: string,
  ) {
    super(`${tool}: ${message}`);
    this.name = 'VaultToolError';
  }
}

export class VaultContractError extends Error {
  constructor(
    readonly tool: string,
    message: string,
  ) {
    super(`${tool}: unexpected response from the vault server: ${message}`);
    this.name = 'VaultContractError';
  }
}

export type SessionItemInput = (
  { note: string; coach_id?: never } | { coach_id: string; note?: never }
) & {
  challenge: string;
  answer: string;
  verdict: Verdict;
  gaps?: string[];
  next_review: string;
};

export interface RecordSessionInput {
  tier: Tier;
  date?: string;
  items: SessionItemInput[];
  execute?: boolean;
}

export function vaultOptionsFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): VaultClientOptions {
  const serverBin = env['DOCS_MCP_BIN'];
  if (!serverBin) {
    throw new Error(
      'DOCS_MCP_BIN is not set: point it at kb-template/packages/cli/bin/docs-mcp.js',
    );
  }
  return { serverBin, vault: env['DOCS_MCP_VAULT'] || undefined };
}

export class VaultClient {
  private constructor(
    private readonly client: Client,
    private readonly stderr: () => string,
  ) {}

  static async connect(options: VaultClientOptions): Promise<VaultClient> {
    const args = [options.serverBin, 'serve'];
    if (options.vault) args.push('--vault', options.vault);

    const env = getDefaultEnvironment();
    const fallbackVault = process.env['DOCS_MCP_VAULT'];
    if (fallbackVault) env['DOCS_MCP_VAULT'] = fallbackVault;

    const transport = new StdioClientTransport({
      command: options.node ?? process.execPath,
      args,
      env,
      stderr: 'pipe',
    });
    let stderr = '';
    transport.stderr?.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-4000);
    });

    const client = new Client({ name: 'ai-coach', version: '0.0.1' });
    try {
      await client.connect(transport);
    } catch (err) {
      await transport.close().catch(() => undefined);
      const detail = stderr.trim() ? `\n${stderr.trim()}` : '';
      throw new Error(
        `Could not start the vault server: ${(err as Error).message}${detail}`,
        { cause: err },
      );
    }
    return new VaultClient(client, () => stderr);
  }

  async close(): Promise<void> {
    await this.client.close();
  }

  serverLog(): string {
    return this.stderr();
  }

  listNotes(
    args: { bucket?: BucketFilter; container?: string } = {},
  ): Promise<ListNotesResult> {
    return this.call('list_notes', args, ListNotesResult);
  }

  readNote(path: string): Promise<ReadNoteResult> {
    return this.call('read_note', { path }, ReadNoteResult);
  }

  search(args: {
    query: string;
    bucket?: ParaBucket;
    limit?: number;
  }): Promise<SearchResult> {
    return this.call('search', args, SearchResult);
  }

  vaultGraph(args: { bucket?: ParaBucket } = {}): Promise<VaultGraphResult> {
    return this.call('vault_graph', args, VaultGraphResult);
  }

  dueForReview(args: { today?: string } = {}): Promise<DueForReviewResult> {
    return this.call('due_for_review', args, DueForReviewResult);
  }

  tier2Payload(sessionId: string): Promise<Tier2Payload> {
    return this.call('tier2_payload', { session_id: sessionId }, Tier2Payload);
  }

  recordSession(input: RecordSessionInput): Promise<RecordSessionResult> {
    return this.call('record_session', input, RecordSessionResult);
  }

  initVault(args: { execute?: boolean } = {}): Promise<FilingResult> {
    return this.call('init_vault', args, FilingResult);
  }

  capture(args: {
    title: string;
    body: string;
    execute?: boolean;
  }): Promise<FilingResult> {
    return this.call('capture', args, FilingResult);
  }

  fileNote(args: {
    path: string;
    to: string;
    execute?: boolean;
  }): Promise<FilingResult> {
    return this.call('file_note', args, FilingResult);
  }

  archiveProject(args: {
    project: string;
    execute?: boolean;
  }): Promise<FilingResult> {
    return this.call('archive_project', args, FilingResult);
  }

  private async call<T>(
    tool: string,
    args: object,
    schema: z.ZodType<T>,
  ): Promise<T> {
    const result = await this.client.callTool({
      name: tool,
      arguments: args as Record<string, unknown>,
    });
    const content = result.content as { type: string; text?: string }[];
    const text = content.find((c) => c.type === 'text')?.text;
    if (result.isError) {
      throw new VaultToolError(tool, text ?? 'failed without a message');
    }
    if (text === undefined)
      throw new VaultContractError(tool, 'no text content');

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new VaultContractError(tool, `not JSON: ${text.slice(0, 200)}`);
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new VaultContractError(tool, parsed.error.message);
    }
    return parsed.data;
  }
}
