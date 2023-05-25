// npx hardhat test ./test/finance/Treasury.test.js --network hardhat
// npx hardhat coverage --testfiles ./test/finance/Treasury.test.js --network hardhat

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers")
const { expect } = require("chai")
const { ethers } = require("hardhat")

describe("Treasury", () => {
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

        const Treasury = await ethers.getContractFactory("Treasury")
        const TreasuryInstance = await Treasury.deploy(
            ControlCenterInstance.address,
        )

        const VietnameseDong = await ethers.getContractFactory("VietnameseDong")
        const VietnameseDongInstance = await VietnameseDong.deploy(ControlCenterInstance.address)


        const SharedNFT = await ethers.getContractFactory("SharedNFT")
        const SharedInstance = await SharedNFT.deploy(ControlCenterInstance.address)
        await SharedInstance.updateBaseURI('ipfs://')

        await ControlCenterInstance.addToWhitelist(TreasuryInstance.address)
        await ControlCenterInstance.addToWhitelist(accountOwner.address)

        return {
            ControlCenterInstance,
            TreasuryInstance,
            VietnameseDongInstance,
            SharedInstance,
            accountOwner,
            account1,
            account2,
            accountCreator,
            accountUnauthorized,
        }
    }

    describe("Deployment", () => {
        it('Should have control center', async () => {
            const { ControlCenterInstance, TreasuryInstance } = await loadFixture(setupFixture)
            expect(await TreasuryInstance.controlCenter()).to.equal(ControlCenterInstance.address)
        })
        it('Should able to receiving ERC721', async () => {
            const { TreasuryInstance, accountOwner } = await loadFixture(setupFixture)
            const bytesData = ethers.utils.solidityKeccak256(
                ['string'],
                ['onERC721Received(address,address,uint256,bytes)']
            )
            const selectorERC721Received = await TreasuryInstance.onERC721Received(
                accountOwner.address,
                TreasuryInstance.address,
                ethers.constants.Zero,
                bytesData,
            )
            expect(selectorERC721Received).to.equal(bytesData.substring(0, 10))
        })
    })

    describe("Native token", () => {
        it('Should receive and transfer token native', async () => {
            const {
                TreasuryInstance,
                accountOwner,
                account1,
            } = await loadFixture(setupFixture)
            const amountTransfer = ethers.utils.parseEther('10')
            const balanceOfAccount1Before = await ethers.provider.getBalance(account1.address)
            await accountOwner.sendTransaction({
                to: TreasuryInstance.address,
                value: amountTransfer,
            })
            expect(
                await ethers.provider.getBalance(TreasuryInstance.address)
            ).to.deep.equal(amountTransfer)
            await TreasuryInstance.transferNative(account1.address, amountTransfer)
            const balanceOfAccount1After = await ethers.provider.getBalance(account1.address)
            expect(
                balanceOfAccount1After.sub(balanceOfAccount1Before)
            ).to.deep.equal(amountTransfer)
        })

        it('Should revert when transfer token native by an account not treasurer', async () => {
            const {
                TreasuryInstance,
                accountUnauthorized,
            } = await loadFixture(setupFixture)
            await expect(
                TreasuryInstance
                    .connect(accountUnauthorized)
                    .transferNative(accountUnauthorized.address, ethers.constants.One)
            ).to.be.revertedWith('ControlCenter: TREASURER_ONLY')
        })
    })

    describe("ERC-20 token", () => {
        it('Should receive and transfer token ERC-20', async () => {
            const {
                VietnameseDongInstance,
                TreasuryInstance,
                accountOwner,
            } = await loadFixture(setupFixture)
            const amountTransfer = ethers.utils.parseEther('10')
            await VietnameseDongInstance.mint(TreasuryInstance.address, amountTransfer)
            const balanceOfAccountOwnerBefore = await VietnameseDongInstance.balanceOf(
                accountOwner.address,
            )
            expect(
                await VietnameseDongInstance.balanceOf(TreasuryInstance.address)
            ).to.deep.equal(amountTransfer)
            await TreasuryInstance.transferERC20(
                VietnameseDongInstance.address,
                accountOwner.address,
                amountTransfer,
            )
            const balanceOfAccountOwnerAfter = await VietnameseDongInstance.balanceOf(
                accountOwner.address,
            )
            expect(
                balanceOfAccountOwnerAfter.sub(balanceOfAccountOwnerBefore)
            ).to.deep.equal(amountTransfer)
        })

        it('Should revert when transfer token ERC-20 by an account not treasurer', async () => {
            const {
                VietnameseDongInstance,
                TreasuryInstance,
                accountUnauthorized,
            } = await loadFixture(setupFixture)
            await expect(
                TreasuryInstance
                    .connect(accountUnauthorized)
                    .transferERC20(
                        VietnameseDongInstance.address,
                        accountUnauthorized.address,
                        ethers.constants.One,
                    )
            ).to.be.revertedWith('ControlCenter: TREASURER_ONLY')
        })

        it('Should approve token ERC-20', async () => {
            const {
                VietnameseDongInstance,
                TreasuryInstance,
                accountOwner,
            } = await loadFixture(setupFixture)
            const amountTransfer = ethers.utils.parseEther('10')
            await VietnameseDongInstance.mint(TreasuryInstance.address, amountTransfer)
            const allowanceOfAccountOwnerBefore = await VietnameseDongInstance.allowance(
                TreasuryInstance.address,
                accountOwner.address,
            )
            expect(
                await VietnameseDongInstance.balanceOf(TreasuryInstance.address)
            ).to.deep.equal(amountTransfer)
            await TreasuryInstance.approveERC20(
                VietnameseDongInstance.address,
                accountOwner.address,
                amountTransfer,
            )
            const allowanceOfAccountOwnerAfter = await VietnameseDongInstance.allowance(
                TreasuryInstance.address,
                accountOwner.address,
            )
            expect(
                allowanceOfAccountOwnerAfter.sub(allowanceOfAccountOwnerBefore)
            ).to.deep.equal(amountTransfer)
        })

        it('Should revert when approve token ERC-20 by an account not treasurer', async () => {
            const {
                VietnameseDongInstance,
                TreasuryInstance,
                accountUnauthorized,
            } = await loadFixture(setupFixture)
            await expect(
                TreasuryInstance
                    .connect(accountUnauthorized)
                    .approveERC20(
                        VietnameseDongInstance.address,
                        accountUnauthorized.address,
                        ethers.constants.One
                    )
            ).to.be.revertedWith('ControlCenter: TREASURER_ONLY')
        })
    })

    describe("ERC-721 token", () => {
        it('Should receive and transfer token ERC-721', async () => {
            const {
                SharedInstance,
                TreasuryInstance,
                accountOwner,
            } = await loadFixture(setupFixture)
            const tokenId = ethers.constants.Zero
            const hashedMetadata = ethers.utils.solidityKeccak256(
                ['string'],
                ['metadata of nft']
            )
            await SharedInstance.mint(hashedMetadata)
            await SharedInstance.transferFrom(
                accountOwner.address,
                TreasuryInstance.address,
                tokenId,
            )
            expect(await SharedInstance.ownerOf(tokenId)).to.equal(TreasuryInstance.address)
            await TreasuryInstance.transferERC721(
                SharedInstance.address,
                TreasuryInstance.address,
                accountOwner.address,
                tokenId,
            )
            expect(await SharedInstance.ownerOf(tokenId)).to.equal(accountOwner.address)
        })

        it('Should revert when transfer token ERC-721 by an account not treasurer', async () => {
            const {
                SharedInstance,
                TreasuryInstance,
                accountUnauthorized,
            } = await loadFixture(setupFixture)
            await expect(
                TreasuryInstance
                    .connect(accountUnauthorized)
                    .transferERC721(
                        SharedInstance.address,
                        accountUnauthorized.address,
                        TreasuryInstance.address,
                        ethers.constants.One,
                    )
            ).to.be.revertedWith('ControlCenter: TREASURER_ONLY')
        })

        it('Should approve token ERC-721', async () => {
            const {
                SharedInstance,
                TreasuryInstance,
                accountOwner,
            } = await loadFixture(setupFixture)
            const tokenId = ethers.constants.Zero
            const hashedMetadata = ethers.utils.solidityKeccak256(
                ['string'],
                ['metadata of nft']
            )
            await SharedInstance.mint(hashedMetadata)
            await SharedInstance.transferFrom(
                accountOwner.address,
                TreasuryInstance.address,
                tokenId,
            )
            await TreasuryInstance.approveERC721(
                SharedInstance.address,
                accountOwner.address,
                tokenId,
            )
            expect(await SharedInstance.getApproved(tokenId)).to.equal(accountOwner.address)
        })

        it('Should revert when approve token ERC-20 by an account not treasurer', async () => {
            const {
                SharedInstance,
                TreasuryInstance,
                accountUnauthorized,
            } = await loadFixture(setupFixture)
            await expect(
                TreasuryInstance
                    .connect(accountUnauthorized)
                    .approveERC721(
                        SharedInstance.address,
                        accountUnauthorized.address,
                        ethers.constants.Zero
                    )
            ).to.be.revertedWith('ControlCenter: TREASURER_ONLY')
        })
    })
})
