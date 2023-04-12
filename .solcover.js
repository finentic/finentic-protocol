module.exports = {
    skipFiles: [],
    client: require('ganache-cli'),
    providerOptions: {
        network_id: "43113",
        fork: 'https://api.avax-test.network/ext/bc/C/rpc',
        blockTime: 5
    }
}; 