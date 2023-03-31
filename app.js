const ethers = require('ethers');
const config = require("./config");
const { loadWallets, sleep, getRandomFloat } = require("./scripts/utils");
const ethProvider = config.getProvider("mainnet");
const novaProvider = config.getProvider("");
const bridgeAbi = require('./abis/bridge.abi.json');
const contractAbi = require('./abis/MoneyBack.abi.json');
const { Deployer } = require("./scripts/deployer");


async function main() {
    const wallets = loadWallets();
    const deployer = new Deployer()

    console.log("Deploying contracts ....")
    for (const walletPk of wallets) {
        const wallet = new ethers.Wallet(walletPk, novaProvider);

        const newSources = deployer.createNewContracts(1, wallet.address)
        const compiled = deployer.compile(newSources)
        const buildsPaths = deployer.build(compiled)
        const deployedContracts = await deployer.deploy(buildsPaths, wallet)
        for (contract of deployedContracts) {
            const tx = {
                to: contract.address,
                value: ethers.utils.parseEther(getRandomFloat(config.AMOUNT_TO_SEND_MIN, config.AMOUNT_TO_SEND_MAX, 5).toString(), 'ether')
            };
            const transaction = await wallet.sendTransaction(tx);
            await (transaction.wait())
            await contract.functions.MoneyBack();
        }
    }


}


if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error(error)
            process.exit(1)
        })
}

