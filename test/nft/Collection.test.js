// npx hardhat test ./test/nft/Collection.test.js --network hardhat
// npx hardhat coverage --testfiles ./test/nft/Collection.test.js --network hardhat

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers")
const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("Collection", () => {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function setupFixture() {
    // Contracts are deployed using the first signer/account by default
    const [
      accountOwner,
      account1,
      account2,
      accountCreator,
      accountUnauthorized,
    ] = await ethers.getSigners()

    const ControlCenter = await ethers.getContractFactory("ControlCenter")
    const ControlCenterInstance = await ControlCenter.deploy()

    const CollectionImplementation = await ethers.getContractFactory("Collection")
    const CollectionImplementationInstance = await CollectionImplementation.deploy()

    const CollectionFactory = await ethers.getContractFactory("CollectionFactory")
    const CollectionFactoryInstance = await CollectionFactory.deploy(
      ControlCenterInstance.address,
      CollectionImplementationInstance.address,
    )

    const collectionParams = [
      accountCreator.address, // address creator
      'Finentic First Collection', // string calldata name
      'FC-NFT', // string calldata symbol
      'ipfs://', //string calldata baseURI
    ]

    const collectionAddress = await CollectionFactoryInstance
      .callStatic
      .createCollection(...collectionParams)

    await CollectionFactoryInstance.createCollection(...collectionParams)

    const CollectionInstance = await ethers.getContractAt('Collection', collectionAddress)

    return {
      ControlCenterInstance,
      CollectionImplementationInstance,
      CollectionFactoryInstance,
      CollectionInstance,
      collectionParams,
      accountOwner,
      account1,
      account2,
      accountCreator,
      accountUnauthorized,
    }
  }

  describe("Deployment", () => {
    it('Should have token information', async () => {
      const { CollectionInstance, collectionParams } = await loadFixture(setupFixture)
      expect(await CollectionInstance.creator()).to.equal(collectionParams[0])
      expect(await CollectionInstance.name()).to.equal(collectionParams[1])
      expect(await CollectionInstance.symbol()).to.equal(collectionParams[2])
      expect(await CollectionInstance.baseURI()).to.equal(collectionParams[3])
    })

    it("Should not have any tokens balance in account creator", async () => {
      const {
        CollectionInstance,
        accountCreator,
      } = await loadFixture(setupFixture)
      const balanceOfCreator = await CollectionInstance.balanceOf(accountCreator.address)
      expect(balanceOfCreator).to.deep.equal(ethers.constants.Zero)
    })

    it("Should not have any total supply", async () => {
      const { CollectionInstance } = await loadFixture(setupFixture)
      expect(await CollectionInstance.totalSupply()).to.deep.equal(ethers.constants.Zero)
    })

    it("Should revert when initialize after initialized", async () => {
      const {
        CollectionImplementationInstance,
        CollectionInstance,
        collectionParams,
      } = await loadFixture(setupFixture)
      await expect(
        CollectionImplementationInstance.initialize(...collectionParams)
      ).to.be.revertedWith('Collection: ONLY_INITIALIZE')
      await expect(
        CollectionInstance.initialize(...collectionParams)
      ).to.be.revertedWith('Initializable: contract is already initialized')
    })

    it("Should revert when create a collection without NFT symbol", async () => {
      const { CollectionFactoryInstance } = await loadFixture(setupFixture)
      const newCollectionParams = [
        ethers.constants.AddressZero, // address creator
        '', // string calldata name
        '', // string calldata symbol
        '' //string calldata baseURI
      ]
      await expect(
        CollectionFactoryInstance.createCollection(...newCollectionParams)
      ).to.be.revertedWith('CollectionFactory: EMPTY_SYMBOL')
    })

    it("Should revert when update base URI by an account is not creator", async () => {
      const { CollectionInstance, accountUnauthorized } = await loadFixture(setupFixture)
      const newBaseURI = 'http://'
      await expect(
        CollectionInstance.connect(accountUnauthorized).updateBaseURI(newBaseURI)
      ).to.be.revertedWith('Collection: ONLY_CREATOR')
    })

    it("Should able to update base URI", async () => {
      const { CollectionInstance, accountCreator } = await loadFixture(setupFixture)
      const newBaseURI = 'http://'
      await expect(
        CollectionInstance.connect(accountCreator).updateBaseURI(newBaseURI)
      ).to.be.fulfilled
      expect(await CollectionInstance.baseURI()).to.equal(newBaseURI)
    })
  })

  describe("Mint", () => {
    it('Should revert when mint NFT by an account is not creator', async () => {
      const {
        CollectionInstance,
        accountUnauthorized,
      } = await loadFixture(setupFixture)
      const hashedMetadata = ethers.utils.solidityKeccak256(['string'], ['metadata of nft'])
      await expect(
        CollectionInstance
          .connect(accountUnauthorized)
          .mint(hashedMetadata)
      ).to.be.revertedWith('Collection: ONLY_CREATOR')
    })

    it('Should mint NFT', async () => {
      const {
        CollectionInstance,
        collectionParams,
        accountCreator,
      } = await loadFixture(setupFixture)
      const hashedMetadata = ethers.utils.solidityKeccak256(['string'], ['metadata of nft'])
      await expect(CollectionInstance.connect(accountCreator).mint(hashedMetadata)).to.be.fulfilled
      expect(await CollectionInstance.balanceOf(accountCreator.address)).to.deep.equal(ethers.constants.One)
      expect(await CollectionInstance.totalSupply()).to.deep.equal(ethers.constants.One)
      expect(await CollectionInstance.ownerOf(ethers.constants.Zero)).to.equal(accountCreator.address)
      expect(await CollectionInstance.getApproved(ethers.constants.Zero)).to.equal(ethers.constants.AddressZero)
      expect(await CollectionInstance.tokenURI(ethers.constants.Zero)).to.equal(collectionParams[3] + '0')
    })

    it('Should revert when mint and approve NFT by an account is not creator', async () => {
      const {
        CollectionInstance,
        accountUnauthorized,
      } = await loadFixture(setupFixture)
      const hashedMetadata = ethers.utils.solidityKeccak256(['string'], ['metadata of nft'])
      await expect(
        CollectionInstance
          .connect(accountUnauthorized)
          .mintAndApprove(accountUnauthorized.address, hashedMetadata)
      ).to.be.revertedWith('Collection: ONLY_CREATOR')
    })

    it('Should mint and approve NFT for an account any', async () => {
      const {
        CollectionInstance,
        collectionParams,
        accountCreator,
        account1,
      } = await loadFixture(setupFixture)
      const hashedMetadata = ethers.utils.solidityKeccak256(['string'], ['metadata of nft'])
      await expect(
        CollectionInstance
          .connect(accountCreator)
          .mintAndApprove(account1.address, hashedMetadata)
      ).to.be.fulfilled
      expect(await CollectionInstance.balanceOf(accountCreator.address)).to.deep.equal(ethers.constants.One)
      expect(await CollectionInstance.totalSupply()).to.deep.equal(ethers.constants.One)
      expect(await CollectionInstance.ownerOf(ethers.constants.Zero)).to.equal(accountCreator.address)
      expect(await CollectionInstance.getApproved(ethers.constants.Zero)).to.equal(account1.address)
      expect(await CollectionInstance.tokenURI(ethers.constants.Zero)).to.equal(collectionParams[3] + '0')
    })
  })

  describe("Burn", () => {
    it('Should revert burn NFT by account not creator', async () => {
      const {
        CollectionInstance,
        accountCreator,
        accountUnauthorized,
      } = await loadFixture(setupFixture)
      const hashedMetadata = ethers.utils.solidityKeccak256(['string'], ['metadata of nft'])
      await expect(
        CollectionInstance.connect(accountCreator).mint(hashedMetadata)
      ).to.be.fulfilled
      await expect(
        CollectionInstance.connect(accountUnauthorized).burn(ethers.constants.Zero)
      ).to.be.revertedWith('Collection: ONLY_CREATOR')
    })

    it('Should revert burn NFT by an account not own it', async () => {
      const {
        CollectionInstance,
        account1,
        accountCreator,
      } = await loadFixture(setupFixture)
      const hashedMetadata = ethers.utils.solidityKeccak256(['string'], ['metadata of nft'])
      await expect(
        CollectionInstance.connect(accountCreator).mint(hashedMetadata)
      ).to.be.fulfilled
      await expect(
        CollectionInstance.connect(accountCreator).transferFrom(
          accountCreator.address,
          account1.address,
          ethers.constants.Zero,
        )
      ).to.be.fulfilled
      await expect(
        CollectionInstance.connect(accountCreator).burn(ethers.constants.Zero)
      ).to.be.revertedWith('Collection: ONLY_OWNER')
    })

    it('Should burn tokens by an account creator and owner that token id', async () => {
      const {
        CollectionInstance,
        accountCreator,
      } = await loadFixture(setupFixture)
      const hashedMetadata = ethers.utils.solidityKeccak256(['string'], ['metadata of nft'])
      await expect(
        CollectionInstance.connect(accountCreator).mint(hashedMetadata)
      ).to.be.fulfilled
      await expect(CollectionInstance.connect(accountCreator).burn(ethers.constants.Zero)).to.be.fulfilled
      expect(await CollectionInstance.balanceOf(accountCreator.address)).to.deep.equal(ethers.constants.Zero)
      expect(await CollectionInstance.totalSupply()).to.deep.equal(ethers.constants.One)
      await expect(
        CollectionInstance.ownerOf(ethers.constants.Zero)
      ).to.be.revertedWith('ERC721: invalid token ID')
    })
  })

  describe("Creator", () => {
    it('Should able to update creator', async () => {
      const {
        CollectionInstance,
        accountUnauthorized,
        accountCreator,
        account1,
      } = await loadFixture(setupFixture)

      await expect(
        CollectionInstance.connect(accountUnauthorized).updateCreator(accountUnauthorized.address)
      ).to.be.revertedWith('Collection: ONLY_CREATOR')

      await CollectionInstance.connect(accountCreator).updateCreator(account1.address)

      expect(await CollectionInstance.creator()).to.equal(account1.address)
    })

    it('Should able to create collection when unpause', async () => {
      const { CollectionFactoryInstance, collectionParams } = await loadFixture(setupFixture)
      await expect(CollectionFactoryInstance.pause()).to.be.fulfilled
      await expect(CollectionFactoryInstance.unpause()).to.be.fulfilled
      await CollectionFactoryInstance.createCollection(...collectionParams)
    })
  })

  describe("Pausable", () => {
    it('Should revert when create collection when paused', async () => {
      const { CollectionFactoryInstance, collectionParams } = await loadFixture(setupFixture)
      await expect(CollectionFactoryInstance.pause()).to.be.fulfilled
      await expect(
        CollectionFactoryInstance.createCollection(...collectionParams)
      ).to.be.revertedWith('Pausable: paused')
    })

    it('Should able to create collection when unpause', async () => {
      const { CollectionFactoryInstance, collectionParams } = await loadFixture(setupFixture)
      await expect(CollectionFactoryInstance.pause()).to.be.fulfilled
      await expect(CollectionFactoryInstance.unpause()).to.be.fulfilled
      await CollectionFactoryInstance.createCollection(...collectionParams)
    })
  })
})
