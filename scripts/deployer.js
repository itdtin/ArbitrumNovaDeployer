const path = require('path');
const {dirname} = require('path');
const fs = require('fs-extra');
const solc = require('solc');
const config = require("../config");
const {getFileNameFromPath, cleanDir} = require("./utils");
const {ethers} = require("ethers");

const buildFolderPath = path.resolve(dirname(require.main.filename), 'newContracts');
const sourceDir = path.resolve(dirname(require.main.filename), 'contracts');


class Deployer {

    constructor() {
        fs.removeSync(buildFolderPath);
        fs.ensureDirSync(buildFolderPath);
    }

    async balance(wallet, provider) {
        return await provider.getBalance(wallet)
    }

    getContractSource(contractFileName) {
        const contractPath = path.resolve(sourceDir, contractFileName);
        return fs.readFileSync(contractPath, 'utf8');
    }

    getSources() {
        let getContractSource = function (contractFileName) {
            const contractPath = path.resolve(sourceDir, contractFileName);
            return fs.readFileSync(contractPath, 'utf8');
        }

        let sources = {}
        let results = [];

        const list = fs.readdirSync(sourceDir);
        list.forEach(function (file) {
            file = path.resolve(sourceDir, file);
            const stat = fs.statSync(file);
            if (stat && stat.isDirectory()) {
                results = results.concat(walk(file));
            } else {
                if (file.substr(file.length - 4, file.length) === ".sol") {
                    const content = getContractSource(file)
                    sources = {
                        ...sources,
                        [file]: {
                            content: content
                        }
                    };
                }
                results.push(file);
            }
        });
        return sources;
    };

    saveSource(content, filePath) {
        const dirName = path.dirname(filePath)
        if (!fs.existsSync(dirName)) {
            fs.mkdirSync(dirName);
        }
        fs.writeFileSync(filePath, content)
        console.log(`Saved to > ${filePath}`);
    }

    modifySource(content, walletAddress) {
        const startCodeContractIndex = content.indexOf("{") + 1
        return content.slice(0, startCodeContractIndex) +
            `\n    address public deployer = ${walletAddress};\n` +
            content.slice(startCodeContractIndex, content.length)
    }

    createNewContracts(amount, walletAddress) {
        const sources = this.getSources()
        let newSources = {}
        for (let i = 0; i < amount; i++) {
            const randomSourceKey = Object.keys(sources)[Math.floor(Math.random() * Object.keys(sources).length)]
            const newSource = this.modifySource(sources[randomSourceKey].content, walletAddress)
            const filePath = path.resolve(buildFolderPath, walletAddress, getFileNameFromPath(randomSourceKey))
            this.saveSource(newSource, filePath)
            newSources = {
                ...newSources,
                [filePath]: {
                    content: this.getContractSource(filePath)
                }
            };
        }
        return newSources
    }

    compile(sources) {
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
        if (output.errors) {
            console.error(output.errors);
            // throw '\nError in compilation please check the contract\n';
            for (const error of output.errors) {
                if (error.severity === 'error') {
                    throw 'Error found';
                    break;
                }
            }
        }
        console.log('Done');
        return output
    }

    build(compiled) {
        console.log('\nBuilding please wait...');
        let buildedPaths = [];
        for (let contractFile in compiled.contracts) {
            const walletAddr = contractFile.split(buildFolderPath)[1].split(getFileNameFromPath(contractFile))[0].replace(/\//g, "")
            for (let key in compiled.contracts[contractFile]) {
                const builtPath = path.resolve(buildFolderPath, walletAddr, `${key}.json`)
                buildedPaths.push(builtPath)
                fs.outputJsonSync(
                    builtPath,
                    {
                        abi: compiled.contracts[contractFile][key]["abi"],
                        bytecode: compiled.contracts[contractFile][key]["evm"]["bytecode"]["object"]
                    },
                    {
                        spaces: 2,
                        EOL: "\n"
                    }
                );
            }
        }
        console.log('Build finished successfully!\n');
        return buildedPaths
    }

    async deploy(buldsPaths, wallet) {
        const deployedContracts = []

        for(const buildPath of buldsPaths) {

            const contractBuildedObject = JSON.parse(fs.readFileSync(buildPath));
            console.log(`\nDeploying ${process.argv[2]} in ${config["network"]}...`);
            let contract = new ethers.ContractFactory(
                contractBuildedObject.abi,
                contractBuildedObject.bytecode,
                wallet
            );

            let instance = await contract.deploy();
            console.log(`deployed at ${instance.address}`)
            config[`${process.argv[2]}`] = instance.address
            console.log("Waiting for the contract to get mined...")
            await instance.deployed()
            console.log("Contract deployed")
            fs.outputJsonSync(
                'config.json',
                config,
                {
                    spaces: 2,
                    EOL: "\n"
                }
            );
            deployedContracts.push(instance)
        }
        return deployedContracts
    }
}

module.exports = {Deployer}