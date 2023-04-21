// npx hardhat run scripts/1007_deploy_marketplace.js --network fuji
// npx hardhat verify Marketplace@0xf21eF335872bfA200066335C9883Eeb325175f54 --network fuji

const { ethers, run } = require("hardhat")
const ADDRESSES = {
  CONTROL_CENTER: '0x63Ed19D06bADBBcBED27343959a10Aff31E73304',
  VIETNAMESE_DONG: '0x34a25677f3BE20Ec75E0F07472E6b4BE13365691',
  TREASURY: '0x581cfE1d12b36f20e441C196011275Ca72a09977',
}

async function main() {
  const [accountOwner] = await ethers.getSigners()
  console.log('Owner: ', accountOwner.address)

  const ControlCenterInstance = await ethers.getContractAt("ControlCenter", ADDRESSES.CONTROL_CENTER)
  const VietnameseDongInstance = await ethers.getContractAt("VietnameseDong", ADDRESSES.VIETNAMESE_DONG)

  const paramsMarketplace = [ADDRESSES.CONTROL_CENTER, ADDRESSES.TREASURY]
  const Marketplace = await ethers.getContractFactory("Marketplace")
  const MarketplaceInstance = await Marketplace.deploy(...paramsMarketplace)
  await MarketplaceInstance.deployed()

  console.log(`Marketplace deployed to ${MarketplaceInstance.address}`)

  // Verify contract
  try {
    await run("verify:verify", {
      contract: "contracts/marketplace/Marketplace.sol:Marketplace",
      address: MarketplaceInstance.address,
      constructorArguments: paramsMarketplace,
    })
  } catch (error) { console.info(error) }

  console.info(`Waiting for config...`)
  await ControlCenterInstance.addToWhitelist(MarketplaceInstance.address)
  await MarketplaceInstance.updatePaymentToken(VietnameseDongInstance.address, true)
  console.info('Done.')
}

// We recommend this pattern to be able to use async/await everywhere and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
