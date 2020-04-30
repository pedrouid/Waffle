import {expect} from 'chai';
import {BigNumber, utils, Wallet, ContractFactory} from 'ethers';
import {MockProvider, loadFixture, createFixtureLoader} from '../src';
import {TOKEN_ABI, TOKEN_BYTECODE} from './BasicToken';

describe('Integration: Fixtures', () => {
  describe('correctly restores state', () => {
    async function tokenFixture(
      provider: MockProvider,
      [sender, recipient]: Wallet[]
    ) {
      const factory = new ContractFactory(TOKEN_ABI, TOKEN_BYTECODE, sender);
      return {
        contract: await factory.deploy(1_000),
        sender,
        recipient
      };
    }

    async function test() {
      const {contract, sender, recipient} = await loadFixture(tokenFixture);
      const balanceBefore: BigNumber = await contract.balanceOf(sender.address);
      expect(balanceBefore.eq(1_000)).to.equal(true);

      await contract.transfer(recipient.address, 50);

      const balanceAfter: BigNumber = await contract.balanceOf(sender.address);
      expect(balanceAfter.eq(950)).to.equal(true);
    }

    it('works the first time', test);
    it('works the second time', test);
  });

  it('are called once per fixture', async () => {
    let countA = 0;
    let countB = 0;
    const fixtureA = async () => countA++;
    const fixtureB = async () => countB++;

    await loadFixture(fixtureA);
    await loadFixture(fixtureA);
    await loadFixture(fixtureB);
    await loadFixture(fixtureB);

    expect(countA).to.equal(1);
    expect(countB).to.equal(1);
  });

  it('allow for restoring blockchain state', async () => {
    const fixture = async (
      provider: MockProvider,
      [wallet, other]: Wallet[]
    ) => ({wallet, other, provider});

    const {wallet, other, provider} = await loadFixture(fixture);
    const balance1 = await provider.getBalance(wallet.address);

    await wallet.sendTransaction({
      to: other.address,
      value: utils.parseEther('1')
    });
    const balance2 = await provider.getBalance(wallet.address);

    await loadFixture(fixture);
    const balance3 = await provider.getBalance(wallet.address);

    expect(balance1.toString()).not.to.equal(balance2.toString());
    expect(balance1.toString()).to.equal(balance3.toString());
  });

  describe('allow for multiple uses of different fixtures', () => {
    async function sendAB(provider: MockProvider, [a, b]: Wallet[]) {
      await send(a, b);
      return {a, b};
    }

    async function sendBA(provider: MockProvider, [a, b]: Wallet[]) {
      await send(b, a);
      return {a, b};
    }

    async function send(from: Wallet, to: Wallet) {
      await from.sendTransaction({
        value: utils.parseEther('1'),
        to: to.address,
        gasLimit: BigNumber.from(21000),
        gasPrice: BigNumber.from(1)
      });
    }

    async function testAB() {
      const {a, b} = await loadFixture(sendAB);
      await testTransfer(a, b);
    }

    async function testBA() {
      const {a, b} = await loadFixture(sendBA);
      await testTransfer(b, a);
    }

    async function testTransfer(from: Wallet, to: Wallet) {
      const fromBalance = await from.getBalance();
      const toBalance = await to.getBalance();

      const diff = utils.parseEther('2').add(21000).toString();
      expect(toBalance.sub(fromBalance).toString()).to.equal(diff);
    }

    it('A1', testAB);
    it('A2', testAB);
    it('B1', testBA);
    it('B2', testBA);
    it('A3', testAB);
    it('B3', testBA);
  });

  it('run on isolated chains', async () => {
    const fixtureA = async (provider: MockProvider) => provider;
    const fixtureB = async (provider: MockProvider) => provider;

    const providerA1 = await loadFixture(fixtureA);
    const providerA2 = await loadFixture(fixtureA);

    const providerB1 = await loadFixture(fixtureB);
    const providerB2 = await loadFixture(fixtureB);

    expect(providerA1).to.equal(providerA2);
    expect(providerB1).to.equal(providerB2);
    expect(providerA1).not.to.equal(providerB1);
  });

  it('loadFixture can be made to use custom provider and wallets', async () => {
    const customProvider = {send: () => {}} as any;
    const customWallets: Wallet[] = [];
    let receivedProvider: any;
    let receivedWallets: any;

    const customLoadFixture = createFixtureLoader(
      customProvider,
      customWallets
    );
    await customLoadFixture(async (provider, wallets) => {
      receivedProvider = provider;
      receivedWallets = wallets;
    });

    expect(receivedProvider).to.equal(customProvider);
    expect(receivedWallets).to.equal(customWallets);
  });
});
