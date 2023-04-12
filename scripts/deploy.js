// npx hardhat run scripts/deploy.js --network fuji
// npx hardhat verify Lock@0x1e803a97cb9D0fadc69882B1eCf5A9B97Fd31D7E --network fuji

const { ethers, run } = require("hardhat")

async function main() {
  const [accountOwner] = await ethers.getSigners()
  console.log('accountOwner', accountOwner.address)

  const currentTimestampInSeconds = (await ethers.provider.getBlock('latest')).timestamp
  const unlockTime = currentTimestampInSeconds + 60
  const lockedAmount = ethers.utils.parseEther("0.001")
  const lockParams = [unlockTime]
  const Lock = await ethers.getContractFactory("Lock")
  const LockInstance = await Lock.deploy(...lockParams, { value: lockedAmount })
  await LockInstance.deployed()

  console.log(`Lock deployed to ${LockInstance.address} with ${ethers.utils.formatEther(lockedAmount)}ETH and unlock timestamp ${unlockTime}`)

  // Verify contract
  try {
    await run("verify:verify", {
      contract: "contracts/Lock.sol:Lock",
      address: LockInstance.address,
      constructorArguments: lockParams,
    })
  } catch (error) { console.info(error) }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
