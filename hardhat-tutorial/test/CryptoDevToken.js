const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

async function deployCryptoDevTokenAndNftsAndWhitelist() {
  const [owner, otherAccount] = await ethers.getSigners();

  const maxWhitelistedAddresses = 25
  const Whitelist = await ethers.getContractFactory("Whitelist");
  const whitelist = await Whitelist.deploy(maxWhitelistedAddresses);

  // add wallet to whitelist
  await whitelist.addAddressToWhitelist()

  const baseURI= 'www.test.com'
  const CryptoDevs = await ethers.getContractFactory("CryptoDevs");
  const cryptoDevs = await CryptoDevs.deploy(baseURI, whitelist.address);

  // The contract we are testing here
  const CryptoDevToken = await ethers.getContractFactory("CryptoDevToken");
  const cryptoDevToken = await CryptoDevToken.deploy(cryptoDevs.address);


  return { cryptoDevToken, cryptoDevs, whitelist, owner, otherAccount };
}


describe("CryptoDevToken mint", function () {
  it('Should be able to mint tokens', async() => {
    const { cryptoDevToken, owner, otherAccount } = await loadFixture(deployCryptoDevTokenAndNftsAndWhitelist);

    // get the qtty of ethers the owner account had
    const ownerBalanceBefore = await ethers.provider.getBalance(owner.address);

    // check that it doesnt have any CD token
    const cryptoDevTokenBalanceBefore = await cryptoDevToken.balanceOf(owner.address)
    expect(cryptoDevTokenBalanceBefore.toString()).to.be.equal("0")

    const transactionResponse = await cryptoDevToken.mint(1, { value: ethers.utils.parseEther('0.001')})

    // extract the gas cost of the mint transaction
    const transactionReceipt = await transactionResponse.wait()
    const { gasUsed, effectiveGasPrice } = transactionReceipt
    const gasCost = gasUsed.mul(effectiveGasPrice)

    // check that it has 1 CD token
    const cryptoDevTokenBalanceAfter = await cryptoDevToken.balanceOf(owner.address)
    expect( cryptoDevTokenBalanceAfter.toString()).to.be.equal(ethers.utils.parseEther("1"))

    const ownerBalanceAfter = await ethers.provider.getBalance(owner.address);
    const finalOwnerBalanceMath = ownerBalanceBefore.sub(ethers.utils.parseEther('0.001')).sub(gasCost)
    
    expect(ownerBalanceAfter).to.be.equal(finalOwnerBalanceMath)
  })

  it('Should not be able to mint tokens if value sent is incorrect', async() => {
    const { cryptoDevToken, owner, otherAccount } = await loadFixture(deployCryptoDevTokenAndNftsAndWhitelist);
    
    await expect(cryptoDevToken.mint(1, { value: ethers.utils.parseEther('0.0001')})).to.be.revertedWith("Ether sent is incorrect");
  })

  it('Should not be able to mint tokens if there is no more supply', async() => {
    const { cryptoDevToken, owner, otherAccount } = await loadFixture(deployCryptoDevTokenAndNftsAndWhitelist);
    // buy all tokens
    await cryptoDevToken.mint(10000, { value: ethers.utils.parseEther('10')})
    
    await expect(cryptoDevToken.mint(1, { value: ethers.utils.parseEther('0.001')})).to.be.revertedWith("Exceeds the max total supply available.");
  })
})


describe("CryptoDevToken claim", function () {
  it('Should be able to claim tokens if have nfts', async() => {
    const { cryptoDevToken, cryptoDevs, owner, otherAccount } = await loadFixture(deployCryptoDevTokenAndNftsAndWhitelist);

    // start pre sale and end it
    await cryptoDevs.startPresale()
    const FIVE_MINUTES_IN_SECS = 5 * 60
    const preSalePeriodEnd = (await time.latest()) + FIVE_MINUTES_IN_SECS;
    await time.increaseTo(preSalePeriodEnd);

    // buy 2 nfts
    await cryptoDevs.mint({ value: ethers.utils.parseEther("0.01")})
    await cryptoDevs.mint({ value: ethers.utils.parseEther("0.01")})

    await cryptoDevToken.claim()

    // check that now we have 20 CD tokens
    const cryptoDevTokenBalanceAfter = await cryptoDevToken.balanceOf(owner.address)
    expect( cryptoDevTokenBalanceAfter.toString()).to.be.equal(ethers.utils.parseEther("20"))

    const tokenId1Claimed = await cryptoDevToken.tokenIdsClaimed(1)
    expect(tokenId1Claimed).to.be.true

    const tokenId2Claimed = await cryptoDevToken.tokenIdsClaimed(1)
    expect(tokenId2Claimed).to.be.true

  })

  it('Should not be able to claim tokens if dont have any nfts', async() => {

    const { cryptoDevToken, cryptoDevs, owner, otherAccount } = await loadFixture(deployCryptoDevTokenAndNftsAndWhitelist);
    await expect(cryptoDevToken.claim()).to.be.revertedWith("You dont own any Crypto Dev NFT's");

  })

  it('Should not be able to claim tokens 2x if I have NFTs', async() => {
    const { cryptoDevToken, cryptoDevs, owner, otherAccount } = await loadFixture(deployCryptoDevTokenAndNftsAndWhitelist);

    // start pre sale and end it
    await cryptoDevs.startPresale()
    const FIVE_MINUTES_IN_SECS = 5 * 60
    const preSalePeriodEnd = (await time.latest()) + FIVE_MINUTES_IN_SECS;
    await time.increaseTo(preSalePeriodEnd);

    // buy 2 nfts
    await cryptoDevs.mint({ value: ethers.utils.parseEther("0.01")})
    await cryptoDevs.mint({ value: ethers.utils.parseEther("0.01")})

    await cryptoDevToken.claim()
    await expect(cryptoDevToken.claim()).to.be.revertedWith("You have already claimed all the tokens");

  })
})

describe("CryptoDevToken withdraw", function () {
  it('Should be able to withdraw all the money from the contract if its the owner', async() => {

    const { cryptoDevToken, owner, otherAccount } = await loadFixture(deployCryptoDevTokenAndNftsAndWhitelist);

    await cryptoDevToken.mint(1, { value: ethers.utils.parseEther('0.001')})

    const ownerBalanceBeforeWithdraw = await ethers.provider.getBalance(owner.address);

    const transactionResponse = await cryptoDevToken.withdraw()

    // extract the gas cost of the withdraw transaction
    const transactionReceipt = await transactionResponse.wait()
    const { gasUsed, effectiveGasPrice } = transactionReceipt
    const gasCost = gasUsed.mul(effectiveGasPrice)

    const ownerBalanceAfterWidthdraw = await ethers.provider.getBalance(owner.address);

    const finalOwnerBalanceMath = ownerBalanceBeforeWithdraw.add(ethers.utils.parseEther("0.001")).sub(gasCost)

    expect(ownerBalanceAfterWidthdraw).to.be.equal(finalOwnerBalanceMath)

  })

  it('Should not be able to withdraw all the money from the contract if not the owner', async() => {

    const { cryptoDevToken, owner, otherAccount } = await loadFixture(deployCryptoDevTokenAndNftsAndWhitelist);

    await expect(cryptoDevToken.connect(otherAccount).withdraw()).to.be.revertedWith("Ownable: caller is not the owner");

  })
})