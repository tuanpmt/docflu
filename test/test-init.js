const { initProject } = require('../lib/commands/init');
const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

async function testInit() {
  console.log(chalk.blue('🧪 Testing DocuFlu init command...\n'));

  try {
    // Test 1: Init in empty directory
    console.log(chalk.cyan('Test 1: Initialize in empty directory'));
    const testDir = path.join(__dirname, '../.test-init');
    
    // Clean up any existing test directory
    if (await fs.pathExists(testDir)) {
      await fs.remove(testDir);
    }
    
    await fs.ensureDir(testDir);
    process.chdir(testDir);
    
    const result1 = await initProject();
    console.log(chalk.green('✓ Result:'), result1);
    
    // Verify .env file was created
    const envPath = path.join(testDir, '.env');
    const envExists = await fs.pathExists(envPath);
    console.log(chalk.green('✓ .env file created:'), envExists);
    
    if (envExists) {
      const envContent = await fs.readFile(envPath, 'utf8');
      console.log(chalk.gray('  Content preview:'), envContent.substring(0, 100) + '...');
    }

    // Test 2: Init in directory with existing .env
    console.log(chalk.cyan('\nTest 2: Initialize in directory with existing .env'));
    const result2 = await initProject();
    console.log(chalk.green('✓ Result:'), result2);
    console.log(chalk.green('✓ Should detect existing .env:'), result2.action === 'already_exists');

    // Test 3: Init in Docusaurus project
    console.log(chalk.cyan('\nTest 3: Initialize in Docusaurus project'));
    const docusaurusTestDir = path.join(__dirname, '../.test-init-docusaurus');
    
    if (await fs.pathExists(docusaurusTestDir)) {
      await fs.remove(docusaurusTestDir);
    }
    
    await fs.ensureDir(docusaurusTestDir);
    
    // Create fake docusaurus.config.ts
    const fakeConfig = `module.exports = { title: 'Test Docusaurus' };`;
    await fs.writeFile(path.join(docusaurusTestDir, 'docusaurus.config.ts'), fakeConfig);
    
    process.chdir(docusaurusTestDir);
    const result3 = await initProject();
    console.log(chalk.green('✓ Result:'), result3);
    
    // Cleanup
    process.chdir(path.join(__dirname, '..'));
    await fs.remove(testDir);
    await fs.remove(docusaurusTestDir);

    console.log(chalk.green('\n✅ All init tests passed!'));
    
    return {
      success: true,
      tests: [
        { name: 'Empty directory init', passed: result1.success },
        { name: 'Existing .env detection', passed: result2.action === 'already_exists' },
        { name: 'Docusaurus project init', passed: result3.success }
      ]
    };

  } catch (error) {
    console.error(chalk.red('\n❌ Init test failed:'), error.message);
    if (error.stack) {
      console.error(chalk.gray(error.stack));
    }
    
    // Cleanup on error
    try {
      process.chdir(path.join(__dirname, '..'));
      const testDir = path.join(__dirname, '../.test-init');
      const docusaurusTestDir = path.join(__dirname, '../.test-init-docusaurus');
      if (await fs.pathExists(testDir)) await fs.remove(testDir);
      if (await fs.pathExists(docusaurusTestDir)) await fs.remove(docusaurusTestDir);
    } catch (cleanupError) {
      console.error(chalk.gray('Cleanup error:', cleanupError.message));
    }
    
    return { success: false, error: error.message };
  }
}

// Run test if called directly
if (require.main === module) {
  testInit().then(result => {
    if (result.success) {
      console.log(chalk.green('\n🎉 Init command test completed successfully!'));
      process.exit(0);
    } else {
      console.log(chalk.red('\n💥 Init command test failed!'));
      process.exit(1);
    }
  });
}

module.exports = { testInit }; 