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

let config;

try {
    config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
} catch(error) {
    !argv.init && !argv.add && console.log(chalk.yellow('Config not available at ') + CONFIG_PATH + '\n' + chalk.red(error) + '\n');
}

// console.log('argv', argv);
if ( argv.init ){
    initConfig(config);
} else if (argv['add']) {
    addRepo((argv['add'] === true ? undefined : argv['add']), config);
} else if (!config) {
    console.log(chalk.red('Config is missing. Please run "multi-repos --init" first\nor add repo configuration from within each repo folder with "multi-repos --add"\n'));
} else if (argv['make-branch']) {
    makeBranch((argv['make-branch'] === true ? undefined : argv['make-branch']), config);
} else if (argv['git-status']) {
    gitStatus(
        (argv['git-status'] === true ? undefined : argv['git-status'])
        , config);
} else if (argv['batch'] || Object.keys(argv).length <= 1) {
    batch(config);
} else {
    console.log( chalk.red('Unknown parameters:\n' + Object.keys(argv).slice(1).join(', ') + '\n') );
}
