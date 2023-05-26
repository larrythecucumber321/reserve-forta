import {
  BlockEvent,
  Finding,
  FindingSeverity,
  FindingType,
  ethers,
  getEthersProvider,
} from "forta-agent";
import { getDeployers, getRTokenContracts } from "./agent.utils";

// ABIs for Reserve contracts
const assetRegistryAbi = [
  "function erc20s() external view returns (address[] memory)",
  "function toAsset(address) external view returns (address)",
];

// Threshold for alert (24 hours)
const hours = 6;
const refreshThreshold = hours * 60 * 60; // hours in seconds

// Handle block
function provideHandleBlock() {
  return async function handleBlock(this: any, blockEvent: BlockEvent) {
    const findings: Finding[] = [];
    const outdatedRTokens: { address: string; name: string }[] = [];

    const deployers = await getDeployers();

    await Promise.all(
      deployers.map(async (deployerAddress) => {
        const rTokens = await getRTokenContracts(deployerAddress);

        await Promise.all(
          rTokens.map(async ({ rToken, main }, i) => {
            const rTokenSupply = await rToken.totalSupply();
            const rTokenName = await rToken.name();
            if (rTokenSupply.lt(ethers.utils.parseEther("100"))) return;

            const assetRegistryAddress = await main.assetRegistry();

            const assetRegistryContract = new ethers.Contract(
              assetRegistryAddress,
              assetRegistryAbi,
              getEthersProvider()
            );

            // get the list of ERC20 tokens
            const erc20s = await assetRegistryContract.erc20s();

            for (let i = 0; i < erc20s.length; i++) {
              // Convert ERC20 to asset contract address
              const assetAddress = await assetRegistryContract.toAsset(
                erc20s[i]
              );

              // Create a contract instance to interact with the asset contract
              const assetContract = new ethers.Contract(
                assetAddress,
                ["function lastSave() external view returns (uint256)"],
                getEthersProvider()
              );

              // Get the last update time
              let lastSave;
              try {
                lastSave = await assetContract.lastSave();

                // Check if it's been more than threshold hours since the last update
                if (blockEvent.block.timestamp - +lastSave > refreshThreshold) {
                  outdatedRTokens.push({
                    address: rToken.address,
                    name: rTokenName,
                  });
                }
                break;
              } catch (e) {
                continue;
              }
            }
          })
        );
      })
    );

    if (outdatedRTokens.length > 0) {
      findings.push(
        Finding.fromObject({
          name: "Asset Update Monitor",
          description: `The following RTokens have not been updated in the last ${hours} hours: ${outdatedRTokens
            .map((x) => x.name)
            .join(", ")}`,
          alertId: "RESERVE-STALE-PRICE",
          severity: FindingSeverity.Medium,
          type: FindingType.Info,
          metadata: {
            outdatedRTokenAddresses: outdatedRTokens
              .map((x) => x.address)
              .join(", "),
            outdatedRTokenNames: outdatedRTokens.map((x) => x.name).join(", "),
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
