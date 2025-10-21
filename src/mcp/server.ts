#!/usr/bin/env node

import dotenv from 'dotenv';
dotenv.config();

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  CallToolResult,
  ErrorCode,
  ListToolsRequestSchema,
  ListToolsResult,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { handleGetBook, getBookToolDefinition } from './tools/get_book.js';
import { handleGetBalances, getBalancesToolDefinition } from './tools/get_balances.js';
import { handleListTransactions, listTransactionsToolDefinition } from './tools/list_transactions.js';
import { handleListBooks, listBooksToolDefinition } from './tools/list_books.js';
import { handleCreateTransactions, createTransactionsToolDefinition } from './tools/create_transactions.js';
import { handleMergeTransactions, mergeTransactionsToolDefinition } from './tools/merge_transactions.js';


class BkperMcpServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'bkper-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          listBooksToolDefinition,
          getBookToolDefinition,
          getBalancesToolDefinition,
          listTransactionsToolDefinition,
          createTransactionsToolDefinition,
          mergeTransactionsToolDefinition,
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const toolArgs = request.params.arguments;

      let result: CallToolResult;

      try {
        switch (toolName) {
          case 'list_books':
            result = await handleListBooks(toolArgs as any);
            break;
          case 'get_book':
            result = await handleGetBook(toolArgs as any);
            break;
          case 'get_balances':
            result = await handleGetBalances(toolArgs as any);
            break;
          case 'list_transactions':
            result = await handleListTransactions(toolArgs as any);
            break;
          case 'create_transactions':
            result = await handleCreateTransactions(toolArgs as any);
            break;
          case 'merge_transactions':
            result = await handleMergeTransactions(toolArgs as any);
            break;
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${toolName}`
            );
        }

        return result;

      } catch (error) {
        // Only log actual errors, not debug info
        if (!(error instanceof McpError)) {
          // Convert unexpected errors to MCP errors
          throw new McpError(
            ErrorCode.InternalError,
            `Tool ${toolName} failed: ${error instanceof Error ? error.message : String(error)}`
          );
        }
        throw error;
      }
    });
  }


  private setupErrorHandling() {
    this.server.onerror = (error) => {
      // Log critical server errors to a file or syslog in production
      // Avoid console output during MCP stdio mode as it contaminates the stream
      if (process.env.NODE_ENV !== 'production') {
        // In development, log to stderr only if not in MCP mode
        const isStdioMode = process.argv.includes('mcp') && process.argv.includes('start');
        if (!isStdioMode) {
          console.error('[MCP Server Error]:', error instanceof Error ? error.message : String(error));
        }
      }
      // TODO: In production, implement proper logging to file/syslog
      // Example: logger.error('MCP Server Error', { error: error.message, stack: error.stack });
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run() {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      // Server is now ready and listening on stdio
    } catch (error) {
      // Do not log startup errors as they contaminate stdio stream
      throw error;
    }
  }

  // Test helper methods for accessing MCP handlers directly
  async testListTools(): Promise<ListToolsResult> {
    // Call the list tools handler directly for testing
    const requestHandlers = (this.server as any)._requestHandlers;
    const handler = requestHandlers.get('tools/list');
    if (!handler) throw new Error('ListTools handler not found');
    
    // Create proper MCP request format
    const request = {
      method: 'tools/list' as const,
      params: {}
    };
    return await handler(request);
  }

  async testCallTool(name: string, args: Record<string, unknown> = {}): Promise<CallToolResult> {
    // Call the call tool handler directly for testing  
    const requestHandlers = (this.server as any)._requestHandlers;
    const handler = requestHandlers.get('tools/call');
    if (!handler) throw new Error('CallTool handler not found');
    
    // Create proper MCP request format
    const request = {
      method: 'tools/call' as const,
      params: { name, arguments: args }
    };
    return await handler(request);
  }

}

// Export the class for testing
export { BkperMcpServer };

// Only run the server if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new BkperMcpServer();
  server.run().catch(() => {
    // Exit silently on error to avoid contaminating stdio stream
    process.exit(1);
  });
}