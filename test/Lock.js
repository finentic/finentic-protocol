const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers")
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs")
const { expect } = require("chai")

describe("Lock", () => {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployOneYearLockFixture() {
    const ONE_YEAR_IN_SECS = 365 * 24 * 60 * 60
    const ONE_GWEI = 1_000_000_000

    const lockedAmount = ONE_GWEI
    const unlockTime = (await time.latest()) + ONE_YEAR_IN_SECS

    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await ethers.getSigners()

    const Lock = await ethers.getContractFactory("Lock")
    const LockInstance = await Lock.deploy(unlockTime, { value: lockedAmount })

    return { LockInstance, unlockTime, lockedAmount, owner, otherAccount }
  }

  describe("Deployment", () => {
    it("Should set the right unlockTime", async () => {
      const { LockInstance, unlockTime } = await loadFixture(deployOneYearLockFixture)

      expect(await LockInstance.unlockTime()).to.equal(unlockTime)
    })

    it("Should set the right owner", async () => {
      const { LockInstance, owner } = await loadFixture(deployOneYearLockFixture)

      expect(await LockInstance.owner()).to.equal(owner.address)
    })

    it("Should receive and store the funds to lock", async () => {
      const { LockInstance, lockedAmount } = await loadFixture(
        deployOneYearLockFixture
      )

      expect(await ethers.provider.getBalance(LockInstance.address)).to.equal(
        lockedAmount
      )
    })

    it("Should fail if the unlockTime is not in the future", async () => {
      // We don't use the fixture here because we want a different deployment
      const latestTime = await time.latest()
      const Lock = await ethers.getContractFactory("Lock")
      await expect(Lock.deploy(latestTime, { value: 1 })).to.be.revertedWith(
        "Unlock time should be in the future"
      )
    })
  })

  describe("Withdrawals", () => {
    describe("Validations", () => {
      it("Should revert with the right error if called too soon", async () => {
        const { LockInstance } = await loadFixture(deployOneYearLockFixture)

        await expect(LockInstance.withdraw()).to.be.revertedWith(
          "You can't withdraw yet"
        )
      })

      it("Should revert with the right error if called from another account", async () => {
        const { LockInstance, unlockTime, otherAccount } = await loadFixture(
          deployOneYearLockFixture
        )

        // We can increase the time in Hardhat Network
        await time.increaseTo(unlockTime)

        // We use lock.connect() to send a transaction from another account
        await expect(LockInstance.connect(otherAccount).withdraw()).to.be.revertedWith(
          "You aren't the owner"
        )
      })

      it("Shouldn't fail if the unlockTime has arrived and the owner calls it", async () => {
        const { LockInstance, unlockTime } = await loadFixture(
          deployOneYearLockFixture
        )

        // Transactions are sent using the first signer by default
        await time.increaseTo(unlockTime)

        await expect(LockInstance.withdraw()).not.to.be.reverted
      })
    })

    describe("Events", () => {
      it("Should emit an event on withdrawals", async () => {
        const { LockInstance, unlockTime, lockedAmount } = await loadFixture(
          deployOneYearLockFixture
        )

        await time.increaseTo(unlockTime)

        await expect(LockInstance.withdraw())
          .to.emit(LockInstance, "Withdrawal")
          .withArgs(lockedAmount, anyValue) // We accept any value as `when` arg
      })
    })

    describe("Transfers", () => {
      it("Should transfer the funds to the owner", async () => {
        const { LockInstance, unlockTime, lockedAmount, owner } = await loadFixture(
          deployOneYearLockFixture
        )

        await time.increaseTo(unlockTime)

        await expect(LockInstance.withdraw()).to.changeEtherBalances(
          [owner, LockInstance],
          [lockedAmount, -lockedAmount]
        )
      })
    })
  })
})
