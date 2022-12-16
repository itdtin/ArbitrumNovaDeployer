const ethers = require('ethers');
const config = require("./config");
const {loadWallets, sleep} = require("./scripts/utils");
const ethProvider = config.getProvider("mainnet");
const novaProvider = config.getProvider("");
const bridgeAbi = require('./abis/bridge.abi.json');
const {Deployer} = require("./scripts/deployer");


async function main() {
    const wallets = loadWallets();
    const wallet = new ethers.Wallet(wallets[0] , novaProvider);
    const deployer = new Deployer()
    const novaBalanceBefore = await deployer.balance(wallet.address, novaProvider)
    console.log()

    // for (const walletPk of wallets) {
    //     console.log("Bridging .....")
    //     const wallet = new ethers.Wallet(walletPk , ethProvider);
    //     const bridge = new ethers.Contract(config.ETHEREUM_NOVA_BRIDGE, bridgeAbi, wallet);
    //     await bridge.functions.depositEth({value: ethers.utils.parseEther(config.AMOUNT_TO_BRIDGE)});
    // }
    //
    // console.log("Waiting for the eth balance income on Nova Network ...\n" +
    //     "Checking on the first wallet")
    // let novaBalanceAfter = novaBalanceBefore
    // let waited = 0;
    // while (novaBalanceAfter <= novaBalanceBefore || waited < config.WAIT_TIME_BALANCE) {
    //     novaBalanceAfter = await novaProvider.getBalance(wallet.address)
    //     const waitingTime = Math.floor(Math.random() * 7)
    //     await sleep(waitingTime)
    //     waited += waitingTime
    // }
    //
    console.log("Deploying contracts ....")
    for (const walletPk of wallets) {
        const wallet = new ethers.Wallet(walletPk , novaProvider);
        deployer.createNewContracts(1, wallet.address)
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

