import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import * as tar from "tar";
import * as YAML from "yaml";
import { updateSkills } from "../skills.js";

// =============================================================================
// Constants
// =============================================================================

const TEMPLATE_REPO = "bkper/bkper-app-template";
const TEMPLATE_BRANCH = "main";

// =============================================================================
// Validation
// =============================================================================

/**
 * Validates that the app name is a valid npm package name.
 * Rules: lowercase, no spaces, starts with letter, only alphanumeric and hyphens
 */
function validateAppName(name: string): { valid: boolean; error?: string } {
    if (!name || name.trim().length === 0) {
        return { valid: false, error: "App name cannot be empty" };
    }

    if (!/^[a-z]/.test(name)) {
        return { valid: false, error: "App name must start with a lowercase letter" };
    }

    if (!/^[a-z0-9-]+$/.test(name)) {
        return {
            valid: false,
            error: "App name can only contain lowercase letters, numbers, and hyphens",
        };
    }

    if (name.length > 214) {
        return { valid: false, error: "App name must be 214 characters or less" };
    }

    return { valid: true };
}

// =============================================================================
// Template Download
// =============================================================================

/**
 * Downloads and extracts the template tarball from GitHub.
 */
async function downloadTemplate(targetDir: string): Promise<void> {
    const tarballUrl = `https://github.com/${TEMPLATE_REPO}/archive/refs/heads/${TEMPLATE_BRANCH}.tar.gz`;

    const response = await fetch(tarballUrl, {
        headers: {
            "User-Agent": "bkper-cli",
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to download template: ${response.statusText}`);
    }

    // Create parent directory
    fs.mkdirSync(targetDir, { recursive: true });

    // Convert Web ReadableStream to Node.js Readable
    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error("Failed to get response body reader");
    }

    const nodeStream = new Readable({
        async read() {
            const { done, value } = await reader.read();
            if (done) {
                this.push(null);
            } else {
                this.push(Buffer.from(value));
            }
        },
    });

    // Extract tarball, stripping the first directory component
    await new Promise<void>((resolve, reject) => {
        nodeStream
            .pipe(
                tar.extract({
                    cwd: targetDir,
                    strip: 1, // Remove the "bkper-app-template-main" prefix
                })
            )
            .on("finish", resolve)
            .on("error", reject);
    });
}

// =============================================================================
// Project Configuration
// =============================================================================

/**
 * Updates the bkper.yaml file with the new app name.
 * Also handles bkperapp.yaml for backward compatibility.
 */
function updateBkperYaml(projectDir: string, appName: string): void {
    // Check for bkper.yaml first, then fall back to bkperapp.yaml
    let yamlPath = path.join(projectDir, "bkper.yaml");

    if (!fs.existsSync(yamlPath)) {
        yamlPath = path.join(projectDir, "bkperapp.yaml");
    }

    if (!fs.existsSync(yamlPath)) {
        throw new Error("bkper.yaml not found in template");
    }

    const content = fs.readFileSync(yamlPath, "utf8");
    const config = YAML.parse(content);

    // Update the id field
    config.id = appName;

    // Update the name field if it exists (make it more readable)
    if (config.name) {
        config.name = appName
            .split("-")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
    }

    fs.writeFileSync(yamlPath, YAML.stringify(config), "utf8");
}

/**
 * Updates the package.json file with the new app name.
 */
function updatePackageJson(projectDir: string, appName: string): void {
    const packagePath = path.join(projectDir, "package.json");

    if (!fs.existsSync(packagePath)) {
        throw new Error("package.json not found in template");
    }

    const content = fs.readFileSync(packagePath, "utf8");
    const pkg = JSON.parse(content);

    pkg.name = appName;

    fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
}

// =============================================================================
// Shell Commands
// =============================================================================

/**
 * Runs a shell command and returns a promise.
 */
function runCommand(command: string, args: string[], cwd: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const proc = spawn(command, args, {
            cwd,
            stdio: "inherit",
            shell: true,
        });

        proc.on("close", (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(
                    new Error(`Command '${command} ${args.join(" ")}' failed with code ${code}`)
                );
            }
        });

        proc.on("error", reject);
    });
}


// =============================================================================
// Public API
// =============================================================================

/**
 * Initializes a new Bkper app from the template.
 *
 * @param name - The name of the new app (used as directory name and app id)
 */
export async function initApp(name: string): Promise<void> {
    // 1. Validate app name
    const validation = validateAppName(name);
    if (!validation.valid) {
        console.error(`Error: ${validation.error}`);
        process.exit(1);
    }

    // 2. Check if directory already exists
    const targetDir = path.resolve(process.cwd(), name);
    if (fs.existsSync(targetDir)) {
        console.error(
            `Error: Directory '${name}' already exists. Choose a different name or remove it first.`
        );
        process.exit(1);
    }

    console.log(`\nCreating Bkper app '${name}'...\n`);

    // 3. Download template
    try {
        await downloadTemplate(targetDir);
        console.log("  Downloaded template");
    } catch (err) {
        console.error("Error downloading template:", err instanceof Error ? err.message : err);
        // Clean up on failure
        if (fs.existsSync(targetDir)) {
            fs.rmSync(targetDir, { recursive: true });
        }
        process.exit(1);
    }

    // 4. Update bkper.yaml
    try {
        updateBkperYaml(targetDir, name);
        console.log("  Updated bkper.yaml");
    } catch (err) {
        console.error("Error updating bkper.yaml:", err instanceof Error ? err.message : err);
        process.exit(1);
    }

    // 5. Update package.json
    try {
        updatePackageJson(targetDir, name);
        console.log("  Updated package.json");
    } catch (err) {
        console.error("Error updating package.json:", err instanceof Error ? err.message : err);
        process.exit(1);
    }

    // 6. Sync global skills
    try {
        const result = await updateSkills();
        if (result.updated.length > 0) {
            console.log(`  Synced skills (${result.updated.join(", ")})`);
        } else if (result.skipped && result.commit) {
            console.log(`  Skills up to date (${result.commit.substring(0, 7)})`);
        }
    } catch (err) {
        // Skills sync is non-fatal, just warn
        console.log("  Warning: Could not sync skills:", err instanceof Error ? err.message : err);
    }

    // 7. Install dependencies
    console.log("  Installing dependencies...");
    try {
        await runCommand("bun", ["install"], targetDir);
        console.log("  Installed dependencies");
    } catch (err) {
        console.log('  Warning: Could not install dependencies. Run "bun install" manually.');
    }

    // 8. Print success message
    console.log(`
Done! To get started:

  cd ${name}
  bun run dev
`);
}
