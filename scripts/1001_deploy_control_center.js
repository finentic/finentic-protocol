// npx hardhat run scripts/1001_deploy_control_center.js --network fuji
// npx hardhat verify ControlCenter@0x63Ed19D06bADBBcBED27343959a10Aff31E73304 --network fuji

const { ethers, run } = require("hardhat")

async function main() {
  const [accountOwner] = await ethers.getSigners()
  console.log('Owner: ', accountOwner.address)

  const ControlCenter = await ethers.getContractFactory("ControlCenter")
  const ControlCenterInstance = await ControlCenter.deploy()
  await ControlCenterInstance.deployed()

  console.log(`Control Center deployed to ${ControlCenterInstance.address}`)

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
