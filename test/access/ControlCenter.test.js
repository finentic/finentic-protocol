// npx hardhat test ./test/access/ControlCenter.test.js --network hardhat
// npx hardhat coverage --testfiles ./test/payment/ControlCenter.test.js --network hardhat

const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers")
const { expect } = require("chai")

describe("ControlCenter", () => {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function setupFixture() {
    // Contracts are deployed using the first signer/account by default
    const [accountOwner, account1, account2, accountUnauthorized] = await ethers.getSigners()

    const ControlCenter = await ethers.getContractFactory("ControlCenter")
    const ControlCenterInstance = await ControlCenter.deploy()

    return { ControlCenterInstance, accountOwner, account1, account2, accountUnauthorized }
  }

  describe("Deployment", () => {
    it("Should set the account owner is role admin as default", async () => {
      const { ControlCenterInstance, accountOwner } = await loadFixture(setupFixture)
      const defaultAdminRole = await ControlCenterInstance.DEFAULT_ADMIN_ROLE()
      expect(await ControlCenterInstance.hasRole(defaultAdminRole, accountOwner.address)).to.true
    })

    it('Should set the account owner is role operator as default', async () => {
      const { ControlCenterInstance, accountOwner } = await loadFixture(setupFixture)
      const operatorRole = await ControlCenterInstance.OPERATOR_ROLE()
      expect(await ControlCenterInstance.hasRole(operatorRole, accountOwner.address)).to.true
    })

    it('Should set the account owner is role treasury as default', async () => {
      const { ControlCenterInstance, accountOwner } = await loadFixture(setupFixture)
      const treasuryRole = await ControlCenterInstance.TREASURER_ROLE()
      expect(await ControlCenterInstance.hasRole(treasuryRole, accountOwner.address)).to.true
    })

    it('Should set the account owner is role moderator as default', async () => {
      const { ControlCenterInstance, accountOwner } = await loadFixture(setupFixture)
      const moderatorRole = await ControlCenterInstance.MODERATOR_ROLE()
      expect(await ControlCenterInstance.hasRole(moderatorRole, accountOwner.address)).to.true
    })
  })

  describe("Roles", () => {
    it("Should able to control roles when call message", async () => {
      const {
        ControlCenterInstance,
        accountOwner,
        accountUnauthorized,
      } = await loadFixture(setupFixture)

      await expect(ControlCenterInstance.onlyOperator(accountOwner.address)).to.be.fulfilled
      await expect(ControlCenterInstance.onlyTreasurer(accountOwner.address)).to.be.fulfilled
      await expect(ControlCenterInstance.onlyModerator(accountOwner.address)).to.be.fulfilled

      await expect(
        ControlCenterInstance.onlyOperator(accountUnauthorized.address)
      ).to.be.revertedWith('ControlCenter: OPERATOR_ONLY')

      await expect(
        ControlCenterInstance.onlyTreasurer(accountUnauthorized.address)
      ).to.be.revertedWith('ControlCenter: TREASURER_ONLY')

      await expect(
        ControlCenterInstance.onlyModerator(accountUnauthorized.address)
      ).to.be.revertedWith('ControlCenter: MODERATOR_ONLY')
    })

    it("Should set role member by admin role", async () => {
      const { ControlCenterInstance, account1 } = await loadFixture(setupFixture)
      const operatorRole = await ControlCenterInstance.OPERATOR_ROLE()
      await ControlCenterInstance.grantRole(operatorRole, account1.address)
      expect(await ControlCenterInstance.hasRole(operatorRole, account1.address)).to.true
    })

    it('Should revert when trying to set role member by account unauthorized', async () => {
      const {
        ControlCenterInstance,
        accountUnauthorized,
      } = await loadFixture(setupFixture)
      const defaultAdminRole = await ControlCenterInstance.DEFAULT_ADMIN_ROLE()
      const operatorRole = await ControlCenterInstance.OPERATOR_ROLE()
      await expect(
        ControlCenterInstance
          .connect(accountUnauthorized)
          .grantRole(operatorRole, accountUnauthorized.address)
      ).to.be.revertedWith(
        `AccessControl: account ${accountUnauthorized.address.toLowerCase()} is missing role ${defaultAdminRole.toString()}`
      )
    })

    it("Should set role admin by DEFAULT_ADMIN_ROLE", async () => {
      const {
        ControlCenterInstance,
        account1,
        account2,
      } = await loadFixture(setupFixture)
      const operatorRole = await ControlCenterInstance.OPERATOR_ROLE()
      await ControlCenterInstance.grantRole(operatorRole, account1.address)
      await ControlCenterInstance.setRoleAdmin(operatorRole, operatorRole)
      expect(await ControlCenterInstance.hasRole(operatorRole, account1.address)).to.true
      await expect(
        ControlCenterInstance.connect(account1).grantRole(operatorRole, account2.address)
      ).to.be.fulfilled
      expect(await ControlCenterInstance.hasRole(operatorRole, account2.address)).to.true
    })

    it('Should revert when trying to set role admin by account unauthorized', async () => {
      const {
        ControlCenterInstance,
        accountUnauthorized,
      } = await loadFixture(setupFixture)
      const defaultAdminRole = await ControlCenterInstance.DEFAULT_ADMIN_ROLE()
      const operatorRole = await ControlCenterInstance.OPERATOR_ROLE()
      await expect(
        ControlCenterInstance.connect(accountUnauthorized).setRoleAdmin(operatorRole, operatorRole)
      ).to.be.revertedWith(
        `AccessControl: account ${accountUnauthorized.address.toLowerCase()} is missing role ${defaultAdminRole.toString()}`
      )
    })
  })

  describe("Whitelist", () => {
    it("Should able to call message when account in whitelist", async () => {
      const {
        ControlCenterInstance,
        accountOwner,
      } = await loadFixture(setupFixture)
      await expect(ControlCenterInstance.onlyWhitelisted(accountOwner.address)).to.be.fulfilled
    })

    it("Should revert when call message when account not whitelist", async () => {
      const {
        ControlCenterInstance,
        accountUnauthorized,
      } = await loadFixture(setupFixture)
      await expect(
        ControlCenterInstance.onlyWhitelisted(accountUnauthorized.address)
      ).to.be.revertedWith('Whitelist: NOT_WHITELISTED')
    })

    it("Should add an account to whitelist by account moderator", async () => {
      const { ControlCenterInstance, account1 } = await loadFixture(setupFixture)
      await expect(ControlCenterInstance.addToWhitelist(account1.address)).to.be.fulfilled
      expect(await ControlCenterInstance.whitelisting(account1.address)).to.true
    })

    it("Should revert when add an account to whitelist by account unauthorized", async () => {
      const {
        ControlCenterInstance,
        accountUnauthorized,
      } = await loadFixture(setupFixture)
      await expect(
        ControlCenterInstance
          .connect(accountUnauthorized)
          .addToWhitelist(accountUnauthorized.address)
      ).to.be.reverted
    })

    it("Should remove an account from whitelist by account moderator", async () => {
      const { ControlCenterInstance, account1 } = await loadFixture(setupFixture)
      await expect(ControlCenterInstance.removeFromWhitelist(account1.address)).to.be.fulfilled
      expect(await ControlCenterInstance.whitelisting(account1.address)).to.false
    })

    it("Should revert when remove an account from whitelist by account unauthorized", async () => {
      const {
        ControlCenterInstance,
        account1,
        accountUnauthorized,
      } = await loadFixture(setupFixture)
      await expect(
        ControlCenterInstance.connect(accountUnauthorized).removeFromWhitelist(account1.address)
      ).to.be.reverted
    })

    it("Should add multiple accounts to whitelist by account moderator", async () => {
      const {
        ControlCenterInstance,
        account1,
        account2,
      } = await loadFixture(setupFixture)
      await expect(
        ControlCenterInstance.addMultiToWhitelist([account1.address, account2.address])
      ).to.be.fulfilled
      expect(await ControlCenterInstance.whitelisting(account1.address)).to.true
      expect(await ControlCenterInstance.whitelisting(account2.address)).to.true
    })

    it("Should revert when add no accounts to whitelist by account unauthorized", async () => {
      const { ControlCenterInstance } = await loadFixture(setupFixture)
      await expect(
        ControlCenterInstance.addMultiToWhitelist([])
      ).to.be.revertedWith('Whitelist: EMPTY_ARRAY')
    })

    it(
      "Should revert when add multiple accounts to whitelist by account unauthorized",
      async () => {
        const {
          ControlCenterInstance,
          account1,
          account2,
          accountUnauthorized,
        } = await loadFixture(setupFixture)
        await expect(
          ControlCenterInstance
            .connect(accountUnauthorized)
            .addMultiToWhitelist([account1.address, account2.address])
        ).to.be.reverted
      },
    )

    it("Should remove multiple accounts from whitelist by account moderator", async () => {
      const {
        ControlCenterInstance,
        account1,
        account2,
      } = await loadFixture(setupFixture)
      await expect(
        ControlCenterInstance.removeMultiFromWhitelist([account1.address, account2.address])
      ).to.be.fulfilled
      expect(await ControlCenterInstance.whitelisting(account1.address)).to.false
      expect(await ControlCenterInstance.whitelisting(account2.address)).to.false
    })

    it("Should revert when remove no accounts to whitelist by account unauthorized", async () => {
      const { ControlCenterInstance } = await loadFixture(setupFixture)
      await expect(
        ControlCenterInstance.removeMultiFromWhitelist([])
      ).to.be.revertedWith('Whitelist: EMPTY_ARRAY')
    })

    it(
      "Should revert when remove multiple accounts from whitelist by account unauthorized",
      async () => {
        const {
          ControlCenterInstance,
          account1,
          account2,
          accountUnauthorized,
        } = await loadFixture(setupFixture)
        await expect(
          ControlCenterInstance
            .connect(accountUnauthorized)
            .removeMultiFromWhitelist([account1.address, account2.address])
        ).to.be.reverted
      },
    )
  })

  describe("Blacklist", () => {
    it("Should add an account to blacklist by account moderator", async () => {
      const { ControlCenterInstance, account1 } = await loadFixture(setupFixture)
      await expect(ControlCenterInstance.addToBlacklist(account1.address)).to.be.fulfilled
      expect(await ControlCenterInstance.blacklisting(account1.address)).to.true
    })

    it("Should revert when call message for an account in blacklist", async () => {
      const {
        ControlCenterInstance,
        account1,
      } = await loadFixture(setupFixture)
      await expect(ControlCenterInstance.addToBlacklist(account1.address)).to.be.fulfilled
      expect(await ControlCenterInstance.blacklisting(account1.address)).to.true
      await expect(
        ControlCenterInstance.notInBlacklisted(account1.address)
      ).to.be.revertedWith('Blacklist: BLACKLISTED')
    })

    it("Should revert when add an account to blacklist by account unauthorized", async () => {
      const {
        ControlCenterInstance,
        accountUnauthorized,
      } = await loadFixture(setupFixture)
      await expect(
        ControlCenterInstance
          .connect(accountUnauthorized)
          .addToBlacklist(accountUnauthorized.address)
      ).to.be.reverted
    })

    it("Should able to call message for an account not in blacklist", async () => {
      const {
        ControlCenterInstance,
        accountOwner,
      } = await loadFixture(setupFixture)
      await expect(ControlCenterInstance.notInBlacklisted(accountOwner.address)).to.be.fulfilled
    })

    it("Should remove an account from blacklist by account moderator", async () => {
      const { ControlCenterInstance, account1 } = await loadFixture(setupFixture)
      await expect(ControlCenterInstance.removeFromBlacklist(account1.address)).to.be.fulfilled
      expect(await ControlCenterInstance.blacklisting(account1.address)).to.false
    })

    it("Should revert when remove an account from blacklist by account unauthorized", async () => {
      const {
        ControlCenterInstance,
        account1,
        accountUnauthorized,
      } = await loadFixture(setupFixture)
      await expect(
        ControlCenterInstance.connect(accountUnauthorized).removeFromBlacklist(account1.address)
      ).to.be.reverted
    })

    it("Should add multiple accounts to blacklist by account moderator", async () => {
      const {
        ControlCenterInstance,
        account1,
        account2,
      } = await loadFixture(setupFixture)
      await expect(
        ControlCenterInstance.addMultiToBlacklist([account1.address, account2.address])
      ).to.be.fulfilled
      expect(await ControlCenterInstance.blacklisting(account1.address)).to.true
      expect(await ControlCenterInstance.blacklisting(account2.address)).to.true
    })

    it("Should revert when add no accounts to blacklist by account unauthorized", async () => {
      const { ControlCenterInstance } = await loadFixture(setupFixture)
      await expect(
        ControlCenterInstance.addMultiToBlacklist([])
      ).to.be.revertedWith('Whitelist: EMPTY_ARRAY')
    })

    it(
      "Should revert when add multiple accounts to blacklist by account unauthorized",
      async () => {
        const {
          ControlCenterInstance,
          account1,
          account2,
          accountUnauthorized,
        } = await loadFixture(setupFixture)
        await expect(
          ControlCenterInstance
            .connect(accountUnauthorized)
            .addMultiToBlacklist([account1.address, account2.address])
        ).to.be.reverted
      },
    )

    it("Should remove multiple accounts from blacklist by account moderator", async () => {
      const {
        ControlCenterInstance,
        account1,
        account2,
      } = await loadFixture(setupFixture)
      await expect(
        ControlCenterInstance.removeMultiFromBlacklist([account1.address, account2.address])
      ).to.be.fulfilled
      expect(await ControlCenterInstance.blacklisting(account1.address)).to.false
      expect(await ControlCenterInstance.blacklisting(account2.address)).to.false
    })

    it("Should revert when remove no accounts to blacklist by account unauthorized", async () => {
      const { ControlCenterInstance } = await loadFixture(setupFixture)
      await expect(
        ControlCenterInstance.removeMultiFromBlacklist([])
      ).to.be.revertedWith('Blacklist: EMPTY_ARRAY')
    })

    it(
      "Should revert when remove multiple accounts from blacklist by account unauthorized",
      async () => {
        const {
          ControlCenterInstance,
          account1,
          account2,
          accountUnauthorized,
        } = await loadFixture(setupFixture)
        await expect(
          ControlCenterInstance
            .connect(accountUnauthorized)
            .removeMultiFromBlacklist([account1.address, account2.address])
        ).to.be.reverted
      },
    )
  })
})
