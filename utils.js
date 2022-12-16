const axios = require('axios')
const { utils } = require('ethers')
const config = require('./config')
const fs = require('fs')
const { BigNumber, ethers } = require('ethers')

const relativePath = (function() {
  return process.env.AWS_LAMBDA_FUNCTION_NAME ? '.' : '..'
})()
const PANCAKE_FACTORY = config.PANCAKE_FACTORY
const FACTORY_ABI = JSON.parse((fs.readFileSync(`${relativePath}/helpers/abi/factory.abi.json`).toString()))
const PROVIDER = ethers.getDefaultProvider(...config.getProvider())
const TOKEN_ABI = JSON.parse((fs.readFileSync(`${relativePath}/helpers/abi/rewardToken.abi.json`).toString()))
const VAULT_ABI = JSON.parse((fs.readFileSync(`${relativePath}/helpers/abi/vaults.abi.json`).toString()))
const PANCAKE_MASTER_ABI = JSON.parse((fs.readFileSync(`${relativePath}/helpers/abi/pancake.master.abi.json`).toString()))
const PANCAKE_SMART_ABI = JSON.parse((fs.readFileSync(`${relativePath}/helpers/abi/smartChef.abi.json`).toString()))
const ALPACA_REWARD_POOL_ABI = JSON.parse((fs.readFileSync(`${relativePath}/helpers/abi/alpaca.fairLaunch.abi.json`).toString()))
const ALPACA_STRATEGY_ABI = JSON.parse((fs.readFileSync(`${relativePath}/helpers/abi/alpacaStrategy.abi.json`).toString()))
const MASTER_BELT_ABI = JSON.parse((fs.readFileSync(`${relativePath}/helpers/abi/masterBelt.abi.json`).toString()))
const ELLIPSIS_TOKEN_STAKER_ABI = JSON.parse((fs.readFileSync(`${relativePath}/helpers/abi/ellipsisLpTokenStaker.abi.json`).toString()))
const REWARD_POOL_ABI = JSON.parse((fs.readFileSync(`${relativePath}/helpers/abi/rewardPool.abi.json`).toString()))
const COMPTROLLER_ABI = JSON.parse((fs.readFileSync(`${relativePath}/helpers/abi/venusComptroller.abi.json`).toString()))
const SYMBOLS_MAP = config.SYMBOLS_MAP
const lpAbi = JSON.parse((fs.readFileSync(`${relativePath}/helpers/abi/lpPool.abi.json`).toString()))

const eventTopics = {
  withdraw: '0x884edad9ce6fa2440d8a54cc123490eb96d2768479d49ff9c7366125a9424364',
  withdrawn: '0x7084f5476618d8e60b11ef0d7d3f06914655adb8793e28ff7f018d4c76d505d5',
  deposit: '0xe1fffcc4923d04b559f4d29a8bfc6cda04eb5b0d3c460751c2402c5c5cc9109c',
  staked: '0x9e71bc8eea02a63969f509818f2dafb9254532904319f9dbda79b67bd34a5f3d'
}

module.exports = {
  chunkArray: function(myArray, chunk_size) {
    let index = 0
    const arrayLength = myArray.length
    const tempArray = []

    for (index = 0; index < arrayLength; index += chunk_size) {
      myChunk = myArray.slice(index, index + chunk_size)
      tempArray.push(myChunk)
    }
    return tempArray
  },

  doViaChunks: async function(_array, _doFn, _chunkSize = config.CHUNK_SIZE) {
    try {
      let results = []
      const chunks = this.chunkArray(_array, _chunkSize)
      for (const chunk of chunks) {
        const result = await doForChunk(chunk, _doFn)
        results = results.concat(...Array(result))
      }

      async function doForChunk(_chunk, _doFn) {
        const data = _chunk.map(async instance => await _doFn(instance))
        return Promise.all(data)
      }
      results = results.filter(function(el) {
        return el !== undefined
      })
      return results
    } catch (e) { console.log(e) }
  },

  isLp: async function(_symbol) {
    return !!_symbol.includes('-LP')
  },

  getUnderlyingData: async function(underlyingAddress, _baseToUSD) {
    const underlyingContract = new ethers.Contract(underlyingAddress, lpAbi, PROVIDER)
    const underlyingSymbol = await underlyingContract.symbol()
    const type = await this.isLp(underlyingSymbol) ? 'lp' : 'single'
    const underlyingData = {
      address: underlyingAddress,
      type
    }
    if (type === 'lp') {
      const token0 = await underlyingContract.token0()
      const token1 = await underlyingContract.token1()
      const token0Contract = new ethers.Contract(token0, TOKEN_ABI, PROVIDER)
      const token1Contract = new ethers.Contract(token1, TOKEN_ABI, PROVIDER)
      const [decimals, token0symbol, token1symbol, token0decimals, token1decimals] = await Promise.all([
        underlyingContract.decimals(),
        token0Contract.symbol(),
        token1Contract.symbol(),
        token0Contract.decimals(),
        token1Contract.decimals()
      ])
      underlyingData.decimals = decimals
      const symbol = `${SYMBOLS_MAP[token0symbol] || token0symbol}-${SYMBOLS_MAP[token1symbol] || token1symbol} LP`.toUpperCase()
      underlyingData.pair = {
        token0: {
          address: token0,
          symbol: token0symbol.toUpperCase(),
          decimals: token0decimals
        },
        token1: {
          address: token1,
          symbol: token1symbol.toUpperCase(),
          decimals: token1decimals
        }
      }
      underlyingData.symbol = symbol
    } else {
      const symbol = await underlyingContract.symbol() || ''
      underlyingData.symbol = symbol.toUpperCase()
      underlyingData.decimals = await underlyingContract.decimals()
    }
    const row = { underlying: underlyingData }
    const underlyingPriceInBase = await this.getUnderlyingPrice(row)
    underlyingData.price = underlyingPriceInBase * _baseToUSD
    return underlyingData
  },

  getEvents: async function(_address, blockStart = 0, blockFinish = 'latest', _apiKey = config.BSCSCAN_API_KEY) {
    let result = []
    const url = 'https://api.bscscan.com/api'
    const params = {
      module: 'logs',
      action: 'getLogs',
      fromBlock: blockStart,
      toBlock: blockFinish,
      address: _address,
      apikey: _apiKey
    }
    for (const eventType of Object.keys(eventTopics)) {
      params.topic0 = eventTopics[eventType]
      try {
        const response = await axios.get(url, { params: params, json: true, allowGetBody: true })
        if (response.status !== 200) {
          throw new Error(`Error during fetching market rates API: ${response.statusText}`)
        }
        result = result.concat(response.data.result)
      } catch (e) {
        console.log(e)
      }
    }
    return result
  },

  usersCountInVault: async function(_address) {
    const _events = await this.getEvents(_address)
    const amounts = {}
    // Fill map {address: amount} following by deposits and withdraws
    try {
      const _doFn = async(_event) => {
        const decoder = new ethers.utils.AbiCoder()
        // eslint-disable-next-line new-cap
        const user = decoder.decode(['address'], _event.topics[1])[0]
        amounts[user] = 0
        if (_event.topics[0] === eventTopics.deposit || _event.topics[0] === eventTopics.staked) {
          amounts[user]++
        } else if (_event.topics[0] === eventTopics.withdraw || _event.topics[0] === eventTopics.withdrawn) {
          amounts[user]--
        }
      }
      await this.doViaChunks(_events, _doFn)

      // Calculate users count
      let vaultUsers = 0
      await this.doViaChunks(Object.keys(amounts), async(userAddress) => {
        if (amounts[userAddress] > 0) {
          vaultUsers += 1
        }
      })
      console.log(`usersCount in vault on ${_address}: `, vaultUsers)
      return vaultUsers
    } catch (e) {
      console.log(e)
    }
  },

  toFixed: function(x) {
    if (Math.abs(x) < 1.0) {
      const e = parseInt(x.toString().split('e-')[1])
      if (e) {
        x *= Math.pow(10, e - 1)
        x = '0.' + (new Array(e)).join('0') + x.toString().substring(2)
      }
    } else {
      let e = parseInt(x.toString().split('+')[1])
      if (e > 20) {
        e -= 20
        x /= Math.pow(10, e)
        x += (new Array(e + 1)).join('0')
      }
    }
    return x
  },
  isValid: function(num) {
    if (!isFinite(num) || isNaN(num) || num === 0) return false
    return true
  },
  getUnderlyingPrice: async function(row, marketRates, beltPrices, baseToUSD, _ellipsisData) {
    switch (row.underlying.type) {
      case 'lp':
        return await this.getLpPrice({ _objUnderlying: row.underlying, addressTo: config.WBNB_ADDRESS, marketRates: marketRates, symbolTo: config.BASE_CURRENCY })
      default:
        if (row.protocols === undefined) {
          row.protocols = ''
        }
        if (row.protocols.includes('belt')) {
          const underlyingUsdPrice = beltPrices.find(obj => obj.name.toLowerCase().split(' ')[0] === row.underlying.symbol.toLowerCase() || (obj.name === 'BELT-BNB-V2 LP' && row.underlying.symbol === 'WBNB-BELT LP'))
          return (underlyingUsdPrice.price / baseToUSD).toPrecision(config.PRECISION)
        } else if (row.protocols.includes('ellipsis')) {
          const ellipsisPoolData = _ellipsisData[row.underlying.address.toLowerCase()]
          const underlyingUsdPrice = parseFloat(ethers.utils.formatUnits(BigNumber.from(ellipsisPoolData.virtualPrice), ellipsisPoolData.decimals))
          return (underlyingUsdPrice / baseToUSD).toPrecision(config.PRECISION)
        } else {
          return await this.getRate({ symbolFrom: row.underlying.symbol, symbolTo: config.BASE_CURRENCY, marketRates: marketRates, addressFrom: row.underlying.address, addressTo: config.WBNB_ADDRESS })
        }
    }
  },
  getLpPrice: async function({ _objUnderlying, addressTo, symbolTo, marketRates = [] }) {
    if (_objUnderlying.type !== 'lp') {
      throw new Error(`Impossible to get LP rate for underlying:\n${JSON.stringify(_objUnderlying)}`)
    }
    const { token0, token1 } = _objUnderlying.pair
    const Token0 = new ethers.Contract(token0.address, TOKEN_ABI, PROVIDER)
    const Token1 = new ethers.Contract(token1.address, TOKEN_ABI, PROVIDER)
    const lpContract = new ethers.Contract(_objUnderlying.address, lpAbi, PROVIDER)
    const [reserves, totalSupplyBn, token0decimals, token1decimals] = await Promise.all([
      lpContract.getReserves(),
      lpContract.totalSupply(),
      _objUnderlying.pair.token0.decimals || Token0.decimals(),
      _objUnderlying.pair.token1.decimals || Token1.decimals()
    ])

    const totalSupply = ethers.utils.formatUnits(totalSupplyBn, _objUnderlying.decimals)
    const reserve0 = ethers.utils.formatUnits(reserves[0], token0decimals)
    const tvlInToken0 = reserve0 * 2
    const token0Rate = await this.getRate({
      symbolFrom: token0.symbol,
      symbolTo,
      marketRates,
      addressFrom: token0.address,
      addressTo,
      token0decimals,
      token1decimals
    })
    const tvl = tvlInToken0 * token0Rate
    const lpRate = tvl / totalSupply
    return lpRate
  },
  getGasPrice: async() => {
    if (process.env.GAS_PRICE) {
      return utils.parseUnits(process.env.GAS_PRICE, 'gwei')
    } else {
      // const url = 'https://bscgas.info/gas'
      // let response
      // try {
      //   response = await axios.get(url, { json: true, allowGetBody: true })
      // } catch(e) {
      //   //
      // }
      // const gasPrice = response?.data ? response.data.slow || 5 : 5
      return utils.parseUnits('5', 'gwei')
    }
  },
  getRateByContracts: async function({ from, to, token0decimals = undefined, token1decimals = undefined }) {
    try {
      if (!from || !to) return 0
      const Factory = new ethers.Contract(PANCAKE_FACTORY, FACTORY_ABI, PROVIDER)
      const Token0 = new ethers.Contract(from, TOKEN_ABI, PROVIDER)
      const Token1 = new ethers.Contract(to, TOKEN_ABI, PROVIDER)
      const POOL_ABI = JSON.parse((fs.readFileSync(`${relativePath}/helpers/abi/lpPool.abi.json`).toString()))
      const [decimals0, decimals1, pairAddress] = await Promise.all([
        token0decimals || Token0.decimals(),
        token1decimals || Token1.decimals(),
        Factory.getPair(from, to)
      ])

      if (pairAddress === config.ZERO_ADDRESS) return 0
      console.log(`Getting price using pancake pair contract: ${pairAddress}`)

      const pairContract = new ethers.Contract(pairAddress, POOL_ABI, PROVIDER)
      const [reserves, token0] = await Promise.all([
        pairContract.getReserves(),
        pairContract.token0()
      ])

      const [reserve0, reserve1] = reserves
      let price
      if (this.addressMatch(token0, from)) {
        price = (reserve1 / reserve0) * Math.abs(Math.pow(10, decimals0 - decimals1))
      } else if (this.addressMatch(token0, to)) {
        price = (reserve0 / reserve1) * Math.abs(Math.pow(10, decimals0 - decimals1))
      } else {
        throw Error('Unexepected addresses')
      }
      return price
    } catch (e) {
      console.log(e)
      return 0
    }
  },
  getHolviPriceBnb: async function(_marketRates, _rewardData) {
    if (config.USE_PANCAKE_FOR_HOLVI_PRICE) {
      let _price
      try {
        _price = await this.getRateByContracts({ from: _rewardData.address, to: config.WBNB_ADDRESS })
        if (!_price || isNaN(_price)) {
          console.log('\nGot zero HOLVI price from pancake. Trying to get price from market API ...')
          _price = await this.getRate({ symbolFrom: config.HOLVI_SYMBOL, symbolTo: config.BASE_CURRENCY, marketRates: _marketRates })
        }
      } catch (e) {
        console.warn("\nCan't get HOLVI price from pancake:\n" + e)
        console.log('\nGetting price from market API ...')
        _price = await this.getRate({ symbolFrom: config.HOLVI_SYMBOL, symbolTo: config.BASE_CURRENCY, marketRates: _marketRates })
      }
      return _price
    }
    return await this.getRate({ symbolFrom: config.HOLVI_SYMBOL, symbolTo: config.BASE_CURRENCY, marketRates: _marketRates, addressFrom: _rewardData.address, addressTo: config.WBNB_ADDRESS })
  },
  addressMatch: function(address1, address2) {
    return address1.toLowerCase() === address2.toLowerCase()
  },
  getRate: async function({
    symbolFrom, symbolTo, marketRates = [],
    addressFrom = undefined,
    addressTo = undefined,
    token0decimals = undefined,
    token1decimals = undefined
  }) {
    try {
      let price = await this.getRateByContracts({ from: addressFrom, to: addressTo, token0decimals, token1decimals })
      if (price === 0 && marketRates.length > 0) {
        console.log(`Price for ${symbolFrom}-${symbolTo} is getting from 3rd party API`)
        const data1 = marketRates.find(row => row.symbol === symbolFrom || row.symbol === SYMBOLS_MAP[symbolFrom])
        const data2 = marketRates.find(row => row.symbol === symbolTo || row.symbol === SYMBOLS_MAP[symbolTo])
        price = (data1.quotes.USD.price / data2.quotes.USD.price)
      }
      return price
    } catch (e) {
      throw new Error(e)
    }
  },
  getMarketRates: async function() {
    const url = 'https://api.coinpaprika.com/v1/tickers'
    try {
      const response = await axios.get(url, { json: true, allowGetBody: true })
      if (response.status !== 200) {
        throw new Error(`Error during fetching market rates API: ${response.statusText}`)
      }
      return response.data
    } catch (e) {
      console.log(e)
      return []
    }
  },
  toHolviPrecision: function(value, decimals) {
    return value + Math.pow(10, config.HOLVI_DECIMALS - decimals).toString().slice(1)
  },
  checkTokensOrder: async function(vault, reserve0, reserve1) {
    const token0Address = vault.underlying.pair.token0.address
    const token0Contract = new ethers.Contract(token0Address, TOKEN_ABI, PROVIDER)
    const token0Balance = await token0Contract.balanceOf(vault.underlying.address)
    if (token0Balance.sub(reserve0) == 0) {
      return reserve0, reserve1
    } else if (token0Balance.sub(reserve1) == 0) {
      return reserve1, reserve0
    } else {
      return undefined
    }
  },
  getLpAprsJSON: async function() {
    const url = 'https://raw.githubusercontent.com/pancakeswap/pancake-frontend/develop/src/config/constants/lpAprs.json'
    try {
      const response = await axios.get(url, { json: true, allowGetBody: true })
      if (response.status !== 200) {
        throw new Error(`Error during fetching market rates API: ${response.statusText}`)
      }
      if (response.data && Object.keys(response.data).length > 10) {
        return response.data
      } else {
        throw new Error('LpAprs.json does not contains data')
      }
    } catch (e) {
      console.log(e)
      return false
    }
  },
  getBeltData: async function() {
    const url = 'https://s.belt.fi/info/all.json'
    try {
      const data = await axios.get(url, { json: true, allowGetBody: true })
      return {
        tokenlist: data.data.tokenList.BSC,
        info: data.data.info.BSC
      }
    } catch (e) {
      return undefined
    }
  },

  getVenusData: async function() {
    const url = 'https://api.venus.io/api/vtoken'
    try {
      const data = await axios.get(url, { json: true, allowGetBody: true })
      return data.data.data.markets
    } catch (e) {
      return undefined
    }
  },

  getEllipsisData: async function() {
    const url = 'https://api.ellipsis.finance/api/getPoolData'
    try {
      const data = await axios.get(url, { json: true, allowGetBody: true })
      const pools = {}
      for (const pool of Object.values(data.data.data.pools)) {
        pools[pool.address.toLowerCase()] = pool
      }
      return pools
    } catch (e) {
      return undefined
    }
  },

  getEllipsisPools: async function(_vault) {
    const url = 'https://api.ellipsis.finance/api/getPools'
    try {
      const data = await axios.get(url, { json: true, allowGetBody: true })
      const pools = data.data.data.basePools.concat(data.data.data.metaPools)
      const finalData = {}
      for (const pool of pools) {
        finalData[pool.lpToken.address.toLowerCase()] = pool
      }
      return finalData
    } catch (e) {
      return undefined
    }
  },
  getPoolRewardRate: async function(row, forReportArray = null) {
    const vaultContract = new ethers.Contract(row.poolAddress, REWARD_POOL_ABI, PROVIDER)
    const periodFinish = (await vaultContract.periodFinish()).toNumber()
    const currentTime = Date.now() / 1000
    if (periodFinish < currentTime) {
      const msg = `Null REWARDS for ${row.sk}`
      console.log(msg)
      if (forReportArray) {
        forReportArray.push(msg)
      }
      return BigNumber.from('0')
    }
    return row.poolRewardRate?._hex ? BigNumber.from(row.poolRewardRate._hex) : BigNumber.from('0')
  },
  getHistoricalRecordByTime: function(records, days = 30) {
    if (!records || records.length === 0) return { data: 0 }
    const lastRecord = records[0]
    const recordDaysBefore = records.find(record =>
      (lastRecord.timestamp - record.timestamp) > 86400 * days * 1000
    )
    if (!recordDaysBefore) return records[records.length - 1]
    return recordDaysBefore
  },
  getPeriodsCount: function(timestamps = []) {
    if (timestamps.length === 0) return 0
    const SECONDS_PER_YEAR = 365.25 * 24 * 60 * 60
    const deltas = timestamps.reduce((result, ts, index, arr) => {
      const delta = arr[index + 1] - ts
      if (index !== arr.length - 1) {
        result.push(delta)
      }
      return result
    }, [])
    if (deltas.length === 0) return 1
    const averageDurationInSeconds = (deltas.reduce((sum, value) => sum + value) / deltas.length - 1) / 1000
    return parseInt(SECONDS_PER_YEAR / averageDurationInSeconds)
  },
  calculateAverageRate: function(prices) {
    if (prices.length === 0) return 0
    const rates = prices.reduce((result, num, index, arr) => {
      const rate = arr[index + 1] / num
      if (index !== arr.length - 1) {
        result.push(rate)
      }
      return result
    }, [])
    if (rates.length === 0) return 0
    const averageRate = (rates.reduce((sum, value) => sum + value) / rates.length - 1) * 100
    return isNaN(averageRate) ? 0 : averageRate
  },
  getVaultAPY: function(vault, hTokenChangeRate, periodsInYear, _protocolsData) {
    const protocol = vault.protocols[0]
    const underlyingSymbol = vault.underlying.symbol
    const result = {
      vaultAPR: 0,
      vaultAPY: 0,
      realVaultAPR: 0,
      realVaultAPY: 0
    }
    try {
      switch (protocol) {
        case 'venus':
          const obj = _protocolsData.VENUS_DATA.filter(d => d.underlyingSymbol.toUpperCase() === underlyingSymbol || d.underlyingSymbol.toUpperCase() === config.SYMBOLS_MAP[underlyingSymbol])[0]
          if (obj) {
            const venusAPR = parseFloat(obj.supplyApy) + parseFloat(obj.supplyVenusApy)
            result.vaultAPR = venusAPR
            result.vaultAPY = this.aprToApy(venusAPR, config.COMPOUND_FREQUENCY.vault)
            break
          }
        case 'alpaca':
          const alpaca = _protocolsData.ALPACA_DATA.filter(d => d.symbol.toUpperCase() === underlyingSymbol || d.symbol.toUpperCase() === config.SYMBOLS_MAP[underlyingSymbol])[0]
          if (alpaca) {
            const alpacaAPY = parseFloat(alpaca.apy)
            result.vaultAPR = this.apyToApr(alpacaAPY, config.COMPOUND_FREQUENCY.vault)
            result.vaultAPY = alpacaAPY
            break
          }
        case 'belt':
          const beltSymbol = underlyingSymbol === 'WBNB-BELT LP' || underlyingSymbol === 'BNB-BELT LP' ? 'WBNB-BELT-V2 LP' : underlyingSymbol
          const belt = _protocolsData.BELT_DATA.info.vaultPools.filter(d => d.name.toUpperCase() === beltSymbol)[0]
          if (belt) {
            const beltAPR = parseFloat(belt.totalAPR)
            result.vaultAPR = beltAPR
            result.vaultAPY = this.aprToApy(beltAPR, config.COMPOUND_FREQUENCY.vault)
            break
          }
        case 'pancakeswap':
          const pancake = _protocolsData.PANCAKE_DATA.filter(d => d.symbol === underlyingSymbol)[0]
          if (pancake) {
            const pancakeTotal = parseFloat(pancake.total)
            const pancakeRewardAPR = parseFloat(pancake.rewardAPR)
            const pancakeLpApr = parseFloat(pancake.lpAPR)
            const pancakeRewardAPY = this.aprToApy(pancakeRewardAPR, config.COMPOUND_FREQUENCY.vault)
            result.vaultAPR = pancakeTotal// apyToApr(pancakeAPY, 365)
            result.vaultAPY = pancakeRewardAPY + pancakeLpApr
            break
          }
        case 'vaulty':
          // eslint-disable-next-line no-case-declarations
          const priceAPY = (hTokenChangeRate * periodsInYear) * (1 - config.PROFIT_SHARING)
          if (vault.sk === 'VAULTY:AUTO VLTY-BNB LP') {
            result.vaultAPY = this.aprToApy(_protocolsData.VLTY_BNB_MANUAL.APR.pool, config.COMPOUND_FREQUENCY.vault) + priceAPY
          } else {
            result.vaultAPY = priceAPY
          }
          result.vaultAPR = this.apyToApr(priceAPY, config.COMPOUND_FREQUENCY.vault)
          break
        case 'ellipsis':
          const ellipsisPoolData = _protocolsData.ELLIPSIS_DATA[vault.underlying.address.toLowerCase()]
          result.vaultAPY = parseFloat(ellipsisPoolData.apy)
          result.vaultAPR = this.apyToApr(parseFloat(ellipsisPoolData.apy), config.COMPOUND_FREQUENCY.vault)
          break
        default:
          const APY = (hTokenChangeRate * periodsInYear) * (1 - config.PROFIT_SHARING)
          result.vaultAPY = APY
          result.vaultAPR = this.apyToApr(APY, config.COMPOUND_FREQUENCY.vault)
      }

      const realVaultAPY = (hTokenChangeRate * periodsInYear) * (1 - config.PROFIT_SHARING)
      const realVaultAPR = this.apyToApr(realVaultAPY, config.COMPOUND_FREQUENCY.vault)

      result.realVaultAPY = isNaN(realVaultAPY) ? 0 : realVaultAPY
      result.realVaultAPR = isNaN(realVaultAPR) ? 0 : realVaultAPR
      return result
    } catch (e) {
      console.log(e)
      return {
        vaultAPY: 0,
        vaultAPR: 0
      }
    }
  },
  aprToApy: function(interest, frequency) {
    if (!this.isValid(interest)) return 0
    const apr = ((1 + (interest / 100) / frequency) ** frequency - 1) * 100
    return parseFloat(this.toFixed(apr))
  },
  apyToApr: function(interest, frequency) {
    if (!this.isValid(interest)) return 0
    return parseFloat(this.toFixed(((1 + (interest / 100)) ** (1 / frequency) - 1) * frequency * 100))
  },
  isHardworkFeesCovered: async function(_vault, _isVault, _isEnabled, _protocolParams) {
    let txFeeWei
    let pendingRewards
    try {
      if (_isVault && _isEnabled) {
        const vaultContract = new ethers.Contract(_vault.vaultAddress, VAULT_ABI, PROVIDER)
        const strategyAddress = await vaultContract.strategy()
        const protocol = _vault.protocols[0]
        const params = _protocolParams[protocol]
        txFeeWei = params.txFeeWei
        const strategy = new ethers.Contract(strategyAddress, ALPACA_STRATEGY_ABI, PROVIDER)
        const rewardPoolAddress = await strategy.rewardPool()
        if (protocol === 'alpaca') {
          const rewardPool = new ethers.Contract(rewardPoolAddress, ALPACA_REWARD_POOL_ABI, PROVIDER)
          pendingRewards = await rewardPool.pendingAlpaca(await strategy.poolId(), strategyAddress) || 0
        } else if (protocol === 'belt') {
          const rewardPool = new ethers.Contract(rewardPoolAddress, MASTER_BELT_ABI, PROVIDER)
          const poolId = await strategy.poolId()
          pendingRewards = await rewardPool.pendingBELT(poolId, strategyAddress) || 0
          txFeeWei = params.txFeeWei / 10000
        } else if (protocol === 'ellipsis') {
          const rewardPool = new ethers.Contract(rewardPoolAddress, ELLIPSIS_TOKEN_STAKER_ABI, PROVIDER)
          const poolId = await strategy.poolId()
          pendingRewards = await rewardPool.claimableReward(poolId, strategyAddress) || 0
        } else if (protocol === 'pancakeswap') {
          if (_vault.sk === 'PANCAKESWAP:CAKE') {
            const smartChef = new ethers.Contract(config.PANCAKE_SMART_CHEF_ADDRESS, PANCAKE_SMART_ABI, PROVIDER)
            pendingRewards = await smartChef.pendingReward(strategyAddress) || 0
            txFeeWei = params.syrupTxFeeWei
          } else {
            const masterChef = new ethers.Contract(config.PANCAKE_MASTER_CHEF_ADDRESS, PANCAKE_MASTER_ABI, PROVIDER)
            pendingRewards = await masterChef.pendingCake(_vault.poolId, strategyAddress) || 0
          }
        } else if (protocol === 'vaulty') {
          const rewardPool = new ethers.Contract(rewardPoolAddress, REWARD_POOL_ABI, PROVIDER)
          pendingRewards = await rewardPool.earned(strategyAddress) || 0
        } else if (protocol === 'venus') {
          const rewardPool = new ethers.Contract(rewardPoolAddress, COMPTROLLER_ABI, PROVIDER)
          pendingRewards = await rewardPool.venusAccrued(strategyAddress) || 0
          txFeeWei = params.txFeeWei / 10000
        }
        let txFee = parseFloat(ethers.utils.formatUnits(ethers.BigNumber.from(txFeeWei), 18))
        if (protocol === 'venus' || protocol === 'belt') {
          txFee = txFee * 10000
        }
        if (pendingRewards == 0) {
          console.log(`Please check vault: ${_vault.sk} it has ${pendingRewards.toString()} rewards`)
          return false
        }
        const pendingRewardsF = parseFloat(ethers.utils.formatUnits(pendingRewards, _protocolParams[protocol].decimals))
        const pendingRewardsInBase = pendingRewardsF * _protocolParams[protocol].rewardInBase
        const isFeeCovered = pendingRewardsInBase * 0.02 >= txFee || false
        console.log(`Vault ${_vault.sk} feeCovered: ${isFeeCovered} with pending rewards in Base ${pendingRewardsInBase}`)
        return isFeeCovered
      } else {
        console.log(`Cannot calculate rewards for ${_vault.sk}`)
        return false
      }
    } catch (e) {
      console.log(`Raised an error while calculating rewards for vault ${_vault.sk}\n${e}`)
    }
  }
}
