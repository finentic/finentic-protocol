// npx hardhat run scripts/1008_deploy_from_1001_to_1007.js --network fuji

const { ethers, run } = require("hardhat")

async function main() {
  const [accountOwner] = await ethers.getSigners()
  console.log('Owner: ', accountOwner.address)

  const ControlCenter = await ethers.getContractFactory("ControlCenter")
  const ControlCenterInstance = await ControlCenter.deploy()
  await ControlCenterInstance.deployed()
  console.log(`Control Center deployed to ${ControlCenterInstance.address}`)

  const paramsVietnameseDong = [ControlCenterInstance.address]
  const VietnameseDong = await ethers.getContractFactory("VietnameseDong")
  const VietnameseDongInstance = await VietnameseDong.deploy(...paramsVietnameseDong)
  await VietnameseDongInstance.deployed()
  console.log(`VietnameseDong deployed to ${VietnameseDongInstance.address}`)

  const paramsShared = [ControlCenterInstance.address]
  const Shared = await ethers.getContractFactory("SharedNFT")
  const SharedInstance = await Shared.deploy(...paramsShared)
  await SharedInstance.deployed()
  console.log(`Finentic Shared NFT deployed to ${SharedInstance.address}`)

  const Collection = await ethers.getContractFactory("Collection")
  const CollectionInstance = await Collection.deploy()
  await CollectionInstance.deployed()
  console.log(`Collection Implementation deployed to ${CollectionInstance.address}`)

  const paramsCollectionFactory = [ControlCenterInstance.address, CollectionInstance.address]
  const CollectionFactory = await ethers.getContractFactory("CollectionFactory")
  const CollectionFactoryInstance = await CollectionFactory.deploy(...paramsCollectionFactory)
  await CollectionFactoryInstance.deployed()
  console.log(`Collection Factory deployed to ${CollectionFactoryInstance.address}`)

  const paramsTreasury = [ControlCenterInstance.address]
  const Treasury = await ethers.getContractFactory("Treasury")
  const TreasuryInstance = await Treasury.deploy(...paramsTreasury)
  await TreasuryInstance.deployed()
  console.log(`Treasury deployed to ${TreasuryInstance.address}`)

  const paramsMarketplace = [ControlCenterInstance.address, TreasuryInstance.address]
  const Marketplace = await ethers.getContractFactory("Marketplace")
  const MarketplaceInstance = await Marketplace.deploy(...paramsMarketplace)
  await MarketplaceInstance.deployed()
  console.log(`Marketplace deployed to ${MarketplaceInstance.address}`)

  console.info(`Waiting for config...`)
  await ControlCenterInstance.addToWhitelist(TreasuryInstance.address)
  await ControlCenterInstance.addToWhitelist(MarketplaceInstance.address)
  await MarketplaceInstance.updatePaymentToken(VietnameseDongInstance.address, true)
  console.info('Done.')

  // Verify contract
  try {
    await run("verify:verify", {
      contract: "contracts/access/ControlCenter.sol:ControlCenter",
      address: ControlCenterInstance.address,
    })

    await run("verify:verify", {
      contract: "contracts/payment/VietnameseDong.sol:VietnameseDong",
      address: VietnameseDongInstance.address,
      constructorArguments: paramsVietnameseDong,
    })

    await run("verify:verify", {
      contract: "contracts/nft/SharedNFT.sol:SharedNFT",
      address: SharedInstance.address,
      constructorArguments: paramsShared,
    })

    await run("verify:verify", {
      contract: "contracts/nft/Collection.sol:Collection",
      address: CollectionInstance.address,
    })

    await run("verify:verify", {
      contract: "contracts/nft/CollectionFactory.sol:CollectionFactory",
      address: CollectionFactoryInstance.address,
      constructorArguments: paramsCollectionFactory,
    })

    await run("verify:verify", {
      contract: "contracts/finance/Treasury.sol:Treasury",
      address: TreasuryInstance.address,
      constructorArguments: paramsTreasury,
    })

    await run("verify:verify", {
      contract: "contracts/marketplace/Marketplace.sol:Marketplace",
      address: MarketplaceInstance.address,
      constructorArguments: paramsMarketplace,
    })
  } catch (error) { console.info(error) }
}

// We recommend this pattern to be able to use async/await everywhere and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
