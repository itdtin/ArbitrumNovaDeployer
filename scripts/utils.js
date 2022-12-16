const config = require('../config')
const fs = require('fs')



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

  addressMatch: function(address1, address2) {
    return address1.toLowerCase() === address2.toLowerCase()
  },

  loadWallets: function(walletsPath ='./wallets.txt') {
    if (fs.existsSync(walletsPath)) {
      const contents = fs.readFileSync(walletsPath, 'utf-8');
      return contents.split(/\r?\n/);
    }
  },
  sleep: function (seconds) {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000))
  },

  getFileNameFromPath: function (str) {
    return str.split('\\').pop().split('/').pop();
  }



}
