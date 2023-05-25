// npx hardhat test ./test/marketplace/MarketListed.test.js --network hardhat
// npx hardhat coverage --testfiles ./test/marketplace/MarketListed.test.js --network hardhat

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers")
const { expect } = require("chai")
const { ethers } = require("hardhat")
const { setNextBlockTimestamp, getBlockTimestamp } = require("../utils/helpers")

describe("MarketListed", () => {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function setupFixture() {
    // Contracts are deployed using the first signer/account by default
    const [
      accountOwner,
      accountSeller,
      accountBidder,
      accountBidder2,
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
    await ControlCenterInstance.addToWhitelist(accountSeller.address)
    await ControlCenterInstance.addToWhitelist(accountBidder.address)
    await ControlCenterInstance.addToWhitelist(accountBidder2.address)

    await VietnameseDongInstance.mint(accountOwner.address, ethers.utils.parseEther('1000000000'))
    await VietnameseDongInstance.mint(accountBidder.address, ethers.utils.parseEther('1000000000'))
    await VietnameseDongInstance.mint(accountBidder2.address, ethers.utils.parseEther('1000000000'))
    await VietnameseDongInstance.mint(accountSeller.address, ethers.utils.parseEther('1000000000'))

    const collectionParams = [
      accountSeller.address, // address creator
      'Finentic First Collection', // string calldata name
      'FFC', // string calldata symbol
      'ipfs://', //string calldata baseURI
    ]
    const collectionAddress = await CollectionFactoryInstance
      .callStatic
      .createCollection(...collectionParams)
    await CollectionFactoryInstance.createCollection(...collectionParams)
    const CollectionInstance = await ethers.getContractAt('Collection', collectionAddress)

    const hashedMetadata = ethers.utils.solidityKeccak256(['string'], ['metadata of nft'])
    await CollectionInstance.connect(accountSeller).mint(hashedMetadata)

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
      accountBidder,
      accountBidder2,
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

  describe("Auction", () => {
    it('Should list for Auction', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
        CollectionInstance,
        accountSeller
      } = await loadFixture(setupFixture)
      const secondInDay = 60 * 60 * 24
      const tokenId = ethers.constants.Zero
      const blockTimestamp = await getBlockTimestamp()
      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await expect(
        MarketplaceInstance.connect(accountSeller).listingItem(
          CollectionInstance.address, // nftContract
          tokenId, // tokenId
          false, // isFixedPrice
          false, // isRequiredShipping
          blockTimestamp + 60, // startTime
          blockTimestamp + 60 + secondInDay, // endTime
          accountSeller.address, // paymentToken
          ethers.utils.parseEther('50000000'), // amount
        )
      ).to.be.revertedWith('Marketplace: PAYMENT_UNACCEPTED')

      await expect(
        MarketplaceInstance
          .connect(accountSeller)
          .listingItem(
            CollectionInstance.address,
            tokenId,
            false, // isFixedPrice
            false, // isRequiredShipping
            blockTimestamp,
            blockTimestamp + 60 + secondInDay,
            VietnameseDongInstance.address,
            ethers.utils.parseEther('50000000'),
          )
      ).to.be.revertedWith('MarketListed: STARTED')

      await expect(
        MarketplaceInstance
          .connect(accountSeller)
          .listingItem(
            CollectionInstance.address,
            tokenId,
            false, // isFixedPrice
            false, // isRequiredShipping
            blockTimestamp + 60,
            blockTimestamp,
            VietnameseDongInstance.address,
            ethers.utils.parseEther('50000000'),
          )
      ).to.be.revertedWith('MarketListed: INVALID_END_TIME')

      await MarketplaceInstance.connect(accountSeller).listingItem(
        CollectionInstance.address,
        tokenId,
        false, // isFixedPrice
        false, // isRequiredShipping
        blockTimestamp + 60,
        blockTimestamp + 60 + secondInDay,
        VietnameseDongInstance.address,
        ethers.utils.parseEther('50000000'),
      )

      const itemListed = await MarketplaceInstance.itemListed(
        CollectionInstance.address,
        tokenId,
      )
      expect(itemListed.seller).to.equal(accountSeller.address)
      expect(itemListed.buyer).to.equal(ethers.constants.AddressZero)
      expect(itemListed.isFixedPrice).to.equal(false)
      expect(itemListed.isRequiredShipping).to.equal(false)
      expect(itemListed.startTime).to.equal(blockTimestamp + 60)
      expect(itemListed.endTime).to.equal(blockTimestamp + 60 + secondInDay)
      expect(itemListed.amount).to.deep.equal(ethers.utils.parseEther('50000000'))
    })

    it('Should revert list for Auction when paused', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
        CollectionInstance,
        accountSeller
      } = await loadFixture(setupFixture)
      const tokenId = ethers.constants.Zero
      const secondInDay = 60 * 60 * 24
      const blockTimestamp = await getBlockTimestamp()

      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await MarketplaceInstance.pause()
      await expect(
        MarketplaceInstance.connect(accountSeller).listingItem(
          CollectionInstance.address,
          tokenId,
          false, // isFixedPrice
          false, // isRequiredShipping
          blockTimestamp + 60,
          blockTimestamp + 60 + secondInDay,
          VietnameseDongInstance.address,
          ethers.utils.parseEther('50000000'),
        )
      ).to.be.revertedWith('Pausable: paused')
    })

    it('Should able to update Auction item', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
        CollectionInstance,
        accountSeller
      } = await loadFixture(setupFixture)
      const tokenId = ethers.constants.Zero
      const secondInDay = 60 * 60 * 24
      const blockTimestamp = await getBlockTimestamp()
      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await MarketplaceInstance.connect(accountSeller).listingItem(
        CollectionInstance.address,
        tokenId,
        false, // isFixedPrice
        false, // isRequiredShipping
        blockTimestamp + 60,
        blockTimestamp + 60 + secondInDay,
        VietnameseDongInstance.address,
        ethers.utils.parseEther('50000000'),
      )
      await MarketplaceInstance.connect(accountSeller).updateItemListed(
        CollectionInstance.address,
        tokenId,
        blockTimestamp + 50,
        blockTimestamp + secondInDay,
        VietnameseDongInstance.address,
        ethers.utils.parseEther('60000000'),
      )
      const itemListed = await MarketplaceInstance.itemListed(
        CollectionInstance.address,
        tokenId,
      )
      expect(itemListed.seller).to.equal(accountSeller.address)
      expect(itemListed.buyer).to.equal(ethers.constants.AddressZero)
      expect(itemListed.isFixedPrice).to.equal(false)
      expect(itemListed.isRequiredShipping).to.equal(false)
      expect(itemListed.startTime).to.equal(blockTimestamp + 50)
      expect(itemListed.endTime).to.equal(blockTimestamp + secondInDay)
      expect(itemListed.amount).to.deep.equal(ethers.utils.parseEther('60000000'))
    })

    it('Should revert update Auction item by account unauthorized', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
        CollectionInstance,
        accountSeller,
        accountUnauthorized
      } = await loadFixture(setupFixture)
      const tokenId = ethers.constants.Zero
      const secondInDay = 60 * 60 * 24
      const blockTimestamp = await getBlockTimestamp()
      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await MarketplaceInstance.connect(accountSeller).listingItem(
        CollectionInstance.address,
        tokenId,
        false, // isFixedPrice
        false, // isRequiredShipping
        blockTimestamp + 60,
        blockTimestamp + 60 + secondInDay,
        VietnameseDongInstance.address,
        ethers.utils.parseEther('50000000'),
      )
      await expect(
        MarketplaceInstance.connect(accountUnauthorized).updateItemListed(
          CollectionInstance.address,
          tokenId,
          blockTimestamp + 50,
          blockTimestamp + secondInDay,
          VietnameseDongInstance.address,
          ethers.utils.parseEther('50000000'),
        )
      ).to.be.revertedWith('Marketplace: FORBIDDEN')
    })

    it('Should revert update Auction item by unaccepted payment token', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
        CollectionInstance,
        accountSeller,
      } = await loadFixture(setupFixture)
      const tokenId = ethers.constants.Zero
      const secondInDay = 60 * 60 * 24
      const blockTimestamp = await getBlockTimestamp()
      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await MarketplaceInstance.connect(accountSeller).listingItem(
        CollectionInstance.address,
        tokenId,
        false, // isFixedPrice
        false, // isRequiredShipping
        blockTimestamp + 60,
        blockTimestamp + 60 + secondInDay,
        VietnameseDongInstance.address,
        ethers.utils.parseEther('50000000'),
      )
      await expect(
        MarketplaceInstance.connect(accountSeller).updateItemListed(
          CollectionInstance.address,
          tokenId,
          blockTimestamp + 50,
          blockTimestamp + secondInDay,
          accountSeller.address,
          ethers.utils.parseEther('50000000'),
        )
      ).to.be.revertedWith('Marketplace: PAYMENT_UNACCEPTED')
    })

    it('Should revert update Auction item sold', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
        CollectionInstance,
        accountSeller,
        accountBidder
      } = await loadFixture(setupFixture)
      const tokenId = ethers.constants.Zero
      const secondInDay = 60 * 60 * 24
      const blockTimestamp = await getBlockTimestamp()
      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await MarketplaceInstance.connect(accountSeller).listingItem(
        CollectionInstance.address,
        tokenId,
        false, // isFixedPrice
        false, // isRequiredShipping
        blockTimestamp + 60,
        blockTimestamp + 60 + secondInDay,
        VietnameseDongInstance.address,
        ethers.utils.parseEther('50000000'),
      )
      await VietnameseDongInstance.connect(accountBidder).approve(MarketplaceInstance.address, ethers.constants.MaxUint256)
      await setNextBlockTimestamp(blockTimestamp + 60)
      await MarketplaceInstance.connect(accountBidder).bidding(
        CollectionInstance.address,
        tokenId,
        ethers.utils.parseEther('50000000').add(ethers.utils.parseEther('1000000'))
      )
      await expect(
        MarketplaceInstance.connect(accountSeller).updateItemListed(
          CollectionInstance.address,
          tokenId,
          blockTimestamp + 50,
          blockTimestamp + secondInDay,
          VietnameseDongInstance.address,
          ethers.utils.parseEther('50000000'),
        )
      ).to.be.revertedWith('Marketplace: SOLD')
    })

    it('Should able to bidding and payment processing for an Auction item', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
        CollectionInstance,
        TreasuryInstance,
        accountSeller,
        accountBidder,
        accountBidder2,
        accountUnauthorized
      } = await loadFixture(setupFixture)
      const tokenId = ethers.constants.Zero
      const secondInDay = 60 * 60 * 24
      const blockTimestamp = await getBlockTimestamp()
      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await MarketplaceInstance.connect(accountSeller).listingItem(
        CollectionInstance.address,
        tokenId,
        false, // isFixedPrice
        false, // isRequiredShipping
        blockTimestamp + 60,
        blockTimestamp + 60 + secondInDay,
        VietnameseDongInstance.address,
        ethers.utils.parseEther('50000000'),
      )
      await VietnameseDongInstance.connect(accountBidder).approve(MarketplaceInstance.address, ethers.constants.MaxUint256)
      await VietnameseDongInstance.connect(accountBidder2).approve(MarketplaceInstance.address, ethers.constants.MaxUint256)
      const serviceFeePercent = await MarketplaceInstance.serviceFeePercent()
      const PERCENTAGE = await MarketplaceInstance.PERCENTAGE()

      await expect(
        MarketplaceInstance
          .connect(accountBidder)
          .bidding(
            CollectionInstance.address,
            tokenId,
            ethers.utils.parseEther('50000000').add(ethers.utils.parseEther('1000000'))
          )
      ).to.be.revertedWith('MarketListed: NOT_STARTED')

      await setNextBlockTimestamp(blockTimestamp + 60)
      await expect(
        MarketplaceInstance
          .connect(accountBidder)
          .bidding(CollectionInstance.address, tokenId, ethers.utils.parseEther('1'))
      ).to.be.revertedWith('MarketListed: AMOUNT_TOO_LOW')

      const balanceOfAccountBidder2Before = await VietnameseDongInstance.balanceOf(accountBidder2.address)
      await MarketplaceInstance.connect(accountBidder2).bidding(
        CollectionInstance.address,
        tokenId,
        ethers.utils.parseEther('50000000').add(ethers.utils.parseEther('1000000'))
      )
      const balanceOfAccountBidder2After = await VietnameseDongInstance.balanceOf(accountBidder2.address)
      const balanceOfAccountBidderBefore = await VietnameseDongInstance.balanceOf(accountBidder.address)
      const balanceOfAccountSellerBefore = await VietnameseDongInstance.balanceOf(accountSeller.address)
      const lastBid = ethers.utils.parseEther('50000000')
        .add(ethers.utils.parseEther('1000000'))
        .add(ethers.utils.parseEther('1000000'))

      await MarketplaceInstance.connect(accountBidder).bidding(
        CollectionInstance.address,
        tokenId,
        lastBid
      )
      const balanceOfAccountBidder2Last = await VietnameseDongInstance.balanceOf(accountBidder2.address)
      const balanceOfAccountBidderAfter = await VietnameseDongInstance.balanceOf(accountBidder.address)

      await expect(
        MarketplaceInstance
          .connect(accountBidder)
          .paymentProcessing(CollectionInstance.address, tokenId)
      ).to.be.revertedWith('MarketListed: LISTING')

      await setNextBlockTimestamp(blockTimestamp + 60 + secondInDay + 1)
      await expect(
        MarketplaceInstance
          .connect(accountBidder)
          .bidding(CollectionInstance.address, tokenId, ethers.utils.parseEther('50000000').add(ethers.utils.parseEther('5000000')))
      ).to.be.revertedWith('MarketListed: AUCTION_ENDED')
      await expect(
        MarketplaceInstance
          .connect(accountUnauthorized)
          .paymentProcessing(CollectionInstance.address, tokenId)
      ).to.be.revertedWith('Marketplace: FORBIDDEN')
      await MarketplaceInstance
        .connect(accountBidder)
        .paymentProcessing(CollectionInstance.address, tokenId)

      const balanceOfAccountSellerAfter = await VietnameseDongInstance.balanceOf(accountSeller.address)
      const balanceOfTreasury = await VietnameseDongInstance.balanceOf(TreasuryInstance.address)

      expect(await CollectionInstance.ownerOf(ethers.constants.Zero)).to.equal(accountBidder.address)
      expect(balanceOfAccountBidder2Before.sub(balanceOfAccountBidder2After)).to.deep.equal(ethers.utils.parseEther('50000000').add(ethers.utils.parseEther('1000000')))
      expect(balanceOfAccountBidder2Last.sub(balanceOfAccountBidder2After)).to.deep.equal(ethers.utils.parseEther('50000000').add(ethers.utils.parseEther('1000000')))
      expect(balanceOfTreasury).to.deep.equal(lastBid.mul(serviceFeePercent).div(PERCENTAGE))
      expect(balanceOfAccountBidderBefore.sub(balanceOfAccountBidderAfter)).to.deep.equal(lastBid)
      expect(balanceOfAccountSellerAfter.sub(balanceOfAccountSellerBefore)).to.deep.equal(lastBid.sub(lastBid.mul(serviceFeePercent).div(PERCENTAGE)))
    })

    it('Should able to cancel listing an Auction item by seller', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
        CollectionInstance,
        accountSeller,
        accountBidder,
        accountUnauthorized
      } = await loadFixture(setupFixture)
      const tokenId = ethers.constants.Zero
      const secondInDay = 60 * 60 * 24
      const blockTimestamp = await getBlockTimestamp()
      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await MarketplaceInstance.connect(accountSeller).listingItem(
        CollectionInstance.address,
        tokenId,
        false, // isFixedPrice
        false, // isRequiredShipping
        blockTimestamp + 60,
        blockTimestamp + 60 + secondInDay,
        VietnameseDongInstance.address,
        ethers.utils.parseEther('50000000'),
      )
      await MarketplaceInstance
        .connect(accountSeller)
        .cancelListItem(
          CollectionInstance.address,
          tokenId,
        )
      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await MarketplaceInstance.connect(accountSeller).listingItem(
        CollectionInstance.address,
        tokenId,
        false, // isFixedPrice
        false, // isRequiredShipping
        blockTimestamp + 60,
        blockTimestamp + 60 + secondInDay,
        VietnameseDongInstance.address,
        ethers.utils.parseEther('50000000'),
      )
      await VietnameseDongInstance.connect(accountBidder).approve(MarketplaceInstance.address, ethers.constants.MaxUint256)
      await expect(
        MarketplaceInstance
          .connect(accountUnauthorized)
          .cancelListItem(
            CollectionInstance.address,
            tokenId,
          )
      ).to.be.revertedWith('Marketplace: FORBIDDEN')

      await setNextBlockTimestamp(blockTimestamp + 60)

      await expect(
        MarketplaceInstance
          .connect(accountSeller)
          .cancelListItem(
            CollectionInstance.address,
            tokenId,
          )
      ).to.be.revertedWith('MarketListed: LISTING')

      await MarketplaceInstance.connect(accountBidder).bidding(
        CollectionInstance.address,
        tokenId,
        ethers.utils.parseEther('50000000').add(ethers.utils.parseEther('1000000'))
      )

      await expect(
        MarketplaceInstance
          .connect(accountSeller)
          .cancelListItem(
            CollectionInstance.address,
            tokenId,
          )
      ).to.be.revertedWith('Marketplace: SOLD')
    })
  })

  describe("Auction NFT Phygital", () => {
    it('Should able to bidding and payment processing for an Auction item', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
        CollectionInstance,
        TreasuryInstance,
        accountSeller,
        accountBidder,
        accountBidder2,
        accountUnauthorized
      } = await loadFixture(setupFixture)
      const tokenId = ethers.constants.Zero
      const secondInDay = 60 * 60 * 24
      const blockTimestamp = await getBlockTimestamp()
      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await MarketplaceInstance.connect(accountSeller).listingItem(
        CollectionInstance.address,
        tokenId,
        false,
        true,
        blockTimestamp + 60,
        blockTimestamp + 60 + secondInDay,
        VietnameseDongInstance.address,
        ethers.utils.parseEther('50000000'),
      )
      await VietnameseDongInstance.connect(accountBidder).approve(MarketplaceInstance.address, ethers.constants.MaxUint256)
      await VietnameseDongInstance.connect(accountBidder2).approve(MarketplaceInstance.address, ethers.constants.MaxUint256)
      const serviceFeePercent = await MarketplaceInstance.serviceFeePercent()
      const PERCENTAGE = await MarketplaceInstance.PERCENTAGE()

      await expect(
        MarketplaceInstance
          .connect(accountBidder)
          .bidding(
            CollectionInstance.address,
            tokenId,
            ethers.utils.parseEther('50000000').add(ethers.utils.parseEther('1000000'))
          )
      ).to.be.revertedWith('MarketListed: NOT_STARTED')

      await setNextBlockTimestamp(blockTimestamp + 60)
      await expect(
        MarketplaceInstance
          .connect(accountBidder)
          .bidding(CollectionInstance.address, tokenId, ethers.utils.parseEther('1'))
      ).to.be.revertedWith('MarketListed: AMOUNT_TOO_LOW')

      const balanceOfAccountBidder2Before = await VietnameseDongInstance.balanceOf(accountBidder2.address)
      await MarketplaceInstance.connect(accountBidder2).bidding(
        CollectionInstance.address,
        tokenId,
        ethers.utils.parseEther('50000000').add(ethers.utils.parseEther('1000000'))
      )
      const balanceOfAccountBidder2After = await VietnameseDongInstance.balanceOf(accountBidder2.address)
      const balanceOfAccountBidderBefore = await VietnameseDongInstance.balanceOf(accountBidder.address)
      const balanceOfAccountSellerBefore = await VietnameseDongInstance.balanceOf(accountSeller.address)
      const lastBid = ethers.utils.parseEther('50000000')
        .add(ethers.utils.parseEther('1000000'))
        .add(ethers.utils.parseEther('1000000'))

      await MarketplaceInstance.connect(accountBidder).bidding(
        CollectionInstance.address,
        tokenId,
        lastBid
      )
      const balanceOfAccountBidder2Last = await VietnameseDongInstance.balanceOf(accountBidder2.address)
      const balanceOfAccountBidderAfter = await VietnameseDongInstance.balanceOf(accountBidder.address)

      await setNextBlockTimestamp(blockTimestamp + 60 + secondInDay + 1)
      await MarketplaceInstance
        .connect(accountBidder)
        .paymentProcessing(CollectionInstance.address, tokenId)

      await expect(
        MarketplaceInstance
          .connect(accountUnauthorized)
          .confirmReceivedItem(CollectionInstance.address, tokenId)
      ).to.be.revertedWith('Marketplace: FORBIDDEN')

      await MarketplaceInstance
        .connect(accountBidder)
        .confirmReceivedItem(CollectionInstance.address, tokenId)

      const balanceOfAccountSellerAfter = await VietnameseDongInstance.balanceOf(accountSeller.address)
      const balanceOfTreasury = await VietnameseDongInstance.balanceOf(TreasuryInstance.address)

      expect(await CollectionInstance.ownerOf(tokenId)).to.equal(accountBidder.address)
      expect(balanceOfAccountBidder2Before.sub(balanceOfAccountBidder2After)).to.deep.equal(ethers.utils.parseEther('50000000').add(ethers.utils.parseEther('1000000')))
      expect(balanceOfAccountBidder2Last.sub(balanceOfAccountBidder2After)).to.deep.equal(ethers.utils.parseEther('50000000').add(ethers.utils.parseEther('1000000')))
      expect(balanceOfTreasury).to.deep.equal(lastBid.mul(serviceFeePercent).div(PERCENTAGE))
      expect(balanceOfAccountBidderBefore.sub(balanceOfAccountBidderAfter)).to.deep.equal(lastBid)
      expect(balanceOfAccountSellerAfter.sub(balanceOfAccountSellerBefore)).to.deep.equal(lastBid.sub(lastBid.mul(serviceFeePercent).div(PERCENTAGE)))
    })

    it('Should revert when confirm received for an Auction item overdue', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
        CollectionInstance,
        accountSeller,
        accountBidder,
      } = await loadFixture(setupFixture)
      const tokenId = ethers.constants.Zero
      const secondInDay = 60 * 60 * 24
      const blockTimestamp = await getBlockTimestamp()
      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await MarketplaceInstance.connect(accountSeller).listingItem(
        CollectionInstance.address,
        tokenId,
        false,
        true,
        blockTimestamp + 60,
        blockTimestamp + 60 + secondInDay,
        VietnameseDongInstance.address,
        ethers.utils.parseEther('50000000'),
      )
      await VietnameseDongInstance.connect(accountBidder).approve(MarketplaceInstance.address, ethers.constants.MaxUint256)

      await setNextBlockTimestamp(blockTimestamp + 60)
      const lastBid = ethers.utils.parseEther('50000000')
        .add(ethers.utils.parseEther('1000000'))
        .add(ethers.utils.parseEther('1000000'))
      await MarketplaceInstance.connect(accountBidder).bidding(
        CollectionInstance.address,
        tokenId,
        lastBid
      )
      await expect(
        MarketplaceInstance
          .connect(accountBidder)
          .confirmReceivedItem(CollectionInstance.address, tokenId)
      ).to.be.revertedWith('Marketplace: UNSOLD')

      await setNextBlockTimestamp(blockTimestamp + 60 + secondInDay + 1)
      await MarketplaceInstance
        .connect(accountBidder)
        .paymentProcessing(CollectionInstance.address, tokenId)

      await setNextBlockTimestamp((await getBlockTimestamp()) + (secondInDay * 30))
      await expect(
        MarketplaceInstance
          .connect(accountBidder)
          .confirmReceivedItem(CollectionInstance.address, tokenId)
      ).to.be.revertedWith('Marketplace: OVERDUE')
    })

    it('Should able to cancel order for an Auction item by buyer', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
        CollectionInstance,
        accountSeller,
        accountBidder,
        accountUnauthorized
      } = await loadFixture(setupFixture)
      const tokenId = ethers.constants.Zero
      const secondInDay = 60 * 60 * 24
      const blockTimestamp = await getBlockTimestamp()
      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await MarketplaceInstance.connect(accountSeller).listingItem(
        CollectionInstance.address,
        tokenId,
        false,
        true,
        blockTimestamp + 60,
        blockTimestamp + 60 + secondInDay,
        VietnameseDongInstance.address,
        ethers.utils.parseEther('50000000'),
      )

      await setNextBlockTimestamp(blockTimestamp + 60 + 1)
      await VietnameseDongInstance.connect(accountBidder).approve(MarketplaceInstance.address, ethers.constants.MaxUint256)
      await MarketplaceInstance.connect(accountBidder).bidding(
        CollectionInstance.address,
        tokenId,
        ethers.utils.parseEther('50000000').add(ethers.utils.parseEther('1000000'))
      )
      await expect(
        MarketplaceInstance
          .connect(accountBidder)
          .cancelItemDelivering(CollectionInstance.address, tokenId)
      ).to.be.revertedWith('Marketplace: UNSOLD')

      await setNextBlockTimestamp(blockTimestamp + 60 + secondInDay + 1)
      await MarketplaceInstance
        .connect(accountBidder)
        .paymentProcessing(CollectionInstance.address, tokenId)

      await expect(
        MarketplaceInstance
          .connect(accountUnauthorized)
          .cancelItemDelivering(CollectionInstance.address, tokenId)
      ).to.be.revertedWith('Marketplace: FORBIDDEN')
      await MarketplaceInstance
        .connect(accountBidder)
        .cancelItemDelivering(CollectionInstance.address, tokenId)

      expect(await CollectionInstance.ownerOf(tokenId)).to.equal(accountSeller.address)
    })

    it('Should able to cancel order for an Auction item by seller', async () => {
      const {
        MarketplaceInstance,
        VietnameseDongInstance,
        CollectionInstance,
        accountSeller,
        accountBidder,
      } = await loadFixture(setupFixture)
      const tokenId = ethers.constants.Zero
      const secondInDay = 60 * 60 * 24
      const blockTimestamp = await getBlockTimestamp()
      await CollectionInstance.connect(accountSeller).approve(MarketplaceInstance.address, tokenId)
      await MarketplaceInstance.connect(accountSeller).listingItem(
        CollectionInstance.address,
        tokenId,
        false,
        true,
        blockTimestamp + 60,
        blockTimestamp + 60 + secondInDay,
        VietnameseDongInstance.address,
        ethers.utils.parseEther('50000000'),
      )

      await setNextBlockTimestamp(blockTimestamp + 60 + 1)
      await VietnameseDongInstance.connect(accountBidder).approve(MarketplaceInstance.address, ethers.constants.MaxUint256)
      await MarketplaceInstance.connect(accountBidder).bidding(
        CollectionInstance.address,
        tokenId,
        ethers.utils.parseEther('50000000').add(ethers.utils.parseEther('1000000'))
      )

      await setNextBlockTimestamp(blockTimestamp + 60 + secondInDay + 1)
      await MarketplaceInstance
        .connect(accountBidder)
        .paymentProcessing(CollectionInstance.address, tokenId)
      await MarketplaceInstance
        .connect(accountSeller)
        .cancelItemDelivering(CollectionInstance.address, tokenId)

      expect(await CollectionInstance.ownerOf(tokenId)).to.equal(accountSeller.address)
    })
  })
})