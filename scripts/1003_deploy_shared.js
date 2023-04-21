// npx hardhat run scripts/1003_deploy_shared.js --network fuji
// npx hardhat verify Shared@0x6fCa3D791aE84333f6CfBa97518E201C6DFD4830 --network fuji

const { ethers, run } = require("hardhat")
const ADDRESSES = {
  CONTROL_CENTER: '0x63Ed19D06bADBBcBED27343959a10Aff31E73304'
}

async function main() {
  const [accountOwner] = await ethers.getSigners()
  console.log('Owner: ', accountOwner.address)

  const paramsShared = [ADDRESSES.CONTROL_CENTER]
  const Shared = await ethers.getContractFactory("Shared")
  const SharedInstance = await Shared.deploy(...paramsShared)
  await SharedInstance.deployed()

  console.log(`Finentic Shared NFT deployed to ${SharedInstance.address}`)

  // Verify contract
  try {
    await run("verify:verify", {
      contract: "contracts/nft/Shared.sol:Shared",
      address: SharedInstance.address,
      constructorArguments: paramsShared,
    })
  } catch (error) { console.info(error) }
}

// We recommend this pattern to be able to use async/await everywhere and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
