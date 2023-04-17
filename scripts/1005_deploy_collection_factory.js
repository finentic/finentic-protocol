// npx hardhat run scripts/1005_deploy_collection_factory.js --network fuji
// npx hardhat verify CollectionFactory@0x1C72E9DC564bd7a25da72FF66797De8679e27F4D --network fuji

const { ethers, run } = require("hardhat")
const ADDRESSES = {
  CONTROL_CENTER: '0x33801353c0810C09Dd15EeA23CcBE56856B021D2',
  COLLECTION_IMPLEMENTATION: '0x1C72E9DC564bd7a25da72FF66797De8679e27F4D',
}

async function main() {
  const [accountOwner] = await ethers.getSigners()
  console.log('Owner: ', accountOwner.address)

  const paramsCollectionFactory = [ADDRESSES.CONTROL_CENTER, ADDRESSES.COLLECTION_IMPLEMENTATION]
  const CollectionFactory = await ethers.getContractFactory("CollectionFactory")
  const CollectionFactoryInstance = await CollectionFactory.deploy(...paramsCollectionFactory)
  await CollectionFactoryInstance.deployed()

  console.log(`Collection Factory deployed to ${CollectionFactoryInstance.address}`)

  // Verify contract
  try {
    await run("verify:verify", {
      contract: "contracts/nft/CollectionFactory.sol:FinenticCollectionFactory",
      address: CollectionFactoryInstance.address,
      constructorArguments: paramsCollectionFactory,
    })
  } catch (error) { console.info(error) }
}

// We recommend this pattern to be able to use async/await everywhere and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
