module.exports = {
    CAKE_DECIMALS: 18,
    ZERO_ADDRESS: "0x0000000000000000000000000000000000000000",
    BUSD_ADDRESS: "0xe9e7cea3dedca5984780bafc599bd69add087d56",
    CAKE_ADDRESS: "0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82",
    PANCAKE_MASTER_CHEF_ADDRESS: "0x73feaa1eE314F8c655E354234017bE2193C9E24E",
    PANCAKE_SMART_CHEF_ADDRESS: "0xa35caA9509a2337E22C54C929146D5F7f6515794",
    AWS_REGION: process.env.AWS_REGION || 'us-east-2',
    NETWORK: process.env.NETWORK || 'bsc', // change to 'eth' to test on ethereum
    INFURA_KEY: process.env.INFURA_KEY, // Infura API key for eth testing
    TABLE_NAME: process.env.TABLE_NAME || 'vaulty_test_db', // DynamoDB name
    BUCKET_NAME: process.env.BUCKET_NAME || 'holvi',  // S3 bucket name  
    BSC_URL: process.env.BSC_URL || "https://alien-nameless-breeze.bsc.quiknode.pro/bdecd2a7ddc4f6d270d26a9cd5c1b4f3c120ff53/", // mainnet: https://bsc-dataseed1.defibit.io/
    HOLVI_DECIMALS: 18,
    BASE_CURRENCY: process.env.BASE_CURRENCY || "BNB", // convertion currency, used for calculations of market rates
    HOLVI_SYMBOL: process.env.HOLVI_SYMBOL || "VLTY",
    COMPOUND_FREQUENCY: {
        regularPool: 52, // every week
        vault: process.env.HARDWORK_FREQUENCY || 365 // once a day (when do hardwork is called)
    },
    GAS_LIMIT: process.env.GAS_LIMIT || 10200000,
    PROFIT_SHARING: process.env.PROFIT_SHARING || 0.10, // % of vault's profits is sended to profit sharing pool
    LP_FEE: process.env.LP_FEE || 0.0017, // liquidity provider fee on pancake swap
    CHUNK_SIZE: 10, // max simulateonos records in database
    MAX_PRICE_RECORDS: process.env.MAX_PRICE_RECORDS || 100, // max records for hTokenPrices history in database
    MAX_TRADE_VOLUME_RECORDS: process.env.MAX_TRADE_VOLUME_RECORDS || 100, // max records for DexTradeVolumes on pancake swap history
    CLEAR_DB_ONCE_AWSCONFIG_UPDATED: process.env.CLEAR_DB_ONCE_AWSCONFIG_UPDATED || false, // if true all vaults which is not in S3 aws-config.json will be cleared from DB
    USE_PANCAKE_FOR_HOLVI_PRICE: process.env.USE_PANCAKE_FOR_HOLVI_PRICE || true, // if true will try to get price from pancakeswap, if false - only from market rates API
    PRECISION: 12, // Used for floating point conversion to bignumber
    PROFIT_PERIOD: 30, // days, used to display on website "Monthly profit"
    DISTRIBUTE_HOLVI_PERIOD: process.env.DISTRIBUTE_HOLVI_PERIOD || 7, //days, used to calculate next emission descrease
    TARGET_HARDWORK: process.env.TARGET_HARDWORK || false,
    GAS_PER_HARDWORK: process.env.GAS_PER_HARDWORK || 240000,
    WBNB_ADDRESS: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    PANCAKE_FACTORY: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73",
    CACHE_CORE_DATA: process.env.CACHE_CORE_DATA || false,
    SMART_CHEF_FACTORY: "0x927158be21fe3d4da7e96931bb27fd5059a8cbc2",
    BSCSCAN_KEY: "GVJTJENYBDGMSSV7RMQ1F126J34B6NXPY8",
    BLOCKS_PER_YEAR: 365 * 24 * 60 * 60 / 3,
    SYRUP_POOL_HOPS_FREQUENCY: 2,
    ELLIPSIS_STAKING_POOL: "0xcce949De564fE60e7f96C85e55177F8B9E4CF61b",
    DEFISTATION_URL: process.env.DEFISTATION_URL || "https://api.defistation.io/dataProvider/tvl",
    DEFISTATION_ID: process.env.DEFISTATION_ID || "Vaulty",
    DEFISTATION_KEY: process.env.DEFISTATION_KEY || "0410420a-4de8-4046-9840-d5b9495a80e7",
    DEFISTATION_TEST: process.env.DEFISTATION_TEST || true,
    BSCSCAN_API_KEY: "MKU1YBGIT66GM4FSYKBTRYESBE44RZH9Q8",
    ALPACA_ADDRESS: "0x8f0528ce5ef7b51152a59745befdd91d97091d2f",
    ALPACA_DECIMALS: 18,
    BELT_ADDRESS: "0xe0e514c71282b6f4e823703a39374cf58dc3ea4f",
    BELT_DECIMALLS: 18,
    ELLIPSIS_ADDRESS: "0xA7f552078dcC247C2684336020c03648500C6d9F",
    ELLIPSIS_DECIMALS: 18,
    VAULTY_ADDRESS: "0x38A5cbe2FB53d1d407Dd5A22C4362daF48EB8526",
    VENUS_ADDRESS: "0xcf6bb5389c92bdda8a3747ddb454cb7a64626c63",
    VENUS_DECIMALS: 18,

    getProvider: function () {
        if (this.NETWORK === 'eth') {
            return ["mainnet", {infura: this.INFURA_KEY}]
        } else if (this.NETWORK === 'bsc') {
            return [this.BSC_URL]
        } else {
            throw Error(`Unexpected network ${this.NETWORK}`)
        }
    },
    SYMBOLS_MAP: {
        "WETH": "ETH",
        "WBNB": "BNB"
    }
}