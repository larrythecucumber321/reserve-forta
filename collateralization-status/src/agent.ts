import {
  BlockEvent,
  Finding,
  FindingSeverity,
  FindingType,
  ethers,
  getEthersProvider,
} from "forta-agent";

// The address of RToken contract
const rTokenAddress = "0xA0d69E286B938e21CBf7E51D71F6A4c8918f482F";

// ABI for the needed function
const rTokenAbi = ["function main() external view returns (address)"];
const mainAbi = ["function basketHandler() external view returns (address)"];
const basketHandlerAbi = [
  "function fullyCollateralized() external view returns (bool)",
];

// Handle block
function provideHandleBlock() {
  return async function handleBlock(this: any, blockEvent: BlockEvent) {
    const findings = [];

    const rTokenContract = new ethers.Contract(
      rTokenAddress,
      rTokenAbi,
      getEthersProvider()
    );

    // get the address of the BasketHandler
    const mainAddress = await rTokenContract.main();

    const mainContract = new ethers.Contract(
      mainAddress,
      mainAbi,
      getEthersProvider()
    );
    const basketHandlerAddress = await mainContract.basketHandler();

    const basketHandlerContract = new ethers.Contract(
      basketHandlerAddress,
      basketHandlerAbi,
      getEthersProvider()
    );

    // Check if the RToken is fully collateralized
    const isFullyCollateralized =
      await basketHandlerContract.fullyCollateralized();

    if (!isFullyCollateralized) {
      findings.push(
        Finding.fromObject({
          name: "Collateralization Monitor",
          description: `The RToken contract at address ${rTokenAddress} is undercollateralized`,
          alertId: "RESERVE-UNDERCOLLATERALIZED",
          severity: FindingSeverity.High,
          type: FindingType.Suspicious,
          metadata: {
            rTokenAddress: rTokenAddress,
            currentBlock: blockEvent.blockNumber.toString(),
          },
        })
      );
    }

    return findings;
  };
}

module.exports = {
  provideHandleBlock,
  handleBlock: provideHandleBlock(),
};
