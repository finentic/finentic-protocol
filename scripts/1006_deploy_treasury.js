// npx hardhat run scripts/1006_deploy_treasury.js --network fuji
// npx hardhat verify Treasury@0x581cfE1d12b36f20e441C196011275Ca72a09977 --network fuji

const { ethers, run } = require("hardhat")
const ADDRESSES = {
  CONTROL_CENTER: '0x63Ed19D06bADBBcBED27343959a10Aff31E73304',
}

async function main() {
  const [accountOwner] = await ethers.getSigners()
  console.log('Owner: ', accountOwner.address)

  const ControlCenterInstance = await ethers.getContractAt("ControlCenter", ADDRESSES.CONTROL_CENTER)
  const paramsTreasury = [ADDRESSES.CONTROL_CENTER]
  const Treasury = await ethers.getContractFactory("Treasury")
  const TreasuryInstance = await Treasury.deploy(...paramsTreasury)
  await TreasuryInstance.deployed()

  console.log(`Treasury deployed to ${TreasuryInstance.address}`)

  // Verify contract
  try {
    await run("verify:verify", {
      contract: "contracts/finance/Treasury.sol:Treasury",
      address: TreasuryInstance.address,
      constructorArguments: paramsTreasury,
    })
  } catch (error) { console.info(error) }

  console.info(`Waiting for config...`)
  await ControlCenterInstance.addToWhitelist(TreasuryInstance.address)
  console.info('Done.')
}

// We recommend this pattern to be able to use async/await everywhere and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
