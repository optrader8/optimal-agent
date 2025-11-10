/**
 * Setup Wizard
 * Interactive first-time setup for Optimal Agent
 */

import readline from 'readline';
import chalk from 'chalk';
import { ConfigManager, ModelConfig } from './ConfigManager.js';
import { SystemChecker } from './SystemChecker.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class SetupWizard {
  private configManager: ConfigManager;
  private systemChecker: SystemChecker;
  private rl: readline.Interface;

  constructor(configManager: ConfigManager, systemChecker: SystemChecker) {
    this.configManager = configManager;
    this.systemChecker = systemChecker;
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  /**
   * Run the setup wizard
   */
  async run(): Promise<void> {
    console.log(chalk.bold.cyan('\n🚀 Optimal Agent Setup Wizard\n'));
    console.log(chalk.gray('This wizard will help you configure Optimal Agent for first use.\n'));

    try {
      // Step 1: System requirements check
      await this.checkSystemRequirements();

      // Step 2: Model selection
      await this.selectModel();

      // Step 3: Tool configuration
      await this.configurePowerTools();

      // Step 4: Save configuration
      await this.saveConfiguration();

      console.log(chalk.green('\n✓ Setup complete!\n'));
      console.log(chalk.gray('You can now start using Optimal Agent with: npm start\n'));
      console.log(chalk.gray('To reconfigure, run: npm run setup\n'));
    } catch (error: any) {
      console.error(chalk.red(`\n❌ Setup failed: ${error.message}\n`));
      throw error;
    } finally {
      this.rl.close();
    }
  }

  /**
   * Step 1: Check system requirements
   */
  private async checkSystemRequirements(): Promise<void> {
    console.log(chalk.yellow('Step 1: Checking system requirements...\n'));

    const requirements = await this.systemChecker.checkSystemRequirements();
    console.log(this.systemChecker.formatReport(requirements));

    if (!requirements.canRun) {
      throw new Error('System requirements not met. Please resolve required issues.');
    }

    if (requirements.overallStatus === 'warning') {
      const proceed = await this.askYesNo(
        'Some optional checks failed. Do you want to continue?',
        true
      );
      if (!proceed) {
        throw new Error('Setup cancelled by user');
      }
    }
  }

  /**
   * Step 2: Select model
   */
  private async selectModel(): Promise<void> {
    console.log(chalk.yellow('\nStep 2: Model Configuration\n'));

    // Ask which provider to use
    console.log('Which model provider would you like to use?\n');
    console.log('1. Ollama (local, free, requires Ollama installation)');
    console.log('2. OpenAI-compatible API (remote, may require API key)\n');

    const providerChoice = await this.askChoice('Select provider', ['1', '2'], '1');

    if (providerChoice === '1') {
      await this.configureOllama();
    } else {
      await this.configureOpenAI();
    }
  }

  /**
   * Configure Ollama
   */
  private async configureOllama(): Promise<void> {
    console.log(chalk.cyan('\nConfiguring Ollama...\n'));

    // Check if Ollama is running
    let ollamaAvailable = false;
    try {
      await execAsync('ollama list', { timeout: 3000 });
      ollamaAvailable = true;
    } catch {
      console.log(chalk.yellow('⚠️  Ollama is not running or not installed.'));
      console.log(chalk.gray('Please install Ollama from: https://ollama.ai/download\n'));

      const proceed = await this.askYesNo('Continue anyway?', true);
      if (!proceed) {
        throw new Error('Ollama configuration cancelled');
      }
    }

    // Get available models if Ollama is running
    let availableModels: string[] = [];
    if (ollamaAvailable) {
      try {
        const { stdout } = await execAsync('ollama list');
        availableModels = stdout
          .split('\n')
          .slice(1) // Skip header
          .map(line => line.split(/\s+/)[0])
          .filter(name => name && name.trim());

        if (availableModels.length > 0) {
          console.log(chalk.green('✓ Found installed models:\n'));
          availableModels.forEach((model, idx) => {
            console.log(`  ${idx + 1}. ${model}`);
          });
          console.log();
        }
      } catch {}
    }

    // Ask which model to use
    let modelName: string;
    if (availableModels.length > 0) {
      const useInstalled = await this.askYesNo('Use one of the installed models?', true);

      if (useInstalled) {
        const modelIdx = await this.askChoice(
          'Select model',
          availableModels.map((_, i) => String(i + 1)),
          '1'
        );
        modelName = availableModels[parseInt(modelIdx) - 1];
      } else {
        modelName = await this.askInput('Enter model name', 'qwen2.5-coder:7b');
      }
    } else {
      console.log(chalk.gray('Recommended models:'));
      console.log(chalk.gray('  - qwen2.5-coder:7b (fast, good for coding)'));
      console.log(chalk.gray('  - deepseek-coder:6.7b (accurate, larger)'));
      console.log(chalk.gray('  - codellama:7b (versatile)\n'));

      modelName = await this.askInput('Enter model name', 'qwen2.5-coder:7b');
    }

    // Check if model needs to be pulled
    if (ollamaAvailable && !availableModels.includes(modelName)) {
      const pull = await this.askYesNo(`Model '${modelName}' is not installed. Pull it now?`, true);

      if (pull) {
        console.log(chalk.yellow(`\nPulling ${modelName}... This may take a while.\n`));
        try {
          await execAsync(`ollama pull ${modelName}`, { timeout: 600000 }); // 10 minute timeout
          console.log(chalk.green(`\n✓ Successfully pulled ${modelName}\n`));
        } catch (error: any) {
          console.log(chalk.red(`\n❌ Failed to pull model: ${error.message}\n`));
          console.log(chalk.gray(`You can pull it later with: ollama pull ${modelName}\n`));
        }
      }
    }

    // Save Ollama configuration
    const config = this.configManager.getConfig();
    const modelConfig: ModelConfig = {
      provider: 'ollama',
      modelName,
      baseUrl: 'http://localhost:11434',
      temperature: 0.7,
      maxTokens: 4096,
    };

    config.system.models['ollama-default'] = modelConfig;
    config.system.defaultModel = 'ollama-default';
  }

  /**
   * Configure OpenAI-compatible API
   */
  private async configureOpenAI(): Promise<void> {
    console.log(chalk.cyan('\nConfiguring OpenAI-compatible API...\n'));

    const baseUrl = await this.askInput(
      'API Base URL',
      'https://api.openai.com/v1'
    );

    const apiKey = await this.askInput(
      'API Key',
      '',
      true // password mode
    );

    const modelName = await this.askInput(
      'Model Name',
      'gpt-4'
    );

    // Save OpenAI configuration
    const config = this.configManager.getConfig();
    const modelConfig: ModelConfig = {
      provider: 'openai',
      modelName,
      baseUrl,
      apiKey,
      temperature: 0.7,
      maxTokens: 4096,
    };

    config.system.models['openai-default'] = modelConfig;
    config.system.defaultModel = 'openai-default';
  }

  /**
   * Step 3: Configure power tools
   */
  private async configurePowerTools(): Promise<void> {
    console.log(chalk.yellow('\nStep 3: Tool Configuration\n'));

    console.log('Would you like to disable any potentially dangerous tools?\n');
    console.log(chalk.gray('  - run_command: Execute shell commands'));
    console.log(chalk.gray('  - write_file: Write/overwrite files'));
    console.log(chalk.gray('  - edit_file: Modify existing files\n'));

    const disableRisky = await this.askYesNo(
      'Disable potentially dangerous tools?',
      false
    );

    if (disableRisky) {
      const config = this.configManager.getConfig();
      config.system.tools.run_command.enabled = false;
      config.system.tools.write_file.enabled = false;
      config.system.tools.edit_file.enabled = false;

      console.log(chalk.yellow('\n⚠️  Dangerous tools have been disabled.'));
      console.log(chalk.gray('You can re-enable them later in the configuration file.\n'));
    }

    // Ask about backup
    const enableBackup = await this.askYesNo(
      'Enable automatic file backups before modifications?',
      true
    );

    const config = this.configManager.getConfig();
    config.system.backup.enabled = enableBackup;
  }

  /**
   * Step 4: Save configuration
   */
  private async saveConfiguration(): Promise<void> {
    console.log(chalk.yellow('\nStep 4: Saving configuration...\n'));

    await this.configManager.saveConfig();

    console.log(chalk.green(`✓ Configuration saved to: ${this.configManager.getConfigPath()}\n`));
  }

  /**
   * Ask a yes/no question
   */
  private async askYesNo(question: string, defaultYes: boolean = true): Promise<boolean> {
    const defaultStr = defaultYes ? 'Y/n' : 'y/N';
    const answer = await this.askInput(`${question} (${defaultStr})`, '');

    if (!answer) {
      return defaultYes;
    }

    return answer.toLowerCase().startsWith('y');
  }

  /**
   * Ask for input
   */
  private async askInput(question: string, defaultValue: string = '', password: boolean = false): Promise<string> {
    return new Promise((resolve) => {
      const defaultHint = defaultValue ? ` [${password ? '***' : defaultValue}]` : '';
      const prompt = `${question}${defaultHint}: `;

      if (password) {
        // Hide password input
        process.stdout.write(prompt);
        process.stdin.setRawMode(true);
        let input = '';

        const onData = (char: Buffer) => {
          const byte = char.toString();

          if (byte === '\n' || byte === '\r' || byte === '\u0004') {
            process.stdin.setRawMode(false);
            process.stdin.removeListener('data', onData);
            process.stdout.write('\n');
            resolve(input || defaultValue);
          } else if (byte === '\u0003') {
            // Ctrl+C
            process.exit(0);
          } else if (byte === '\u007f') {
            // Backspace
            if (input.length > 0) {
              input = input.slice(0, -1);
              process.stdout.write('\b \b');
            }
          } else {
            input += byte;
            process.stdout.write('*');
          }
        };

        process.stdin.on('data', onData);
      } else {
        this.rl.question(prompt, (answer) => {
          resolve(answer.trim() || defaultValue);
        });
      }
    });
  }

  /**
   * Ask for choice from options
   */
  private async askChoice(question: string, options: string[], defaultChoice: string): Promise<string> {
    let choice = await this.askInput(`${question} (${options.join('/')})`, defaultChoice);

    while (!options.includes(choice)) {
      console.log(chalk.red(`Invalid choice. Please select from: ${options.join(', ')}`));
      choice = await this.askInput(`${question} (${options.join('/')})`, defaultChoice);
    }

    return choice;
  }
}
