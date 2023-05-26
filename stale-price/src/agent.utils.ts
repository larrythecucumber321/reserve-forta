import { ethers, getEthersProvider } from "forta-agent";

// Get deployers from DeploymentRegistered event
export const getDeployers = async (): Promise<string[]> => {
  const deployerRegistryAddress = "0xD85Fac03804a3e44D29c494f3761D11A2262cBBe";
  const deployerRegistryAbi = [
    "event DeploymentRegistered(string version, address deployer)",
  ];
  const deployerRegistry = new ethers.Contract(
    deployerRegistryAddress,
    deployerRegistryAbi,
    getEthersProvider()
  );
  const registerEvents = await deployerRegistry.queryFilter(
    deployerRegistry.filters.DeploymentRegistered()
  );
  return registerEvents.map((e) => e?.args?.deployer);
};

// Helper function to get the main addresses of a given deployer
export const getRTokenContracts = async (
  deployerAddress: string
): Promise<{ rToken: ethers.Contract; main: ethers.Contract }[]> => {
  const deployerAbi = [
    "event RTokenCreated(address indexed main, address indexed rToken, address stRSR, address indexed owner, string version)",
  ];

  const erc20Abi = [
    "function name() external view returns (string)",
    "function totalSupply() external view returns (uint256)",
  ];

  const mainAbi = ["function assetRegistry() external view returns (address)"];

  const deployer = new ethers.Contract(
    deployerAddress,
    deployerAbi,
    getEthersProvider()
  );
  const deploymentEvents = await deployer.queryFilter(
    deployer.filters.RTokenCreated()
  );

  return deploymentEvents.map((deployment) => {
    const rTokenAddress = deployment?.args?.rToken;
    const mainAddress = deployment?.args?.main;

    const main = new ethers.Contract(mainAddress, mainAbi, getEthersProvider());

    const rToken = new ethers.Contract(
      rTokenAddress,
      erc20Abi,
      getEthersProvider()
    );
    return { main, rToken };
  });
};
