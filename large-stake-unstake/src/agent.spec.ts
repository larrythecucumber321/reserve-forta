import {
  FindingType,
  FindingSeverity,
  Finding,
  HandleTransaction,
  createTransactionEvent,
  ethers,
} from "forta-agent";
import agent, { ERC20_TRANSFER_EVENT, TARGET_CONTRACT_ADDRESS } from "./agent";

describe("high ERC20 transfer agent", () => {
  let handleTransaction: HandleTransaction;
  const mockTxEvent = createTransactionEvent({} as any);

  beforeAll(() => {
    handleTransaction = agent.handleTransaction;
  });

  describe("handleTransaction", () => {
    it("returns empty findings if there are no ERC20 transfers", async () => {
      mockTxEvent.filterLog = jest.fn().mockReturnValue([]);

      const findings = await handleTransaction(mockTxEvent);

      expect(findings).toStrictEqual([]);
      expect(mockTxEvent.filterLog).toHaveBeenCalledTimes(1);
      expect(mockTxEvent.filterLog).toHaveBeenCalledWith(ERC20_TRANSFER_EVENT);
    });

    it("returns a finding if there is an ERC20 transfer over 10,000", async () => {
      const mockTransferEvent = {
        address: "0xERC20",
        args: {
          from: "0xabc",
          to: TARGET_CONTRACT_ADDRESS,
          value: ethers.BigNumber.from("10000100000000000000000"), // 10001 with 18 decimals
        },
      };
      mockTxEvent.filterLog = jest.fn().mockReturnValue([mockTransferEvent]);

      const findings = await handleTransaction(mockTxEvent);

      const normalizedValue = mockTransferEvent.args.value.div(
        ethers.BigNumber.from("10").pow(18)
      );
      expect(findings).toStrictEqual([
        Finding.fromObject({
          name: "High ERC20 Token Transfer",
          description: `High amount of ERC20 tokens transferred to ${TARGET_CONTRACT_ADDRESS}: ${normalizedValue.toString()}`,
          alertId: "FORTA-1",
          severity: FindingSeverity.Low,
          type: FindingType.Info,
          metadata: {
            to: mockTransferEvent.args.to,
            from: mockTransferEvent.args.from,
            value: mockTransferEvent.args.value.toString(),
            tokenAddress: mockTransferEvent.address,
          },
        }),
      ]);
      expect(mockTxEvent.filterLog).toHaveBeenCalledTimes(1);
      expect(mockTxEvent.filterLog).toHaveBeenCalledWith(ERC20_TRANSFER_EVENT);
    });
  });
});
