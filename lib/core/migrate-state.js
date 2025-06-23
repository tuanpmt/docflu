const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

/**
 * Migrate state from .docuflu/ to .docusaurus/ directory
 * @param {string} projectRoot - Project root directory
 */
async function migrateState(projectRoot) {
  const oldStateDir = path.join(projectRoot, '.docuflu');
  const newStateDir = path.join(projectRoot, '.docusaurus');
  const oldStateFile = path.join(oldStateDir, 'sync-state.json');
  const newStateFile = path.join(newStateDir, 'sync-state.json');

  try {
    // Check if old state exists
    if (!await fs.pathExists(oldStateFile)) {
      console.log(chalk.blue('ℹ️ No .docuflu/sync-state.json found, no migration needed'));
      return false;
    }

    // Check if new state already exists
    if (await fs.pathExists(newStateFile)) {
      console.log(chalk.yellow('⚠️ .docusaurus/sync-state.json already exists, skipping migration'));
      return false;
    }

    console.log(chalk.cyan('🔄 Migrating state from .docuflu/ to .docusaurus/...'));

    // Ensure new directory exists
    await fs.ensureDir(newStateDir);

    // Copy state file
    await fs.copy(oldStateFile, newStateFile);
    console.log(chalk.green('✓ Copied sync-state.json'));

    // Copy other files if they exist
    const filesToMigrate = ['cache', 'logs'];
    
    for (const file of filesToMigrate) {
      const oldPath = path.join(oldStateDir, file);
      const newPath = path.join(newStateDir, file);
      
      if (await fs.pathExists(oldPath)) {
        await fs.copy(oldPath, newPath);
        console.log(chalk.green(`✓ Copied ${file}/`));
      }
    }

    // Create backup of old directory
    const backupDir = path.join(projectRoot, '.docuflu.backup');
    await fs.move(oldStateDir, backupDir);
    console.log(chalk.blue(`📦 Backed up old state to .docuflu.backup/`));

    console.log(chalk.green('🎉 Migration completed successfully!'));
    console.log(chalk.white('   State is now stored in .docusaurus/sync-state.json'));
    console.log(chalk.gray('   You can safely delete .docuflu.backup/ after verifying everything works'));

    return true;

  } catch (error) {
    console.error(chalk.red('❌ Migration failed:'), error.message);
    throw error;
  }
}

/**
 * Check if migration is needed
 * @param {string} projectRoot - Project root directory
 */
async function needsMigration(projectRoot) {
  const oldStateFile = path.join(projectRoot, '.docuflu', 'sync-state.json');
  const newStateFile = path.join(projectRoot, '.docusaurus', 'sync-state.json');
  
  return (await fs.pathExists(oldStateFile)) && !(await fs.pathExists(newStateFile));
}

module.exports = {
  migrateState,
  needsMigration
}; 