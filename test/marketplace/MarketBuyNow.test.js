// npx hardhat test ./test/marketplace/MarketBuyNow.test.js --network hardhat
// npx hardhat coverage --testfiles ./test/marketplace/MarketBuyNow.test.js --network hardhat

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers")
const { expect } = require("chai")
const { ethers } = require("hardhat")
const { setNextBlockTimestamp } = require("../utils/helpers")

describe("MarketBuyNow", () => {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function setupFixture() {
    // Contracts are deployed using the first signer/account by default
    const [
      accountOwner,
      accountSeller,
      accountBuyer,
      accountUnauthorized,
    ] = await ethers.getSigners()

    const ControlCenter = await ethers.getContractFactory("ControlCenter")
    const ControlCenterInstance = await ControlCenter.deploy()

    const VietnameseDong = await ethers.getContractFactory("VietnameseDong")
    const VietnameseDongInstance = await VietnameseDong.deploy(ControlCenterInstance.address)

    const CollectionImplementation = await ethers.getContractFactory("Collection")
    const CollectionImplementationInstance = await CollectionImplementation.deploy()

    const CollectionFactory = await ethers.getContractFactory("CollectionFactory")
    const CollectionFactoryInstance = await CollectionFactory.deploy(
      ControlCenterInstance.address,
      CollectionImplementationInstance.address,
    )

    const Shared = await ethers.getContractFactory("Shared")
    const SharedInstance = await Shared.deploy(ControlCenterInstance.address)
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
    await ControlCenterInstance.addToWhitelist(accountSeller.address)
    await ControlCenterInstance.addToWhitelist(accountBuyer.address)

    await VietnameseDongInstance.mint(accountOwner.address, ethers.utils.parseEther('1000000000'))
    await VietnameseDongInstance.mint(accountBuyer.address, ethers.utils.parseEther('1000000000'))
    await VietnameseDongInstance.mint(accountSeller.address, ethers.utils.parseEther('1000000000'))

    const collectionParams = [
      accountSeller.address, // address creator
      'Finentic First Collection', // string calldata name
      'FC-NFT', // string calldata symbol
      'ipfs://', //string calldata baseURI
    ]
    const collectionAddress = await CollectionFactoryInstance
      .callStatic
      .createCollection(...collectionParams)
    await CollectionFactoryInstance.createCollection(...collectionParams)
    const CollectionInstance = await ethers.getContractAt('Collection', collectionAddress)

    const hashedMetadata = ethers.utils.solidityKeccak256(['string'], ['metadata of nft'])
    await CollectionInstance.connect(accountSeller).mint(accountSeller.address, hashedMetadata)

    return {
      ControlCenterInstance,
      VietnameseDongInstance,
      CollectionFactoryInstance,
      CollectionInstance,
      SharedInstance,
      TreasuryInstance,
      MarketplaceInstance,
      accountOwner,
      accountSeller,
      accountBuyer,
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
      expect(await MarketplaceInstance.serviceFeePercent()).to.equal(ethers.constants.One)
      expect(await MarketplaceInstance.deliveryDuration()).to.deep.equal(ethers.BigNumber.from('2').mul('7').mul('24').mul('60').mul('60'))
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
      await SharedInstance.mint(accountOwner.address, hashedMetadata)
      await SharedInstance.transferFrom(
        accountOwner.address,
        MarketplaceInstance.address,
        tokenId,
      )
      expect(await SharedInstance.ownerOf(tokenId)).to.equal(MarketplaceInstance.address)
    })
  })

  describe("Buy Now", () => {
    it('Should list for Buy Now', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
        CollectionInstance,
        accountSeller
      } = await loadFixture(setupFixture)
      const tokenId = ethers.constants.Zero
      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await MarketplaceInstance.connect(accountSeller).listForBuyNow(
        CollectionInstance.address,
        tokenId,
        false,
        VietnameseDongInstance.address,
        ethers.utils.parseEther('50000000')
      )
      const itemListed = await MarketplaceInstance.itemBuyNow(
        CollectionInstance.address,
        tokenId,
      )
      expect(itemListed.seller).to.equal(accountSeller.address)
      expect(itemListed.buyer).to.equal(ethers.constants.AddressZero)
      expect(itemListed.isPhygital).to.equal(false)
      expect(itemListed.paymentToken).to.equal(VietnameseDongInstance.address)
      expect(itemListed.price).to.deep.equal(ethers.utils.parseEther('50000000'))
    })

    it('Should revert when list for Buy Now with payment token unaccepted', async () => {
      const {
        MarketplaceInstance,
        CollectionInstance,
        accountSeller
      } = await loadFixture(setupFixture)
      const tokenId = ethers.constants.Zero
      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await expect(
        MarketplaceInstance.connect(accountSeller).listForBuyNow(
          CollectionInstance.address,
          tokenId,
          false,
          accountSeller.address,
          ethers.utils.parseEther('50000000')
        )
      ).to.be.revertedWith('Marketplace: UNACCEPTED_TOKEN')
    })

    it('Should revert list for Buy Now when paused', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
        CollectionInstance,
        accountSeller
      } = await loadFixture(setupFixture)
      const tokenId = ethers.constants.Zero
      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await MarketplaceInstance.pause()
      await expect(
        MarketplaceInstance.connect(accountSeller).listForBuyNow(
          CollectionInstance.address,
          tokenId,
          false,
          VietnameseDongInstance.address,
          ethers.utils.parseEther('50000000')
        )
      ).to.be.revertedWith('Pausable: paused')
    })

    it('Should able to update Buy Now item', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
        CollectionInstance,
        accountSeller
      } = await loadFixture(setupFixture)
      const tokenId = ethers.constants.Zero
      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await MarketplaceInstance.connect(accountSeller).listForBuyNow(
        CollectionInstance.address,
        tokenId,
        false,
        VietnameseDongInstance.address,
        ethers.utils.parseEther('50000000')
      )
      await expect(
        MarketplaceInstance.connect(accountSeller).updateItemForBuyNow(
          CollectionInstance.address,
          tokenId,
          accountSeller.address,
          ethers.utils.parseEther('10000000')
        )
      ).to.be.revertedWith('Marketplace: UNACCEPTED_TOKEN')
      await MarketplaceInstance.connect(accountSeller).updateItemForBuyNow(
        CollectionInstance.address,
        tokenId,
        VietnameseDongInstance.address,
        ethers.utils.parseEther('10000000')
      )
      const itemListed = await MarketplaceInstance.itemBuyNow(
        CollectionInstance.address,
        tokenId,
      )
      expect(itemListed.seller).to.equal(accountSeller.address)
      expect(itemListed.buyer).to.equal(ethers.constants.AddressZero)
      expect(itemListed.isPhygital).to.equal(false)
      expect(itemListed.paymentToken).to.equal(VietnameseDongInstance.address)
      expect(itemListed.price).to.deep.equal(ethers.utils.parseEther('10000000'))
    })

    it('Should revert update Buy Now item by account unauthorized', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
        CollectionInstance,
        accountSeller,
        accountUnauthorized
      } = await loadFixture(setupFixture)
      const tokenId = ethers.constants.Zero
      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await MarketplaceInstance.connect(accountSeller).listForBuyNow(
        CollectionInstance.address,
        tokenId,
        false,
        VietnameseDongInstance.address,
        ethers.utils.parseEther('50000000')
      )
      await expect(
        MarketplaceInstance.connect(accountUnauthorized).updateItemForBuyNow(
          CollectionInstance.address,
          tokenId,
          VietnameseDongInstance.address,
          ethers.utils.parseEther('10000000')
        )
      ).to.be.revertedWith('Marketplace: FORBIDDEN')
    })


    it('Should revert update Buy Now item sold', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
        CollectionInstance,
        accountSeller,
        accountBuyer
      } = await loadFixture(setupFixture)
      const tokenId = ethers.constants.Zero
      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await MarketplaceInstance.connect(accountSeller).listForBuyNow(
        CollectionInstance.address,
        tokenId,
        true,
        VietnameseDongInstance.address,
        ethers.utils.parseEther('50000000')
      )
      await VietnameseDongInstance
        .connect(accountBuyer)
        .approve(MarketplaceInstance.address, ethers.constants.MaxUint256)
      await MarketplaceInstance
        .connect(accountBuyer)
        .buyNow(CollectionInstance.address, tokenId)
      await expect(
        MarketplaceInstance.connect(accountSeller).updateItemForBuyNow(
          CollectionInstance.address,
          tokenId,
          VietnameseDongInstance.address,
          ethers.utils.parseEther('50000000')
        )
      ).to.be.revertedWith('Marketplace: SOLD')
    })

    it('Should able to buy a Buy Now item', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
        TreasuryInstance,
        CollectionInstance,
        accountSeller,
        accountBuyer,
      } = await loadFixture(setupFixture)
      const tokenId = ethers.constants.Zero
      const price = ethers.utils.parseEther('50000000')
      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await MarketplaceInstance.connect(accountSeller).listForBuyNow(
        CollectionInstance.address,
        tokenId,
        false,
        VietnameseDongInstance.address,
        price
      )
      const balanceOfAccountBuyerBefore = await VietnameseDongInstance.balanceOf(accountBuyer.address)
      const balanceOfAccountSellerBefore = await VietnameseDongInstance.balanceOf(accountSeller.address)
      const serviceFeePercent = await MarketplaceInstance.serviceFeePercent()
      const PERCENTAGE = await MarketplaceInstance.PERCENTAGE()

      await VietnameseDongInstance
        .connect(accountBuyer)
        .approve(MarketplaceInstance.address, ethers.constants.MaxUint256)
      await MarketplaceInstance
        .connect(accountBuyer)
        .buyNow(CollectionInstance.address, tokenId)

      const balanceOfTreasury = await VietnameseDongInstance.balanceOf(TreasuryInstance.address)
      const balanceOfAccountBuyerAfter = await VietnameseDongInstance.balanceOf(accountBuyer.address)
      const balanceOfAccountSellerAfter = await VietnameseDongInstance.balanceOf(accountSeller.address)
      expect(await CollectionInstance.ownerOf(ethers.constants.Zero)).to.equal(accountBuyer.address)
      expect(balanceOfTreasury).to.deep.equal(price.mul(serviceFeePercent).div(PERCENTAGE))
      expect(balanceOfAccountBuyerBefore.sub(balanceOfAccountBuyerAfter)).to.deep.equal(price)
      expect(balanceOfAccountSellerAfter.sub(balanceOfAccountSellerBefore)).to.deep.equal(price.sub(price.mul(serviceFeePercent).div(PERCENTAGE)))
    })

    it('Should revert buy a Buy Now item when paused', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
        CollectionInstance,
        accountSeller,
        accountBuyer,
      } = await loadFixture(setupFixture)
      const tokenId = ethers.constants.Zero
      const price = ethers.utils.parseEther('50000000')
      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await MarketplaceInstance.connect(accountSeller).listForBuyNow(
        CollectionInstance.address,
        tokenId,
        false,
        VietnameseDongInstance.address,
        price
      )
      await VietnameseDongInstance
        .connect(accountBuyer)
        .approve(MarketplaceInstance.address, ethers.constants.MaxUint256)
      await MarketplaceInstance.pause()
      await expect(
        MarketplaceInstance
          .connect(accountBuyer)
          .buyNow(CollectionInstance.address, tokenId)
      ).to.be.revertedWith('Pausable: paused')
    })

    it('Should able to cancel listing a Buy Now item by seller', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
        CollectionInstance,
        accountSeller,
      } = await loadFixture(setupFixture)
      const tokenId = ethers.constants.Zero
      const price = ethers.utils.parseEther('50000000')
      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await MarketplaceInstance.connect(accountSeller).listForBuyNow(
        CollectionInstance.address,
        tokenId,
        false,
        VietnameseDongInstance.address,
        price
      )
      await MarketplaceInstance
        .connect(accountSeller)
        .cancelListItemForBuyNow(CollectionInstance.address, tokenId)
      expect(await CollectionInstance.ownerOf(ethers.constants.Zero)).to.equal(accountSeller.address)
    })

    it('Should revert when cancel listing a Buy Now item by account unauthorized', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
        CollectionInstance,
        accountSeller,
        accountUnauthorized
      } = await loadFixture(setupFixture)
      const tokenId = ethers.constants.Zero
      const price = ethers.utils.parseEther('50000000')
      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await MarketplaceInstance.connect(accountSeller).listForBuyNow(
        CollectionInstance.address,
        tokenId,
        false,
        VietnameseDongInstance.address,
        price
      )
      await expect(
        MarketplaceInstance
          .connect(accountUnauthorized)
          .cancelListItemForBuyNow(CollectionInstance.address, tokenId)
      ).to.be.revertedWith('Marketplace: FORBIDDEN')
    })
  })

  describe("Buy Now NFT Phygital", () => {
    it('Should list for Buy Now', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
        CollectionInstance,
        accountSeller
      } = await loadFixture(setupFixture)
      const tokenId = ethers.constants.Zero
      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await MarketplaceInstance.connect(accountSeller).listForBuyNow(
        CollectionInstance.address,
        tokenId,
        true,
        VietnameseDongInstance.address,
        ethers.utils.parseEther('50000000')
      )
      const itemListed = await MarketplaceInstance.itemBuyNow(
        CollectionInstance.address,
        tokenId,
      )
      expect(itemListed.seller).to.equal(accountSeller.address)
      expect(itemListed.buyer).to.equal(ethers.constants.AddressZero)
      expect(itemListed.isPhygital).to.equal(true)
      expect(itemListed.paymentToken).to.equal(VietnameseDongInstance.address)
      expect(itemListed.price).to.deep.equal(ethers.utils.parseEther('50000000'))
    })

    it('Should able to buy a Buy Now item', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
        CollectionInstance,
        accountSeller,
        accountBuyer,
      } = await loadFixture(setupFixture)
      const tokenId = ethers.constants.Zero
      const price = ethers.utils.parseEther('50000000')
      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await MarketplaceInstance.connect(accountSeller).listForBuyNow(
        CollectionInstance.address,
        tokenId,
        true,
        VietnameseDongInstance.address,
        price
      )
      const balanceOfAccountBuyerBefore = await VietnameseDongInstance.balanceOf(accountBuyer.address)
      await VietnameseDongInstance
        .connect(accountBuyer)
        .approve(MarketplaceInstance.address, ethers.constants.MaxUint256)
      await MarketplaceInstance
        .connect(accountBuyer)
        .buyNow(CollectionInstance.address, tokenId)
      const balanceOfAccountBuyerAfter = await VietnameseDongInstance.balanceOf(accountBuyer.address)
      const itemListed = await MarketplaceInstance.itemBuyNow(
        CollectionInstance.address,
        tokenId,
      )
      expect(balanceOfAccountBuyerBefore.sub(balanceOfAccountBuyerAfter)).to.deep.equal(price)
      expect(itemListed.buyer).to.equal(accountBuyer.address)
    })

    it('Should revert when buy a Buy Now item is sold', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
        CollectionInstance,
        accountSeller,
        accountBuyer,
      } = await loadFixture(setupFixture)
      const tokenId = ethers.constants.Zero
      const price = ethers.utils.parseEther('50000000')
      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await MarketplaceInstance.connect(accountSeller).listForBuyNow(
        CollectionInstance.address,
        tokenId,
        true,
        VietnameseDongInstance.address,
        price
      )
      await VietnameseDongInstance
        .connect(accountBuyer)
        .approve(MarketplaceInstance.address, ethers.constants.MaxUint256)
      await MarketplaceInstance
        .connect(accountBuyer)
        .buyNow(CollectionInstance.address, tokenId)

      await expect(
        MarketplaceInstance
          .connect(accountBuyer)
          .buyNow(CollectionInstance.address, tokenId)
      ).to.be.revertedWith('Marketplace: SOLD')
    })

    it('Should able to confirm receive a Buy Now item', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
        CollectionInstance,
        TreasuryInstance,
        accountSeller,
        accountBuyer,
      } = await loadFixture(setupFixture)
      const tokenId = ethers.constants.Zero
      const price = ethers.utils.parseEther('50000000')
      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await MarketplaceInstance.connect(accountSeller).listForBuyNow(
        CollectionInstance.address,
        tokenId,
        true,
        VietnameseDongInstance.address,
        price
      )

      const balanceOfAccountBuyerBefore = await VietnameseDongInstance.balanceOf(accountBuyer.address)
      const balanceOfAccountSellerBefore = await VietnameseDongInstance.balanceOf(accountSeller.address)
      const serviceFeePercent = await MarketplaceInstance.serviceFeePercent()
      const PERCENTAGE = await MarketplaceInstance.PERCENTAGE()
      await VietnameseDongInstance
        .connect(accountBuyer)
        .approve(MarketplaceInstance.address, ethers.constants.MaxUint256)
      await MarketplaceInstance
        .connect(accountBuyer)
        .buyNow(CollectionInstance.address, tokenId)
      await MarketplaceInstance
        .connect(accountBuyer)
        .confirmReceivedItemBuyNow(CollectionInstance.address, tokenId)

      const balanceOfTreasury = await VietnameseDongInstance.balanceOf(TreasuryInstance.address)
      const balanceOfAccountBuyerAfter = await VietnameseDongInstance.balanceOf(accountBuyer.address)
      const balanceOfAccountSellerAfter = await VietnameseDongInstance.balanceOf(accountSeller.address)
      expect(await CollectionInstance.ownerOf(ethers.constants.Zero)).to.equal(accountBuyer.address)
      expect(balanceOfTreasury).to.deep.equal(price.mul(serviceFeePercent).div(PERCENTAGE))
      expect(balanceOfAccountBuyerBefore.sub(balanceOfAccountBuyerAfter)).to.deep.equal(price)
      expect(balanceOfAccountSellerAfter.sub(balanceOfAccountSellerBefore)).to.deep.equal(price.sub(price.mul(serviceFeePercent).div(PERCENTAGE)))
    })

    it('Should revert when confirm receive a Buy Now item by account unauthorized', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
        CollectionInstance,
        accountSeller,
        accountBuyer,
        accountUnauthorized
      } = await loadFixture(setupFixture)
      const tokenId = ethers.constants.Zero
      const price = ethers.utils.parseEther('50000000')
      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await MarketplaceInstance.connect(accountSeller).listForBuyNow(
        CollectionInstance.address,
        tokenId,
        true,
        VietnameseDongInstance.address,
        price
      )
      await VietnameseDongInstance
        .connect(accountBuyer)
        .approve(MarketplaceInstance.address, ethers.constants.MaxUint256)
      await MarketplaceInstance
        .connect(accountBuyer)
        .buyNow(CollectionInstance.address, tokenId)
      await expect(
        MarketplaceInstance
          .connect(accountUnauthorized)
          .confirmReceivedItemBuyNow(CollectionInstance.address, tokenId)
      ).to.be.revertedWith('Marketplace: FORBIDDEN')
    })

    it('Should revert when confirm receive a Buy Now item is listing', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
        CollectionInstance,
        accountSeller,
        accountBuyer,
        accountUnauthorized
      } = await loadFixture(setupFixture)
      const tokenId = ethers.constants.Zero
      const price = ethers.utils.parseEther('50000000')
      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await MarketplaceInstance.connect(accountSeller).listForBuyNow(
        CollectionInstance.address,
        tokenId,
        true,
        VietnameseDongInstance.address,
        price
      )
      await VietnameseDongInstance
        .connect(accountBuyer)
        .approve(MarketplaceInstance.address, ethers.constants.MaxUint256)
      await expect(
        MarketplaceInstance
          .connect(accountUnauthorized)
          .confirmReceivedItemBuyNow(CollectionInstance.address, tokenId)
      ).to.be.revertedWith('Marketplace: UNSOLD')
    })

    it('Should revert when confirm receive a Buy Now item is overdue the next update deadline', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
        CollectionInstance,
        accountSeller,
        accountBuyer,
        accountUnauthorized
      } = await loadFixture(setupFixture)
      const tokenId = ethers.constants.Zero
      const price = ethers.utils.parseEther('50000000')
      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await MarketplaceInstance.connect(accountSeller).listForBuyNow(
        CollectionInstance.address,
        tokenId,
        true,
        VietnameseDongInstance.address,
        price
      )
      await VietnameseDongInstance
        .connect(accountBuyer)
        .approve(MarketplaceInstance.address, ethers.constants.MaxUint256)
      await MarketplaceInstance
        .connect(accountBuyer)
        .buyNow(CollectionInstance.address, tokenId)
      const phygitalItem = await MarketplaceInstance.phygitalItem(CollectionInstance.address, tokenId)
      await setNextBlockTimestamp(phygitalItem.nextUpdateDeadline.add('1'))
      await expect(
        MarketplaceInstance
          .connect(accountUnauthorized)
          .confirmReceivedItemBuyNow(CollectionInstance.address, tokenId)
      ).to.be.revertedWith('Marketplace: OVERDUE')
    })

    it('Should able to cancel a Buy Now item by buyer', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
        CollectionInstance,
        accountSeller,
        accountBuyer,
      } = await loadFixture(setupFixture)
      const tokenId = ethers.constants.Zero
      const price = ethers.utils.parseEther('50000000')
      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await MarketplaceInstance.connect(accountSeller).listForBuyNow(
        CollectionInstance.address,
        tokenId,
        true,
        VietnameseDongInstance.address,
        price
      )
      const balanceOfAccountBuyerBefore = await VietnameseDongInstance.balanceOf(accountBuyer.address)
      const balanceOfAccountSellerBefore = await VietnameseDongInstance.balanceOf(accountSeller.address)
      await VietnameseDongInstance
        .connect(accountBuyer)
        .approve(MarketplaceInstance.address, ethers.constants.MaxUint256)
      await MarketplaceInstance
        .connect(accountBuyer)
        .buyNow(CollectionInstance.address, tokenId)
      await MarketplaceInstance
        .connect(accountBuyer)
        .cancelItemBuyNow(CollectionInstance.address, tokenId)

      const balanceOfAccountBuyerAfter = await VietnameseDongInstance.balanceOf(accountBuyer.address)
      const balanceOfAccountSellerAfter = await VietnameseDongInstance.balanceOf(accountSeller.address)
      expect(await CollectionInstance.ownerOf(ethers.constants.Zero)).to.equal(accountSeller.address)
      expect(balanceOfAccountBuyerBefore).to.deep.equal(balanceOfAccountBuyerAfter)
      expect(balanceOfAccountSellerAfter).to.deep.equal(balanceOfAccountSellerBefore)
    })


    it('Should able to cancel a Buy Now item by seller', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
        CollectionInstance,
        accountSeller,
        accountBuyer,
      } = await loadFixture(setupFixture)
      const tokenId = ethers.constants.Zero
      const price = ethers.utils.parseEther('50000000')
      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await MarketplaceInstance.connect(accountSeller).listForBuyNow(
        CollectionInstance.address,
        tokenId,
        true,
        VietnameseDongInstance.address,
        price
      )
      const balanceOfAccountBuyerBefore = await VietnameseDongInstance.balanceOf(accountBuyer.address)
      const balanceOfAccountSellerBefore = await VietnameseDongInstance.balanceOf(accountSeller.address)
      await VietnameseDongInstance
        .connect(accountBuyer)
        .approve(MarketplaceInstance.address, ethers.constants.MaxUint256)
      await MarketplaceInstance
        .connect(accountBuyer)
        .buyNow(CollectionInstance.address, tokenId)
      await MarketplaceInstance
        .connect(accountSeller)
        .cancelItemBuyNow(CollectionInstance.address, tokenId)

      const balanceOfAccountBuyerAfter = await VietnameseDongInstance.balanceOf(accountBuyer.address)
      const balanceOfAccountSellerAfter = await VietnameseDongInstance.balanceOf(accountSeller.address)
      expect(await CollectionInstance.ownerOf(ethers.constants.Zero)).to.equal(accountSeller.address)
      expect(balanceOfAccountBuyerBefore).to.deep.equal(balanceOfAccountBuyerAfter)
      expect(balanceOfAccountSellerAfter).to.deep.equal(balanceOfAccountSellerBefore)
    })

    it('Should revert when cancel a Buy Now item is unsold', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
        CollectionInstance,
        accountSeller,
      } = await loadFixture(setupFixture)
      const tokenId = ethers.constants.Zero
      const price = ethers.utils.parseEther('50000000')
      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await MarketplaceInstance.connect(accountSeller).listForBuyNow(
        CollectionInstance.address,
        tokenId,
        true,
        VietnameseDongInstance.address,
        price
      )
      await expect(
        MarketplaceInstance
          .connect(accountSeller)
          .cancelItemBuyNow(CollectionInstance.address, tokenId)
      ).to.be.revertedWith('Marketplace: UNSOLD')
    })

    it('Should revert when cancel a Buy Now item by account unauthorized', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
        CollectionInstance,
        accountSeller,
        accountBuyer,
        accountUnauthorized
      } = await loadFixture(setupFixture)
      const tokenId = ethers.constants.Zero
      const price = ethers.utils.parseEther('50000000')
      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await MarketplaceInstance.connect(accountSeller).listForBuyNow(
        CollectionInstance.address,
        tokenId,
        true,
        VietnameseDongInstance.address,
        price
      )
      await VietnameseDongInstance
        .connect(accountBuyer)
        .approve(MarketplaceInstance.address, ethers.constants.MaxUint256)
      await MarketplaceInstance
        .connect(accountBuyer)
        .buyNow(CollectionInstance.address, tokenId)
      await expect(
        MarketplaceInstance
          .connect(accountUnauthorized)
          .cancelItemBuyNow(CollectionInstance.address, tokenId)
      ).to.be.revertedWith('Marketplace: FORBIDDEN')
    })

    it('Should revert when cancel listing a Buy Now item is not listing', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
        CollectionInstance,
        accountSeller,
        accountBuyer,
      } = await loadFixture(setupFixture)
      const tokenId = ethers.constants.Zero
      const price = ethers.utils.parseEther('50000000')
      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await MarketplaceInstance.connect(accountSeller).listForBuyNow(
        CollectionInstance.address,
        tokenId,
        true,
        VietnameseDongInstance.address,
        price
      )
      await VietnameseDongInstance
        .connect(accountBuyer)
        .approve(MarketplaceInstance.address, ethers.constants.MaxUint256)
      await MarketplaceInstance
        .connect(accountBuyer)
        .buyNow(CollectionInstance.address, tokenId)
      await expect(
        MarketplaceInstance
          .connect(accountSeller)
          .cancelListItemForBuyNow(CollectionInstance.address, tokenId)
      ).to.be.revertedWith('Marketplace: SOLD')
    })
  })
})