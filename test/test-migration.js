const path = require('path');
const fs = require('fs-extra');
const chalk = require('chalk');
const { migrateState, needsMigration } = require('../lib/core/migrate-state');
const StateManager = require('../lib/core/state-manager');

async function testStateMigration() {
  console.log(chalk.cyan('🧪 Testing State Migration\n'));

  const testDir = path.join(__dirname, 'temp-migration-test');
  
  try {
    // Setup test environment
    await fs.ensureDir(testDir);
    
    console.log(chalk.blue('1. Setting up test environment'));
    
    // Create mock .docflu/ directory with state
    const oldStateDir = path.join(testDir, '.docflu');
    const oldStateFile = path.join(oldStateDir, 'sync-state.json');
    
    await fs.ensureDir(oldStateDir);
    
    const mockState = {
      version: '1.0.0',
      lastSync: '2025-01-27T10:30:00Z',
      pages: {
        'intro.md': {
          confluenceId: '12345',
          title: 'Introduction',
          lastModified: '2025-01-27T10:25:00Z'
        },
        'tutorial-basics/create-a-page.md': {
          confluenceId: '23456', 
          title: 'Create a Page',
          lastModified: '2025-01-27T10:20:00Z'
        }
      },
      stats: {
        totalPages: 2,
        created: 2,
        updated: 0,
        skipped: 0,
        failed: 0
      }
    };
    
    await fs.writeJson(oldStateFile, mockState, { spaces: 2 });
    console.log(chalk.green('✓ Created mock .docflu/sync-state.json'));
    
    // Create some additional files to test migration
    await fs.ensureDir(path.join(oldStateDir, 'cache'));
    await fs.writeFile(path.join(oldStateDir, 'cache', 'test.cache'), 'mock cache data');
    console.log(chalk.green('✓ Created mock cache files'));

    // Test 1: Check if migration is needed
    console.log(chalk.blue('\n2. Testing migration detection'));
    const migrationNeeded = await needsMigration(testDir);
    console.log(chalk.white('Migration needed:'), migrationNeeded ? 'Yes' : 'No');
    
    if (!migrationNeeded) {
      throw new Error('Migration should be needed but was not detected');
    }
    console.log(chalk.green('✓ Migration detection working'));

    // Test 2: Perform migration
    console.log(chalk.blue('\n3. Testing migration execution'));
    const migrationResult = await migrateState(testDir);
    console.log(chalk.white('Migration result:'), migrationResult ? 'Success' : 'Skipped');

    // Test 3: Verify migration results
    console.log(chalk.blue('\n4. Verifying migration results'));
    
    const newStateFile = path.join(testDir, '.docusaurus', 'sync-state.json');
    const backupDir = path.join(testDir, '.docflu.backup');
    
    // Check new state file exists
    if (!await fs.pathExists(newStateFile)) {
      throw new Error('New state file not created');
    }
    console.log(chalk.green('✓ New state file created'));
    
    // Check backup directory exists
    if (!await fs.pathExists(backupDir)) {
      throw new Error('Backup directory not created');
    }
    console.log(chalk.green('✓ Backup directory created'));
    
    // Check old directory is gone
    if (await fs.pathExists(oldStateDir)) {
      throw new Error('Old state directory still exists');
    }
    console.log(chalk.green('✓ Old state directory removed'));
    
    // Verify state content is preserved
    const newState = await fs.readJson(newStateFile);
    if (newState.pages['intro.md'].confluenceId !== '12345') {
      throw new Error('State content not preserved correctly');
    }
    console.log(chalk.green('✓ State content preserved'));
    
    // Check cache files migrated
    const newCacheFile = path.join(testDir, '.docusaurus', 'cache', 'test.cache');
    if (!await fs.pathExists(newCacheFile)) {
      throw new Error('Cache files not migrated');
    }
    console.log(chalk.green('✓ Cache files migrated'));

    // Test 4: Test StateManager integration
    console.log(chalk.blue('\n5. Testing StateManager integration'));
    const stateManager = new StateManager(testDir);
    await stateManager.init(); // Should not trigger migration again
    
    const pageState = stateManager.getPageState('intro.md');
    if (!pageState || pageState.confluenceId !== '12345') {
      throw new Error('StateManager not loading migrated state correctly');
    }
    console.log(chalk.green('✓ StateManager integration working'));

    // Test 5: Test no double migration
    console.log(chalk.blue('\n6. Testing no double migration'));
    const secondMigrationNeeded = await needsMigration(testDir);
    if (secondMigrationNeeded) {
      throw new Error('Migration should not be needed after first migration');
    }
    console.log(chalk.green('✓ No double migration'));

    console.log(chalk.green('\n🎉 All migration tests passed!'));
    
    // Show summary
    console.log(chalk.cyan('\n📊 Migration Test Summary:'));
    console.log(chalk.white('✓ Migration detection working'));
    console.log(chalk.white('✓ State files migrated correctly'));
    console.log(chalk.white('✓ Cache files preserved'));
    console.log(chalk.white('✓ Backup created safely'));
    console.log(chalk.white('✓ StateManager integration working'));
    console.log(chalk.white('✓ No double migration protection'));

  } catch (error) {
    console.error(chalk.red('\n❌ Migration test failed:'), error.message);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    // Cleanup test directory
    if (await fs.pathExists(testDir)) {
      await fs.remove(testDir);
      console.log(chalk.gray('\n🧹 Cleaned up test directory'));
    }
  }
}

// Run test if called directly
if (require.main === module) {
  testStateMigration();
}

module.exports = { testStateMigration }; 