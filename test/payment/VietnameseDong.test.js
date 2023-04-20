// npx hardhat test ./test/payment/VietnameseDong.test.js --network hardhat
// npx hardhat coverage --testfiles ./test/payment/VietnameseDong.test.js --network hardhat

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers")
const { expect } = require("chai")
const { ethers } = require("hardhat")
const toBN = value => ethers.BigNumber.from(value.toString())

describe("VietnameseDong", () => {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function setupFixture() {
    // Contracts are deployed using the first signer/account by default
    const [accountOwner, account1, account2, accountUnauthorized] = await ethers.getSigners()

    const ControlCenter = await ethers.getContractFactory("ControlCenter")
    const ControlCenterInstance = await ControlCenter.deploy()

    const VietnameseDong = await ethers.getContractFactory("VietnameseDong")
    const VietnameseDongInstance = await VietnameseDong.deploy(ControlCenterInstance.address)

    return {
      ControlCenterInstance,
      VietnameseDongInstance,
      accountOwner,
      account1,
      account2,
      accountUnauthorized,
    }
  }

  describe("Deployment", () => {
    it('Should have token information', async () => {
      const { VietnameseDongInstance } = await loadFixture(setupFixture)
      expect(await VietnameseDongInstance.name()).to.equal('Vietnamese Dong')
      expect(await VietnameseDongInstance.symbol()).to.equal('VND')
      expect(await VietnameseDongInstance.decimals()).to.deep.equal(toBN('18'))
    })

    it("Should not have any tokens balance in account owner", async () => {
      const {
        VietnameseDongInstance,
        accountOwner,
      } = await loadFixture(setupFixture)
      const balanceOfOwner = await VietnameseDongInstance.balanceOf(accountOwner.address)
      expect(balanceOfOwner).to.deep.equal(ethers.constants.Zero)
    })

    it('Should have control center', async () => {
      const {
        VietnameseDongInstance,
        ControlCenterInstance,
      } = await loadFixture(setupFixture)
      expect(
        await VietnameseDongInstance.controlCenter()
      ).to.equal(ControlCenterInstance.address)
    })
  })

  describe("Mint", () => {
    it('Should revert when mint tokens for an account not has role Treasurer', async () => {
      const {
        VietnameseDongInstance,
        account1,
      } = await loadFixture(setupFixture)
      await expect(
        VietnameseDongInstance.connect(account1).mint(account1.address, ethers.constants.WeiPerEther)
      ).to.be.revertedWith('ControlCenter: TREASURER_ONLY')
    })

    it('Should revert when mint tokens for an account not whitelisted', async () => {
      const { VietnameseDongInstance, account1 } = await loadFixture(setupFixture)
      await expect(
        VietnameseDongInstance.mint(account1.address, ethers.constants.WeiPerEther)
      ).to.be.revertedWith('Whitelist: NOT_WHITELISTED')
    })

    it('Should mint tokens for an account in whitelist', async () => {
      const {
        ControlCenterInstance,
        VietnameseDongInstance,
        account1,
      } = await loadFixture(setupFixture)
      await expect(ControlCenterInstance.addToWhitelist(account1.address)).to.be.fulfilled
      await expect(VietnameseDongInstance.mint(account1.address, ethers.constants.WeiPerEther)).to.be.fulfilled
      expect(await VietnameseDongInstance.balanceOf(account1.address)).to.deep.equal(ethers.constants.WeiPerEther)
    })
  })

  describe("Burn", () => {
    it('Should revert burn tokens for an account not has role Treasurer', async () => {
      const {
        VietnameseDongInstance,
        account1,
      } = await loadFixture(setupFixture)
      await expect(
        VietnameseDongInstance.connect(account1).burn(account1.address, ethers.constants.WeiPerEther)
      ).to.be.revertedWith('ControlCenter: TREASURER_ONLY')
    })

    it('Should revert burn tokens for an account in blacklist', async () => {
      const {
        ControlCenterInstance,
        VietnameseDongInstance,
        account1,
      } = await loadFixture(setupFixture)
      await expect(ControlCenterInstance.addToWhitelist(account1.address)).to.be.fulfilled
      await expect(VietnameseDongInstance.mint(account1.address, ethers.constants.WeiPerEther)).to.be.fulfilled
      await expect(ControlCenterInstance.addToBlacklist(account1.address)).to.be.fulfilled
      await expect(
        VietnameseDongInstance.burn(account1.address, ethers.constants.WeiPerEther)
      ).to.be.revertedWith('Blacklist: BLACKLISTED')
    })

    it('Should burn tokens for an account not in blacklist', async () => {
      const {
        ControlCenterInstance,
        VietnameseDongInstance,
        account1,
      } = await loadFixture(setupFixture)
      await expect(ControlCenterInstance.addToWhitelist(account1.address)).to.be.fulfilled
      await expect(VietnameseDongInstance.mint(account1.address, ethers.constants.WeiPerEther)).to.be.fulfilled
      await VietnameseDongInstance.burn(account1.address, ethers.constants.WeiPerEther)
      expect(
        await VietnameseDongInstance.balanceOf(account1.address)
      ).to.deep.equal(ethers.constants.Zero)
    })
  })

  describe("Pausable", () => {
    it('Should revert mint when paused', async () => {
      const { VietnameseDongInstance, account1 } = await loadFixture(setupFixture)
      await expect(VietnameseDongInstance.pause()).to.be.fulfilled
      await expect(
        VietnameseDongInstance.mint(account1.address, ethers.constants.WeiPerEther)
      ).to.be.revertedWith('Pausable: paused')
    })

    it('Should revert burn when paused', async () => {
      const { VietnameseDongInstance, account1 } = await loadFixture(setupFixture)
      await expect(VietnameseDongInstance.pause()).to.be.fulfilled
      await expect(
        VietnameseDongInstance.burn(account1.address, ethers.constants.WeiPerEther)
      ).to.be.revertedWith('Pausable: paused')
    })

    it('Should mint and burn when unpause', async () => {
      const {
        ControlCenterInstance,
        VietnameseDongInstance,
        account1,
      } = await loadFixture(setupFixture)
      await expect(VietnameseDongInstance.pause()).to.be.fulfilled
      await expect(VietnameseDongInstance.unpause()).to.be.fulfilled
      await expect(ControlCenterInstance.addToWhitelist(account1.address)).to.be.fulfilled
      await expect(VietnameseDongInstance.mint(account1.address, ethers.constants.WeiPerEther)).to.be.fulfilled
      await VietnameseDongInstance.burn(account1.address, ethers.constants.WeiPerEther)
      expect(
        await VietnameseDongInstance.balanceOf(account1.address)
      ).to.deep.equal(ethers.constants.Zero)
    })
  })
})
