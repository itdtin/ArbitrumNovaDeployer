const {ethers} = require("ethers");

module.exports = {
    NOVA_URL: "https://nova.arbitrum.io/rpc",
    ETHEREUM_URL: "https://eth-mainnet.g.alchemy.com/v2/00W7G2cA4NdHJYk31uIzk5h_YFwVPKZb",
    ETHEREUM_NOVA_BRIDGE: "0xc4448b71118c9071Bcb9734A0EAc55D18A153949",
    AMOUNT_TO_BRIDGE: "0.0015",
    AMOUNT_TO_SEND_MIN: "0.001",
    AMOUNT_TO_SEND_MAX: "0.0013",
    WAIT_TIME_BALANCE: 1000,

    getProvider: function (network) {
        let url;
        if (network === "mainnet") {
            url = this.ETHEREUM_URL
        } else {
            network = "arbitrum-nova"
            url = this.NOVA_URL
        }
        const customHttpProvider = new ethers.providers.JsonRpcProvider(url);
        customHttpProvider.getBlockNumber().then((result) => {
            console.log(`Current block number on ${network} network: `+ result);
        });
        return customHttpProvider

    }


}