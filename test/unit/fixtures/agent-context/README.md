Shared agent context fixture: the same domain, user and Book folders, and the same
expected merge, are tested in the managed agent (bkper-clients `packages/agent/test/fixtures/agent-context`) and in the Bkper CLI agent
(bkper-cli `test/unit/fixtures/agent-context`).
`expected.json`: the AGENTS.md order; which scope each skill loads from (Book over user over domain); each skill that loses a
name to the final winner, sorted by name, then loser.
Keep both copies identical.
