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

export const getRTokenContract = (rTokenAddress: string): ethers.Contract => {
  const erc20Abi = ["function name() external view returns (string)"];

  return new ethers.Contract(rTokenAddress, erc20Abi, getEthersProvider());
};

export const getGovernanceContract = (
  governanceAddress: string
): ethers.Contract => {
  // ABIs for Reserve contracts
  const governanceAbi = [
    "event ProposalCreated(uint256,address,address[],uint256[],string[],bytes[],uint256,uint256,string)",
    "event ProposalExecuted(uint256)",
  ];

  return new ethers.Contract(
    governanceAddress,
    governanceAbi,
    getEthersProvider()
  );
};
type IRTokenConfig = {
  rTokenAddress: string;
  governanceAddress: string;
};

export const rTokensToMonitor: IRTokenConfig[] = [
  {
    rTokenAddress: "0xA0d69E286B938e21CBf7E51D71F6A4c8918f482F", // eUSD
    governanceAddress: "0x7e880d8bD9c9612D6A9759F96aCD23df4A4650E6",
  },
  {
    rTokenAddress: "0xaCdf0DBA4B9839b96221a8487e9ca660a48212be", // hyUSD
    governanceAddress: "0x22d7937438b4bBf02f6cA55E3831ABB94Bd0b6f1",
  },
  {
    rTokenAddress: "0xE72B141DF173b999AE7c1aDcbF60Cc9833Ce56a8", // ETH+
    governanceAddress: "0x239cDcBE174B4728c870A24F77540dAB3dC5F981",
  },
];
