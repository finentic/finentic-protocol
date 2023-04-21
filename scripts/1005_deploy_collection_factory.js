// npx hardhat run scripts/1005_deploy_collection_factory.js --network fuji
// npx hardhat verify CollectionFactory@0xaf18dAB0b3f2B412c4176e95bA65000dd2bb0a66 --network fuji

const { ethers, run } = require("hardhat")
const ADDRESSES = {
  CONTROL_CENTER: '0x63Ed19D06bADBBcBED27343959a10Aff31E73304',
  COLLECTION_IMPLEMENTATION: '0x16955BC17a69F75F808A57177705Cf81b2D5C492',
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
      contract: "contracts/nft/CollectionFactory.sol:CollectionFactory",
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
