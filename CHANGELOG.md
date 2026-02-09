# Changelog

## 2026

### **February 2026**

**CLI**

- Table-formatted output is now the default for all commands
- Added `--json` global flag to output raw JSON instead of formatted tables
- Added `-b, --book` required option for scoping commands to a book
- Added `-p, --properties` flag to `transaction list` to include custom properties
- Transaction tables show formatted dates and values with IDs
- Group tables render as indented trees showing hierarchy
- Single-item commands display as indented key-value pairs
- Removed MCP server (`mcp start` command)

## 2025

### **October 2025**

**MCP Server**

- Added smart transaction merging - combine multiple transactions intelligently based on date and account matching
- Simplified transaction creation - accounts are now optional, making it easier to record simple income and expenses
- Improved transaction data responses for better AI assistant integration

### **September 2025**

**MCP Server**

- Streamlined transaction data for cleaner AI assistant responses
- Fixed credential storage to follow standard configuration directories

### **July 2025**

**MCP Server**

- Added support for AI assistants to analyze your books with monthly and year-to-date balances
- Improved date filtering with more intuitive `before:` operator
- Added setup instructions for Claude Desktop and other AI tools

### **June 2025**

**bkper-node CLI**

- Introduced MCP server - connect AI assistants to your Bkper books with `bkper mcp start`
- Added book name filtering to quickly find specific books
