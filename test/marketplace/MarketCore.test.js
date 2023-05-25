// npx hardhat test ./test/marketplace/MarketCore.test.js --network hardhat
// npx hardhat coverage --testfiles ./test/marketplace/MarketCore.test.js --network hardhat

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers")
const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("MarketCore", () => {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function setupFixture() {
    // Contracts are deployed using the first signer/account by default
    const [
      accountOwner,
      accountUnauthorized,
    ] = await ethers.getSigners()

    const ControlCenter = await ethers.getContractFactory("ControlCenter")
    const ControlCenterInstance = await ControlCenter.deploy()

    const VietnameseDong = await ethers.getContractFactory("VietnameseDong")
    const VietnameseDongInstance = await VietnameseDong.deploy(ControlCenterInstance.address)

    const SharedNFT = await ethers.getContractFactory("SharedNFT")
    const SharedInstance = await SharedNFT.deploy(ControlCenterInstance.address)
    await SharedInstance.updateBaseURI('ipfs://')

    const Treasury = await ethers.getContractFactory("Treasury")
    const TreasuryInstance = await Treasury.deploy(
      ControlCenterInstance.address,
    )

    const Marketplace = await ethers.getContractFactory("Marketplace")
    const MarketplaceInstance = await Marketplace.deploy(
      ControlCenterInstance.address,
      TreasuryInstance.address,
    )
    await MarketplaceInstance.updatePaymentToken(VietnameseDongInstance.address, true)

    await ControlCenterInstance.addToWhitelist(MarketplaceInstance.address)
    await ControlCenterInstance.addToWhitelist(TreasuryInstance.address)
    await ControlCenterInstance.addToWhitelist(accountOwner.address)

    return {
      ControlCenterInstance,
      VietnameseDongInstance,
      SharedInstance,
      TreasuryInstance,
      MarketplaceInstance,
      accountOwner,
      accountUnauthorized,
    }
  }

  describe("Deployment", () => {
    it('Should have common variable state', async () => {
      const {
        MarketplaceInstance,
        ControlCenterInstance,
        TreasuryInstance,
      } = await loadFixture(setupFixture)
      expect(await MarketplaceInstance.controlCenter()).to.equal(ControlCenterInstance.address)
      expect(await MarketplaceInstance.treasury()).to.equal(TreasuryInstance.address)
      expect((await MarketplaceInstance.serviceFeePercent()).toString()).to.equal('125') // 1.25%
      expect(await MarketplaceInstance.deliveryDuration()).to.deep.equal(ethers.BigNumber.from('30').mul('24').mul('60').mul('60')) // 30 days
    })

    it('Should able to receiving ERC721', async () => {
      const { MarketplaceInstance, SharedInstance, accountOwner } = await loadFixture(setupFixture)
      const bytesData = ethers.utils.solidityKeccak256(
        ['string'],
        ['onERC721Received(address,address,uint256,bytes)']
      )
      const selectorERC721Received = await MarketplaceInstance.onERC721Received(
        accountOwner.address,
        MarketplaceInstance.address,
        ethers.constants.Zero,
        bytesData,
      )
      expect(selectorERC721Received).to.equal(bytesData.substring(0, 10))

      const tokenId = ethers.constants.Zero
      const hashedMetadata = ethers.utils.solidityKeccak256(
        ['string'],
        ['metadata of nft']
      )
      await SharedInstance.mint(hashedMetadata)
      await SharedInstance.transferFrom(
        accountOwner.address,
        MarketplaceInstance.address,
        tokenId,
      )
      expect(await SharedInstance.ownerOf(tokenId)).to.equal(MarketplaceInstance.address)
    })
  })

  describe("Payment Token", () => {
    it('Should update Payment Token', async () => {
      const {
        MarketplaceInstance,
      } = await loadFixture(setupFixture)
      const token = ethers.constants.AddressZero
      expect(await MarketplaceInstance.isPaymentToken(token)).to.equal(false)
      await MarketplaceInstance.updatePaymentToken(token, true)
      expect(await MarketplaceInstance.isPaymentToken(token)).to.equal(true)
    })

    it('Should revert when update Service Fee Percent by account unauthorized', async () => {
      const {
        MarketplaceInstance,
        accountUnauthorized,
      } = await loadFixture(setupFixture)
      const token = ethers.constants.AddressZero
      await expect(
        MarketplaceInstance.connect(accountUnauthorized).updatePaymentToken(token, true)
      ).to.be.revertedWith('ControlCenter: TREASURER_ONLY')
    })
  })


  describe("Service Fee", () => {
    it('Should update Service Fee Percent', async () => {
      const {
        MarketplaceInstance,
      } = await loadFixture(setupFixture)
      const newServiceFeePercent = ethers.constants.Two
      await MarketplaceInstance.updateServiceFeePercent(newServiceFeePercent)
      expect(await MarketplaceInstance.serviceFeePercent()).to.equal(newServiceFeePercent)
    })

    it('Should revert when update Service Fee Percent by account unauthorized', async () => {
      const {
        MarketplaceInstance,
        accountUnauthorized,
      } = await loadFixture(setupFixture)
      const newServiceFeePercent = ethers.constants.Two
      await expect(
        MarketplaceInstance.connect(accountUnauthorized).updateServiceFeePercent(newServiceFeePercent)
      ).to.be.revertedWith('ControlCenter: TREASURER_ONLY')
    })

    it('Should revert when update Service Fee Percent greater than 100%', async () => {
      const {
        MarketplaceInstance,
      } = await loadFixture(setupFixture)
      const newServiceFeePercent = ethers.BigNumber.from('10000')
      await expect(
        MarketplaceInstance.updateServiceFeePercent(newServiceFeePercent)
      ).to.be.revertedWith('MarketCore: FEE_TOO_HIGH')
    })
  })

  describe("Delivery Duration", () => {
    it('Should update Delivery Duration', async () => {
      const {
        MarketplaceInstance,
      } = await loadFixture(setupFixture)
      const newDeliveryDuration = ethers.constants.Two
      await MarketplaceInstance.updateDeliveryDuration(newDeliveryDuration)
      expect(await MarketplaceInstance.deliveryDuration()).to.equal(newDeliveryDuration)
    })

    it('Should revert when update Delivery Duration by account unauthorized', async () => {
      const {
        MarketplaceInstance,
        accountUnauthorized,
      } = await loadFixture(setupFixture)
      const newDeliveryDuration = ethers.constants.Two
      await expect(
        MarketplaceInstance.connect(accountUnauthorized).updateDeliveryDuration(newDeliveryDuration)
      ).to.be.revertedWith('ControlCenter: MODERATOR_ONLY')
    })
  })

  describe('Rescue random funds', () => {
    it('Should rescue random funds stuck', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
        TreasuryInstance,
      } = await loadFixture(setupFixture)
      const amountTransfer = ethers.utils.parseEther('10')
      const tokenStuck = VietnameseDongInstance.address
      await MarketplaceInstance.updatePaymentToken(tokenStuck, false)
      expect(await MarketplaceInstance.isPaymentToken(tokenStuck)).to.equal(false)
      await VietnameseDongInstance.mint(MarketplaceInstance.address, amountTransfer)
      const balanceOfTreasuryBefore = await VietnameseDongInstance.balanceOf(
        TreasuryInstance.address,
      )
      const balanceOfMarketBefore = await VietnameseDongInstance.balanceOf(
        MarketplaceInstance.address,
      )
      await MarketplaceInstance.inCaseTokensGetStuck(tokenStuck)
      const balanceOfMarketAfter = await VietnameseDongInstance.balanceOf(
        MarketplaceInstance.address,
      )
      const balanceOfTreasuryAfter = await VietnameseDongInstance.balanceOf(
        TreasuryInstance.address,
      )
      expect(
        balanceOfTreasuryAfter.sub(balanceOfTreasuryBefore)
      ).to.deep.equal(
        balanceOfMarketBefore.sub(balanceOfMarketAfter)
      ).to.deep.equal(amountTransfer)
    })

    it('Should revert when rescue random funds stuck by account unauthorized', async () => {
      const {
        MarketplaceInstance,
        accountUnauthorized,
      } = await loadFixture(setupFixture)
      const tokenStuck = ethers.constants.AddressZero
      await expect(
        MarketplaceInstance.connect(accountUnauthorized).inCaseTokensGetStuck(tokenStuck)
      ).to.be.revertedWith('ControlCenter: TREASURER_ONLY')
    })

    it('Should revert when rescue a token payment', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
      } = await loadFixture(setupFixture)
      const token = VietnameseDongInstance.address
      await expect(
        MarketplaceInstance.inCaseTokensGetStuck(token)
      ).to.be.revertedWith('MarketCore: STUCK_TOKEN_ONLY')
    })
  })

  describe("Pausable", () => {
    it('Should pause and unpause', async () => {
      const { MarketplaceInstance } = await loadFixture(setupFixture)
      await expect(MarketplaceInstance.pause()).to.be.fulfilled
      await expect(MarketplaceInstance.unpause()).to.be.fulfilled
    })

    it('Should revert when pause by account unauthorized', async () => {
      const {
        MarketplaceInstance,
        accountUnauthorized,
      } = await loadFixture(setupFixture)
      await expect(
        MarketplaceInstance
          .connect(accountUnauthorized)
          .pause()
      ).to.be.revertedWith('ControlCenter: MODERATOR_ONLY')
    })

    it('Should revert when unpause by account unauthorized', async () => {
      const {
        MarketplaceInstance,
        accountUnauthorized,
      } = await loadFixture(setupFixture)
      await expect(MarketplaceInstance.pause()).to.be.fulfilled
      await expect(
        MarketplaceInstance
          .connect(accountUnauthorized)
          .unpause()
      ).to.be.revertedWith('ControlCenter: MODERATOR_ONLY')
    })
  })
})
