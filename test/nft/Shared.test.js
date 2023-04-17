// npx hardhat test ./test/nft/Shared.test.js --network hardhat
// npx hardhat coverage --testfiles ./test/nft/Shared.test.js --network hardhat

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers")
const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("Shared", () => {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function setupFixture() {
    // Contracts are deployed using the first signer/account by default
    const [accountOwner, account1, account2, accountUnauthorized] = await ethers.getSigners()

    const ControlCenter = await ethers.getContractFactory("ControlCenter")
    const ControlCenterInstance = await ControlCenter.deploy()

    const Shared = await ethers.getContractFactory("Shared")
    const SharedInstance = await Shared.deploy(ControlCenterInstance.address)
    await SharedInstance.updateBaseURI('ipfs://')

    return {
      ControlCenterInstance,
      SharedInstance,
      accountOwner,
      account1,
      account2,
      accountUnauthorized,
    }
  }

  describe("Deployment", () => {
    it('Should have token information', async () => {
      const { SharedInstance } = await loadFixture(setupFixture)
      expect(await SharedInstance.name()).to.equal('Finentic Shared NFT')
      expect(await SharedInstance.symbol()).to.equal('FxNFT')
      expect(await SharedInstance.baseURI()).to.equal('ipfs://')
    })

    it("Should not have any tokens balance in account owner", async () => {
      const {
        SharedInstance,
        accountOwner,
      } = await loadFixture(setupFixture)
      const balanceOfOwner = await SharedInstance.balanceOf(accountOwner.address)
      expect(balanceOfOwner).to.deep.equal(ethers.constants.Zero)
    })

    it("Should not have any total supply", async () => {
      const { SharedInstance } = await loadFixture(setupFixture)
      expect(await SharedInstance.currentTokenId()).to.deep.equal(ethers.constants.Zero)
    })

    it('Should have control center', async () => {
      const {
        SharedInstance,
        ControlCenterInstance,
      } = await loadFixture(setupFixture)
      expect(
        await SharedInstance.controlCenter()
      ).to.equal(ControlCenterInstance.address)
    })
  })

  describe("Mint", () => {
    it('Should revert when mint NFT by an account blacklisted', async () => {
      const {
        ControlCenterInstance,
        SharedInstance,
        account1,
        accountUnauthorized,
      } = await loadFixture(setupFixture)
      await expect(ControlCenterInstance.addToBlacklist(accountUnauthorized.address)).to.be.fulfilled
      const hashedMetadata = ethers.utils.solidityKeccak256(['string'], ['metadata of nft'])
      await expect(
        SharedInstance.connect(accountUnauthorized).mint(account1.address, hashedMetadata)
      ).to.be.revertedWith('Blacklist: BLACKLISTED')
    })

    it('Should revert when mint NFT to an account blacklisted', async () => {
      const {
        ControlCenterInstance,
        SharedInstance,
        account1,
        accountUnauthorized,
      } = await loadFixture(setupFixture)
      await expect(ControlCenterInstance.addToBlacklist(accountUnauthorized.address)).to.be.fulfilled
      const hashedMetadata = ethers.utils.solidityKeccak256(['string'], ['metadata of nft'])
      await expect(
        SharedInstance.connect(account1).mint(accountUnauthorized.address, hashedMetadata)
      ).to.be.revertedWith('Blacklist: BLACKLISTED')
    })

    it('Should mint NFT for an account not on blacklisting', async () => {
      const {
        SharedInstance,
        account1,
      } = await loadFixture(setupFixture)
      const hashedMetadata = ethers.utils.solidityKeccak256(['string'], ['metadata of nft'])
      await expect(SharedInstance.connect(account1).mint(account1.address, hashedMetadata)).to.be.fulfilled
      expect(await SharedInstance.balanceOf(account1.address)).to.deep.equal(ethers.constants.One)
      expect(await SharedInstance.currentTokenId()).to.deep.equal(ethers.constants.One)
      expect(await SharedInstance.ownerOf(ethers.constants.Zero)).to.equal(account1.address)
      expect(await SharedInstance.getApproved(ethers.constants.Zero)).to.equal(ethers.constants.AddressZero)
      expect(await SharedInstance.tokenURI(ethers.constants.Zero)).to.equal('ipfs://' + '0')
    })

    it('Should mint and approve NFT for an account', async () => {
      const {
        SharedInstance,
        account1,
        account2,
      } = await loadFixture(setupFixture)
      const hashedMetadata = ethers.utils.solidityKeccak256(['string'], ['metadata of nft'])
      await expect(
        SharedInstance
          .connect(account1)
          .mintAndApprove(account1.address, account2.address, hashedMetadata)
      ).to.be.fulfilled
      expect(await SharedInstance.balanceOf(account1.address)).to.deep.equal(ethers.constants.One)
      expect(await SharedInstance.currentTokenId()).to.deep.equal(ethers.constants.One)
      expect(await SharedInstance.ownerOf(ethers.constants.Zero)).to.equal(account1.address)
      expect(await SharedInstance.getApproved(ethers.constants.Zero)).to.equal(account2.address)
      expect(await SharedInstance.tokenURI(ethers.constants.Zero)).to.equal('ipfs://' + '0')
    })
  })

  describe("Burn", () => {
    it('Should revert burn NFT by account not own it', async () => {
      const {
        SharedInstance,
        account1,
        accountUnauthorized,
      } = await loadFixture(setupFixture)
      const hashedMetadata = ethers.utils.solidityKeccak256(['string'], ['metadata of nft'])
      await expect(SharedInstance.mint(account1.address, hashedMetadata)).to.be.fulfilled
      await expect(
        SharedInstance.connect(accountUnauthorized).burn(ethers.constants.Zero)
      ).to.be.revertedWith('Shared: ONLY_OWNER')
    })

    it('Should revert burn NFT for an account in blacklist', async () => {
      const {
        ControlCenterInstance,
        SharedInstance,
        account1,
        accountUnauthorized,
      } = await loadFixture(setupFixture)
      const hashedMetadata = ethers.utils.solidityKeccak256(['string'], ['metadata of nft'])
      await expect(
        SharedInstance.connect(account1).mint(accountUnauthorized.address, hashedMetadata)
      ).to.be.fulfilled
      await expect(
        ControlCenterInstance.addToBlacklist(accountUnauthorized.address)
      ).to.be.fulfilled
      await expect(
        SharedInstance.connect(accountUnauthorized).burn(ethers.constants.Zero)
      ).to.be.revertedWith('Blacklist: BLACKLISTED')
    })

    it('Should burn tokens for an account not in blacklist', async () => {
      const {
        SharedInstance,
        account1,
      } = await loadFixture(setupFixture)
      const hashedMetadata = ethers.utils.solidityKeccak256(['string'], ['metadata of nft'])
      await expect(
        SharedInstance.connect(account1).mint(account1.address, hashedMetadata)
      ).to.be.fulfilled
      await expect(SharedInstance.connect(account1).burn(ethers.constants.Zero)).to.be.fulfilled
      expect(await SharedInstance.balanceOf(account1.address)).to.deep.equal(ethers.constants.Zero)
      expect(await SharedInstance.currentTokenId()).to.deep.equal(ethers.constants.One)
      await expect(
        SharedInstance.ownerOf(ethers.constants.Zero)
      ).to.be.revertedWith('ERC721: invalid token ID')
    })
  })

  describe("Pausable", () => {
    it('Should revert mint when paused', async () => {
      const { SharedInstance, account1 } = await loadFixture(setupFixture)
      const hashedMetadata = ethers.utils.solidityKeccak256(['string'], ['metadata of nft'])
      await expect(SharedInstance.pause()).to.be.fulfilled
      await expect(
        SharedInstance.connect(account1).mint(account1.address, hashedMetadata)
      ).to.be.revertedWith('Pausable: paused')
    })

    it('Should revert transfer when paused', async () => {
      const { SharedInstance, account1, account2 } = await loadFixture(setupFixture)
      const hashedMetadata = ethers.utils.solidityKeccak256(['string'], ['metadata of nft'])
      await expect(
        SharedInstance.connect(account1).mint(account1.address, hashedMetadata)
      ).to.be.fulfilled
      await expect(SharedInstance.pause()).to.be.fulfilled
      await expect(
        SharedInstance
          .connect(account1)
          .transferFrom(account1.address, account2.address, ethers.constants.Zero)
      ).to.be.revertedWith('Pausable: paused')
    })

    it('Should revert burn when paused', async () => {
      const { SharedInstance, account1 } = await loadFixture(setupFixture)
      const hashedMetadata = ethers.utils.solidityKeccak256(['string'], ['metadata of nft'])
      await expect(
        SharedInstance.connect(account1).mint(account1.address, hashedMetadata)
      ).to.be.fulfilled
      await expect(SharedInstance.pause()).to.be.fulfilled
      await expect(
        SharedInstance.connect(account1).burn(ethers.constants.Zero)
      ).to.be.revertedWith('Pausable: paused')
    })

    it('Should mint and burn when unpause', async () => {
      const {
        SharedInstance,
        account1,
      } = await loadFixture(setupFixture)
      const hashedMetadata = ethers.utils.solidityKeccak256(['string'], ['metadata of nft'])
      await expect(SharedInstance.pause()).to.be.fulfilled
      await expect(SharedInstance.unpause()).to.be.fulfilled
      await expect(
        SharedInstance.connect(account1).mint(account1.address, hashedMetadata)
      ).to.be.fulfilled
    })
  })
})
