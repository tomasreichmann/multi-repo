# multi-repo
A CLI tool to run same commands at multiple GIT repos

## installation

    npm install multi-repo -g

or

    yarn global add multi-repo

## setup

First create a config file where you store information about your repos

    multi-repo --init

You'll be asked about:

* repository label e.g. "My repository"
* absolute path to the repository e.g. "/Users/myuser/workspace/myrepository"
* source branch that is sometimes used to branch from e.g. "master"

Alternatively, you can add each repository from it's folder

    multi-repo --add

## usage

There's a couple of ready made scripts that you can use.

### batch

The default one is _batch_. You can select repositories from your config and add commands that should be executed in every repository.

    multi-repo

or

    multi-repo --batch

### git-status

git-status will display ```git status``` for current branch of each of the selected repos.

    npm start -- --git-status

### make-branch

make-branch will create a branch in selected repositories. It will branch it from source branch for each repo.

    npm start -- --make-branch branch_name
