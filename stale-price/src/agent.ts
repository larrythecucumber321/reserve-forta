import {
  BlockEvent,
  Finding,
  FindingSeverity,
  FindingType,
  ethers,
  getEthersProvider,
} from "forta-agent";
const BigNumber = ethers.BigNumber;

// ABIs for Reserve contracts
const deployerRegistryAbi = [
  "event DeploymentRegistered(string version, address deployer)",
];
const erc20Abi = [
  "function name() external view returns (string)",
  "function totalSupply() external view returns (uint256)",
];
const deployerAbi = [
  "event RTokenCreated(address indexed main, address indexed rToken, address stRSR, address indexed owner, string version)",
];

const mainAbi = ["function assetRegistry() external view returns (address)"];
const assetRegistryAbi = [
  "function erc20s() external view returns (address[] memory)",
  "function toAsset(address) external view returns (address)",
];

// Deployer registry
const deployerRegistryAddress = "0xD85Fac03804a3e44D29c494f3761D11A2262cBBe";
const deployerRegistry = new ethers.Contract(
  deployerRegistryAddress,
  deployerRegistryAbi,
  getEthersProvider()
);

// Threshold for alert (24 hours)
const hours = 6;
const refreshThreshold = hours * 60 * 60; // hours in seconds

// Handle block
function provideHandleBlock() {
  return async function handleBlock(this: any, blockEvent: BlockEvent) {
    const findings: Finding[] = [];
    const outdatedRTokens: string[] = [];

    const registerEvents = await deployerRegistry.queryFilter(
      deployerRegistry.filters.DeploymentRegistered()
    );
    const deployers = registerEvents.map((e) => e?.args?.deployer);

    await Promise.all(
      deployers.map(async (deployerAddress) => {
        const deployer = new ethers.Contract(
          deployerAddress,
          deployerAbi,
          getEthersProvider()
        );
        const deploymentEvents = await deployer.queryFilter(
          deployer.filters.RTokenCreated()
        );

        const rTokens = deploymentEvents.map(
          (deployment) => deployment?.args?.rToken
        );
        const mains = deploymentEvents.map(
          (deployment) => deployment?.args?.main
        );

        await Promise.all(
          rTokens.map(async (rToken, i) => {
            const rTokenContract = new ethers.Contract(
              rToken,
              erc20Abi,
              getEthersProvider()
            );

            const rTokenSupply = await rTokenContract.totalSupply();
            if (rTokenSupply.lt(ethers.utils.parseEther("100"))) return;
            const mainAddress = mains[i];
            const main = new ethers.Contract(
              mainAddress,
              mainAbi,
              getEthersProvider()
            );
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
                  outdatedRTokens.push(rToken);
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
          description: `The following RTokens have not been updated in the last ${hours} hours: ${outdatedRTokens.join(
            ", "
          )}`,
          alertId: "RESERVE-STALE-PRICE",
          severity: FindingSeverity.Medium,
          type: FindingType.Info,
          metadata: {
            outdatedRTokens: outdatedRTokens.join(", "),
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
