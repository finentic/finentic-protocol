// npx hardhat run scripts/1004_deploy_collection_implementation.js --network fuji
// npx hardhat verify Collection@0x1C72E9DC564bd7a25da72FF66797De8679e27F4D --network fuji

const { ethers, run } = require("hardhat")

async function main() {
  const [accountOwner] = await ethers.getSigners()
  console.log('Owner: ', accountOwner.address)

  const Collection = await ethers.getContractFactory("Collection")
  const CollectionInstance = await Collection.deploy()
  await CollectionInstance.deployed()

  console.log(`NFT Collection Implementation deployed to ${CollectionInstance.address}`)

  // Verify contract
  try {
    await run("verify:verify", {
      contract: "contracts/nft/Collection.sol:NFTCollectionImplementation",
      address: CollectionInstance.address,
    })
  } catch (error) { console.info(error) }
}

// We recommend this pattern to be able to use async/await everywhere and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
