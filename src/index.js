import {exec} from 'child_process';
import {readFileSync, writeFile} from 'fs';
import chalk from 'chalk';
import slug from 'slug';

require("babel-core/register");
require("babel-polyfill");
var inquirer = require('inquirer');

var argv = require('minimist')(process.argv.slice(2));

const CONFIG_FILENAME = '.batchcommiter';
const CONFIG_PATH = process.env.HOME + '/' + CONFIG_FILENAME;

let config = null;

try {
    config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
} catch(error) {
    console.log(chalk.bold.yellow('config read error') + CONFIG_PATH + '\n' + chalk.red(error));
}
// console.log(chalk.yellow('Current config:\n'), JSON.stringify(config, null, '  '), '\n');

function initConfig() {
    if ( config ) {
        inquirer.prompt([{
            name: 'overwrite',
            type: 'input',
            default: 'no',
            message: CONFIG_PATH + ' already exists. Do you wish to overwrite it?',
        }]).then(function (answers) {
            const {overwrite} = answers;
            if (overwrite === 'yes') {
                inquireConfig();
            } else {
                console.log(chalk.yellow('Init config aborted'));
            }
        });
    } else {
        inquireConfig();
    }
}

function inquireConfigRepo(repos = []) {
    return inquirer.prompt([{
        name: 'label',
        type: 'input',
        default: 'done',
        message: 'Next repo label? (or "done" if you are done adding repos)'
    }]).then( ({label}) => {
        if( label === 'done' ) {
            return repos;
        }
        return inquirer.prompt([{
            name: 'cwd',
            type: 'input',
            message: 'Repo path:'
        },
        {
            name: 'sourceBranch',
            type: 'input',
            message: 'Branch from:'
        }]).then( (answers) => {
            const key = slug(label);
            return inquireConfigRepo({...repos, [key]: {key, ...answers}});
        });
    } );
}

function inquireConfig() {
    inquireConfigRepo().then( (repos) => {
        const newConfig = {repos};
        writeFile(CONFIG_PATH, JSON.stringify(newConfig, null, '\t'), function(err) {
            if(err) {
                return console.log(chalk.red.bold(err));
            }
            console.log(chalk.green.bold('\nConfig saved as ' + CONFIG_PATH));
        });
    } );
}

function selectRepos(message = 'Select repos') {
    return inquirer.prompt([{
        name: 'repos',
        type: 'checkbox',
        choices: Object.keys(config.repos).map( key => ({ name: config.repos[key].label, value: key, checked: true })),
        message,
        validate: function (answer) {
            if (answer.length < 1) {
                return 'You must choose at least one repo.';
            }
            return true;
        }
    }]).then( ({repos}) => {
        const reposMap = repos.reduce( (map, key) => ( {
            ...map,
            [key]: config.repos[key]
        } ), {} );
        return reposMap;
    } )
}

function inquireKeepBranch(message = 'Keep created branch after execution?') {
    return inquirer.prompt([{
        name: 'keepBranch',
        type: 'list',
        choices: [{ name: 'yes', value: true }, { name: 'no', value: false }],
        default: 1,
        message
    }]).then( ({keepBranch}) => {
        return keepBranch;
    });
}

function inquireCustomCommand(multi = false, customCommands = []) {
    return inquirer.prompt([{
        name: 'command',
        type: 'input',
        default: 'done',
        message: 'Next command to run in branch? (or "done" if you are done with commands)'
    }]).then( ({command}) => {
        if( command === 'done' ) {
            return customCommands;
        }
        return inquirer.prompt([{
            name: 'ignoreFail',
            type: 'list',
            choices: [{ name: 'yes', value: true }, { name: 'no', value: false }],
            default: 1,
            message: 'Continue on command failure?'
        }]).then( ({ignoreFail}) => {
            const commandObject = {command, ignoreFail};
            if (multi) {
                return inquireCustomCommand(multi, [...customCommands, commandObject]);
            } else {
                return [...customCommands, commandObject];
            }
        });
    } );
}

function handleOutput(commandObject) {
    const {command, ignoreFail, cwd = '.', onDone = f => f} = commandObject;
    return new Promise( (resolve, reject) => {
        exec(command, {
            cwd
        }, (err, stdout) => {
            if (err && !ignoreFail) {
                reject(err);
                
            } else {
                onDone(stdout, commandObject);
                resolve(stdout);
            }
        })
    } );
}

async function* runNextCommand(commands){
    let commandQueue = [...commands];
    let nextCommand;
    while (nextCommand = commandQueue.shift()) {
        yield await handleOutput(nextCommand);
    }
}

async function runAllCommands(commands){
    let counter = 0;
    console.log(chalk.yellow('\nStarting batch of ' + commands.length + ' commands\n'));
    try {
        for await (let output of runNextCommand(commands) ) {
            continue;
        }
        console.log(chalk.green('batch done\n'));
    } catch(err) {
        console.error('err', chalk.red(err.toString()));
    }
}

const getAllReposCommands = (reposMap = config.repos, commands = []) => {
    return Object.keys(reposMap).reduce( (sequence, key) => {
        const repo = reposMap[key];
        const customCommands = commands.map( (command) => {
            return {
                cwd: repo.cwd,
                onDone: (stdout) => {
                    console.log(chalk.blue.underline(repo.label) + '\n\n' + stdout);
                },
                ...command
            }
        } );
        return [
            ...sequence,
            ...customCommands
        ];
        
    }, []);
}

const makeNewBranchOnAllReposCommands = (reposMap = config.repos, branchName = 'test', keepBranch = false, customCommands = []) => {
    return Object.keys(reposMap).reduce( (sequence, key) => {
        const repo = reposMap[key];
        const commands = [
            {
                command: 'git fetch upstream ' + repo.sourceBranch,
                onDone: (stdout, {command, cwd}) => {
                    console.log(repo.label.blue.underline + '\n\n');
                    console.log(chalk.gray('$ ' + cwd + ' ') + chalk.yellow(command));
                    console.log(stdout);
                }
            },
            {
                command: 'git checkout ' + repo.sourceBranch,
            },
            {
                command: 'git branch -D ' + branchName,
                ignoreFail: true,
            },
            {
                command: 'git checkout -b ' + branchName + ' --track upstream/' + repo.sourceBranch,
            },
            ...customCommands,
            ...(keepBranch ? [] : [
                {
                    command: 'git checkout ' + repo.sourceBranch,
                },
                {
                    command: 'git branch -D ' + branchName,
                },
            ])
        ].map( (commandObject) => {
            return {
                cwd: repo.cwd,
                onDone: (stdout, {command, cwd}) => {
                    console.log(chalk.gray('$ ' + cwd + ' ') + chalk.yellow(command));
                    console.log(stdout);
                },
                ...commandObject,
            }
        } )
        return [
            ...sequence,
            ...commands
        ];
    }, []);
}

// --- Methods ---
function makeBranch(argv) {
    const branchName = argv['make-branch'];
    if (argv['make-branch'] === true) {
        return console.log(chalk.red('missing branch name. E.g: batchcommitter --make-branch [branchName]'));
    }
    return selectRepos('Which repos, do you want to create a branch on?').then(function (reposMap) {
        console.log(chalk.blue('Creating branch name ' + branchName + ' in ' + Object.keys(reposMap).map( key => (reposMap[key].label) ).join(', ') ));
        return inquireKeepBranch().then( (keepBranch) => {
            return inquireCustomCommand(true).then( (customCommands) => {
                return runAllCommands(makeNewBranchOnAllReposCommands(reposMap, branchName, keepBranch, customCommands))
            } );
        });
    });
}

function gitStatus() {
    return selectRepos('Which repos, do you want to get status of?').then(function (reposMap) {
        console.log(chalk.blue('Git status of ' + Object.keys(reposMap).map( key => (reposMap[key].label) ).join(', ') ));
        return runAllCommands(getAllReposCommands(reposMap, [{ command: 'git status' }]));
    });
}

function batch() {
    return selectRepos('Which repos, do you want run commands on?').then(function (reposMap) {
        return inquireCustomCommand(true).then( (commands) => {
            console.log(chalk.blue('Running ' + commands.length + ' commands in ' + Object.keys(reposMap).map( key => (reposMap[key].label) ).join(', ') ));
            return runAllCommands(getAllReposCommands(reposMap, commands));
        } )
    });
}

// --- Main ---

if ( argv.init ){
    initConfig();
} else if (!config) {
    console.log(chalk.red('Config is missing. Please run "batchcommitter --init" first'));
} else if (argv['make-branch']) {
    makeBranch(argv['make-branch']);
} else if (argv['git-status']) {
    gitStatus(argv['git-status']);
} else if (argv['batch']) {
    batch();
} else {
    console.log( chalk.red('Unknown parameters:\n' + Object.keys(argv).slice(1).join(', ')) );
}
