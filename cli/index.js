#!/usr/bin/env node
const { program } = require('commander');
const chalk = require('chalk');
const path = require('path');
const { runWizard } = require('./wizard');
const { saveConfig, loadConfig, configExists } = require('../core/config');
const { generateSDK } = require('../sdk/generator');

program
  .name('skeletal')
  .description('skeletal-dock — universal backend configurator')
  .version('1.0.0');

// ── init ─────────────────────────────────────────────────────────────────────
program
  .command('init')
  .description('Run the full setup wizard')
  .action(async () => {
    const existing = configExists() ? loadConfig() : null;
    if (existing) {
      console.log(chalk.yellow('\n  Existing config found. Re-running wizard will update it.\n'));
    }

    try {
      const { config, genSDK } = await runWizard(existing);
      saveConfig(config);
      console.log(chalk.green('\n  skeletal.config.json saved.\n'));

      if (genSDK) {
        const sdkPath = generateSDK(config);
        console.log(chalk.green(`  Frontend SDK written to: ${sdkPath}\n`));
      }

      console.log(chalk.cyan('  Start your backend:'));
      console.log(chalk.white('    npm start\n'));
    } catch (err) {
      if (err.message?.includes('force closed')) {
        console.log(chalk.yellow('\n  Setup cancelled.'));
      } else {
        console.error(chalk.red('\n  Error:'), err.message);
      }
    }
  });

// ── status ───────────────────────────────────────────────────────────────────
program
  .command('status')
  .description('Show current configuration')
  .action(() => {
    if (!configExists()) {
      console.log(chalk.red('\n  No skeletal.config.json found. Run: npm run setup\n'));
      return;
    }
    const config = loadConfig();
    const f = config.features || {};

    console.log(chalk.cyan('\n  skeletal-dock status\n'));
    console.log(`  Project : ${chalk.white(config.project.name)}`);
    console.log(`  Port    : ${chalk.white(config.project.port)}`);
    console.log(`  MongoDB : ${chalk.white(config.database.uri)}`);
    console.log(`  CORS    : ${chalk.white((config.cors?.origins || []).join(', '))}\n`);

    const modules = [
      ['Auth (JWT)', f.auth?.enabled],
      ['OTP Email', f.otp?.enabled && f.otp?.email?.enabled],
      ['OTP SMS', f.otp?.enabled && f.otp?.sms?.enabled],
      ['Webhooks', f.webhooks?.enabled],
      ['Auto CRUD', f.crud?.enabled],
      ['WebSocket', config.websocket?.enabled]
    ];

    modules.forEach(([name, on]) => {
      const icon = on ? chalk.green('✓') : chalk.gray('✗');
      console.log(`  ${icon}  ${name}`);
    });

    if (f.crud?.enabled && f.crud.models?.length > 0) {
      console.log(chalk.cyan('\n  CRUD Models:'));
      f.crud.models.forEach(m => {
        const fields = Object.entries(m.fields || {}).map(([k, v]) => `${k}:${v}`).join(', ');
        console.log(`    ${chalk.white(m.name)} — ${fields} ${m.auth ? chalk.gray('[auth]') : ''}`);
      });
    }

    console.log();
  });

// ── add-model ────────────────────────────────────────────────────────────────
program
  .command('add-model')
  .description('Add a new CRUD model to the config')
  .action(async () => {
    if (!configExists()) {
      console.log(chalk.red('\n  Run npm run setup first.\n'));
      return;
    }
    const inquirer = require('inquirer');
    const config = loadConfig();

    const modelInfo = await inquirer.prompt([
      { name: 'name', message: 'Model name:', validate: v => /^[a-z]+$/i.test(v) ? true : 'Letters only' },
      { name: 'fields', message: 'Fields as JSON (e.g. {"title":"String","price":"Number"}):', validate: v => { try { JSON.parse(v); return true; } catch { return 'Invalid JSON'; } } },
      { type: 'confirm', name: 'auth', message: 'Require JWT auth?', default: true }
    ]);

    if (!config.features.crud) config.features.crud = { enabled: true, models: [] };
    if (!config.features.crud.models) config.features.crud.models = [];
    config.features.crud.models.push({ name: modelInfo.name.toLowerCase(), fields: JSON.parse(modelInfo.fields), auth: modelInfo.auth });
    config.features.crud.enabled = true;

    saveConfig(config);

    const { regen } = await inquirer.prompt([
      { type: 'confirm', name: 'regen', message: 'Regenerate frontend SDK?', default: true }
    ]);
    if (regen) {
      const sdkPath = generateSDK(config);
      console.log(chalk.green(`\n  SDK regenerated: ${sdkPath}`));
    }

    console.log(chalk.green(`\n  Model "${modelInfo.name}" added. Restart the server to apply.\n`));
  });

// ── regen-sdk ────────────────────────────────────────────────────────────────
program
  .command('regen-sdk')
  .description('Regenerate the frontend SDK from current config')
  .action(() => {
    if (!configExists()) {
      console.log(chalk.red('\n  Run npm run setup first.\n'));
      return;
    }
    const config = loadConfig();
    const sdkPath = generateSDK(config);
    console.log(chalk.green(`\n  SDK written to: ${sdkPath}\n`));
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
