const { time } = require("@nomicfoundation/hardhat-network-helpers");

const getBlockTimestamp = () => time.latest();

/**
 * @dev Freeze block timestamp until next transaction success
 * @param nextBlockTimestamp must greater than current block timestamp
 */
async function setNextBlockTimestamp(nextBlockTimestamp) {
    await time.setNextBlockTimestamp(nextBlockTimestamp)
    const secondsIncrease = nextBlockTimestamp - (await getBlockTimestamp())
    await time.increase(secondsIncrease)
}

module.exports = {
    getBlockTimestamp,
    setNextBlockTimestamp,
}