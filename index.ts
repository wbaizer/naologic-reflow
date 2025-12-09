import { reflowFromFile } from './src/reflow/index.ts';

/**
 * Main entry point for the reflow CLI.
 *
 * Usage: bun run index.ts <path-to-jsonl-file>
 * Example: bun run index.ts ./example-data.jsonl
 */
async function main() {
    // Get file path from command line arguments
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.error('Error: No file path provided');
        console.error('Usage: bun run index.ts <path-to-jsonl-file>');
        console.error('Example: bun run index.ts ./example-data.jsonl');
        process.exit(1);
    }

    const filePath = args[0];

    try {
        console.log(`Starting reflow for file: ${filePath}\n`);
        await reflowFromFile(filePath || 'example-data.jsonl');
    } catch (error) {
        console.error('\nError during reflow:');
        if (error instanceof Error) {
            console.error(error.message);
            if (error.stack) {
                console.error('\nStack trace:');
                console.error(error.stack);
            }
        } else {
            console.error(error);
        }
        process.exit(1);
    }
}

main();
