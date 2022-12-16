const path = require('path');
const fs = require('fs-extra');
const solc = require('solc');






let sources = {};


walk(sourceFolderPath);
console.log(sources)
const input = {
    language: 'Solidity',
    sources,
    settings: {
        outputSelection: {
            '*': {
                '*': ['*']
            }
        }
    }
}

console.log('\nCompiling contracts...');
const output = JSON.parse(solc.compile(JSON.stringify(input)));
console.log('Done');

let shouldBuild = true;

if (output.errors) {
    console.error(output.errors);
    // throw '\nError in compilation please check the contract\n';
    for (error of output.errors) {
        if (error.severity === 'error') {
            shouldBuild = false;
            throw 'Error found';
            break;
        }
    }
}

if (shouldBuild) {
    console.log('\nBuilding please wait...');

    fs.removeSync(buildFolderPath);
    fs.ensureDirSync(buildFolderPath);

    for (let contractFile in output.contracts) {
        for (let key in output.contracts[contractFile]) {
            fs.outputJsonSync(
                path.resolve(buildFolderPath, `${key}.json`),
                {
                    abi: output.contracts[contractFile][key]["abi"],
                    bytecode: output.contracts[contractFile][key]["evm"]["bytecode"]["object"]
                },
                {
                    spaces: 2,
                    EOL: "\n"
                }
            );
        }
    }
    console.log('Build finished successfully!\n');
} else {
    console.log('\nBuild failed\n');
}