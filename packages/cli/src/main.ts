#!/usr/bin/env node
import { run } from './lib/cli.js';
import { ProcessTerminal } from './lib/terminal.js';

const term = new ProcessTerminal();
process.exitCode = await run(process.argv.slice(2), { term });
term.close();
