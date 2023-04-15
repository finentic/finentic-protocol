// npx hardhat run scripts/1002_deploy_vietnamese_dong.js --network fuji
// npx hardhat verify VietnameseDong@0x8A6Dc74b8a8815E44ed492fB711fB5a83A9Fe863 --network fuji

const { ethers, run } = require("hardhat")
const ADDRESSES = {
  CONTROL_CENTER: '0x33801353c0810C09Dd15EeA23CcBE56856B021D2'
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
