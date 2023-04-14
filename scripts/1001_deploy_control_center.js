// npx hardhat run scripts/1001_deploy_control_center.js --network fuji
// npx hardhat verify ControlCenter@0x33801353c0810C09Dd15EeA23CcBE56856B021D2 --network fuji

const { ethers, run } = require("hardhat")

async function main() {
  const [accountOwner] = await ethers.getSigners()
  console.log('Owner: ', accountOwner.address)

  const ControlCenter = await ethers.getContractFactory("ControlCenter")
  const ControlCenterInstance = await ControlCenter.deploy()
  await ControlCenterInstance.deployed()

  console.log(`ControlCenter deployed to ${ControlCenterInstance.address}`)

  // Verify contract
  try {
    await run("verify:verify", {
      contract: "contracts/access/ControlCenter.sol:ControlCenter",
      address: ControlCenterInstance.address,
    })
  } catch (error) { console.info(error) }
}

// We recommend this pattern to be able to use async/await everywhere and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
