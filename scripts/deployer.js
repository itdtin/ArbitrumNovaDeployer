const path = require('path');
const {dirname} = require('path');
const fs = require('fs-extra');
const solc = require('solc');
const config = require("../config");
const {getFileNameFromPath} = require("./utils");

const buildFolderPath = path.resolve(dirname(require.main.filename), 'newContracts');
const sourceDir = path.resolve(dirname(require.main.filename), 'contracts');


class Deployer {

    constructor() {

    }

    async balance(wallet, provider) {
        return await provider.getBalance(wallet)
    }

    getSources() {
        const getContractSource = (contractFileName) => {
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
        if (!fs.existsSync(dirName)){
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
        for (let i = 0; i < amount; i++) {
            const randomSourceKey = Object.keys(sources)[Math.floor(Math.random()*Object.keys(sources).length)]
            const newSource = this.modifySource(sources[randomSourceKey].content, walletAddress)
            const filePath = path.resolve(buildFolderPath, walletAddress, getFileNameFromPath(randomSourceKey))
            this.saveSource(newSource, filePath)
        }
    }
}

module.exports = {Deployer}