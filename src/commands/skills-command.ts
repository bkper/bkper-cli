import type { Command } from 'commander';
import { withAction } from './action.js';
import { updateSkills, type UpdateSkillsResult } from './skills.js';

export interface SkillsCommandDependencies {
    updateSkills: () => Promise<UpdateSkillsResult>;
    log: (message: string) => void;
}

function createDefaultDependencies(): SkillsCommandDependencies {
    return {
        updateSkills: () => updateSkills(),
        log: message => console.log(message),
    };
}

export function registerSkillsCommands(
    program: Command,
    dependencies: SkillsCommandDependencies = createDefaultDependencies()
): void {
    const skillsCommand = program.command('skills').description('Manage Bkper skills');

    skillsCommand
        .command('sync')
        .description('Sync Bkper skills to ~/.agents/skills')
        .action(
            withAction(
                'syncing skills',
                async () => {
                    const result = await dependencies.updateSkills();

                    if (result.updated.length > 0) {
                        dependencies.log(`Synced skills (${result.updated.join(', ')})`);
                        return;
                    }

                    if (result.reason) {
                        dependencies.log(result.reason);
                        return;
                    }

                    dependencies.log('No skill updates found.');
                },
                { skipSetup: true }
            )
        );
}
