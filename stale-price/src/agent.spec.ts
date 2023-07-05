import agent from "./agent";
import {
  Finding,
  FindingSeverity,
  FindingType,
  HandleBlock,
  ethers,
} from "forta-agent";
import { TestBlockEvent } from "forta-agent-tools/lib/test";
import { getDeployers, getRTokenContracts } from "./agent.utils";

class MockContract extends ethers.Contract {
  mockTotalSupply = ethers.utils.parseEther("101");
  mockName = "rToken";
  mockAddress = ethers.constants.AddressZero;

  async totalSupply() {
    return this.mockTotalSupply;
  }

  async name() {
    return this.mockName;
  }
}

// Create a mock function for `lastSave`
const mockLastSave = jest.fn();

// Then create a mock contract
const mockContract = {
  lastSave: mockLastSave,
};

jest.mock("./agent.utils", () => ({
  getDeployers: mockGetDeployers,
  getRTokenContracts: mockGetRTokenContracts,
}));

jest.mock("ethers", () => {
  const originalModule = jest.requireActual("ethers");

  const mockEthers = {
    ...originalModule,
    Contract: jest.fn(() => mockContract),
    utils: {
      parseEther: originalModule.utils.parseEther,
      ...originalModule.utils,
    },
    getEthersProvider: jest.fn(),
  };

  return mockEthers;
});

jest.mock("./agent.utils", () => ({
  getDeployers: jest.fn(),
  getRTokenContracts: jest.fn(),
}));

const mockRTokenContract = {
  totalSupply: jest.fn().mockResolvedValue(ethers.utils.parseEther("101")),
  name: jest.fn().mockResolvedValue("rToken"),
  address: ethers.constants.AddressZero,
  // Add all the missing properties and methods here, you can mock them as jest functions
} as unknown as MockContract;

const mockMainContract = {
  assetRegistry: jest.fn().mockResolvedValue({
    erc20s: jest.fn().mockResolvedValue([ethers.constants.AddressZero]),
    toAsset: jest.fn().mockImplementation((address: string) => {
      // Mock the implementation of toAsset()
      // You can provide your own logic here based on the input address
      // For testing purposes, you can simply return a mock asset address
      return ethers.constants.AddressZero;
    }),
    address: ethers.constants.AddressZero,
  }),
} as unknown as ethers.Contract;

const mockAssetRegistryContract = {
  erc20s: jest.fn().mockResolvedValue([ethers.constants.AddressZero]), // Mock the return value of erc20s() as an empty array
  toAsset: jest.fn().mockImplementation((address: string) => {
    // Mock the implementation of toAsset()
    // You can provide your own logic here based on the input address
    // For testing purposes, you can simply return a mock asset address
    return ethers.constants.AddressZero;
  }),
  // ... other properties and methods
} as unknown as ethers.Contract;

const mockGetDeployers = getDeployers as jest.MockedFunction<
  typeof getDeployers
>;
const mockGetRTokenContracts = getRTokenContracts as jest.MockedFunction<
  typeof getRTokenContracts
>;
mockGetRTokenContracts.mockResolvedValueOnce([
  { rToken: mockRTokenContract, main: mockMainContract },
]);

let handleBlock: HandleBlock;

beforeAll(() => {
  handleBlock = agent.provideHandleBlock();

  // Assume that getDeployers returns an array of 1 address
  mockGetDeployers.mockResolvedValue([ethers.constants.AddressZero]);

  // Assume that getRTokenContracts returns an array of 1 rToken
  mockGetRTokenContracts.mockResolvedValue([
    {
      rToken: mockRTokenContract,
      main: mockMainContract,
    },
  ]);
});

describe("asset update monitor agent", () => {
  it("returns empty findings if all tokens have been updated within the threshold", async () => {
    const mockBlockEvent = new TestBlockEvent();

    mockLastSave.mockResolvedValueOnce(mockBlockEvent.block.timestamp - 1);

    const findings = await handleBlock(mockBlockEvent);

    expect(mockLastSave).toHaveBeenCalledTimes(1);
    expect(findings).toStrictEqual([]);
  });

  it("returns a finding if an rToken has not been updated within the threshold", async () => {
    const mockBlockEvent = new TestBlockEvent();

    mockLastSave.mockResolvedValueOnce(
      mockBlockEvent.block.timestamp - 24 * 60 * 60 - 1
    );

    const findings = await handleBlock(mockBlockEvent);

    expect(findings).toStrictEqual([
      Finding.fromObject({
        name: "Asset Update Monitor",
        description: `The following RTokens have not been updated in the last 24 hours: rToken`,
        alertId: "RESERVE-STALE-PRICE",
        severity: FindingSeverity.Medium,
        type: FindingType.Info,
      }),
    ]);
    expect(mockLastSave).toHaveBeenCalledTimes(1);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});
