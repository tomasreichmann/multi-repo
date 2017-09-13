#! /usr/bin/env node

require("babel-core/register");
require("babel-polyfill");
import {readFileSync} from 'fs';
import chalk from 'chalk';
import minimist from 'minimist';
import {CONFIG_PATH, initConfig, addRepo, batch, gitStatus, makeBranch} from './methods';


// --- Main ---

// margin below babel output
console.log('');

const argv = minimist(process.argv.slice(2));
const configPath = argv['config'] && argv['config'] !== true ? argv['config'] : CONFIG_PATH;
console.log('configPath', configPath);

let config;

try {
    config = JSON.parse(readFileSync(configPath, 'utf-8'));
} catch(error) {
    !argv.init && !argv.add && console.log(chalk.yellow('Config not available at ') + configPath + '\n' + chalk.red(error) + '\n');
}

console.log('argv', argv);
if ( argv.init ){
    initConfig(config, configPath);
} else if (argv['add']) {
    addRepo((argv['add'] === true ? undefined : argv['add']), config, configPath);
} else if (!config) {
    console.log(chalk.red('Config is missing. Please run "multi-repos --init" first\nor add repo configuration from within each repo folder with "multi-repos --add"\n'));
} else if (argv['make-branch']) {
    makeBranch((argv['make-branch'] === true ? undefined : argv['make-branch']), config);
} else if (argv['git-status']) {
    gitStatus(
        (argv['git-status'] === true ? undefined : argv['git-status'])
        , config);
} else {
    batch(config);
}
