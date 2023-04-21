// npx hardhat run scripts/1002_deploy_vietnamese_dong.js --network fuji
// npx hardhat verify VietnameseDong@0x34a25677f3BE20Ec75E0F07472E6b4BE13365691 --network fuji

const { ethers, run } = require("hardhat")
const ADDRESSES = {
  CONTROL_CENTER: '0x63Ed19D06bADBBcBED27343959a10Aff31E73304'
}

async function main() {
  const [accountOwner] = await ethers.getSigners()
  console.log('Owner: ', accountOwner.address)

  const VietnameseDong = await ethers.getContractFactory("VietnameseDong")
  const paramsVietnameseDong = [ADDRESSES.CONTROL_CENTER]
  const VietnameseDongInstance = await VietnameseDong.deploy(...paramsVietnameseDong)
  await VietnameseDongInstance.deployed()

  console.log(`VietnameseDong deployed to ${VietnameseDongInstance.address}`)

  // Verify contract
  try {
    await run("verify:verify", {
      contract: "contracts/payment/VietnameseDong.sol:VietnameseDong",
      address: VietnameseDongInstance.address,
      constructorArguments: paramsVietnameseDong,
    })
  } catch (error) { console.info(error) }
}

// We recommend this pattern to be able to use async/await everywhere and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
